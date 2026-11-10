package my.aksara.engine.chess;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;

/** Serialized full-strength UCI process driver. No UI work and no alternative move picker. */
public final class UciEngine implements AutoCloseable {
    public record Analysis(int depth, Integer centipawns, Integer mate, List<String> pv) {}
    public record Answer(long revision, String fen, String move, Analysis analysis) {}
    private final ExecutorService worker=Executors.newSingleThreadExecutor(r -> new Thread(r,"aksara-stockfish"));
    private final BlockingQueue<String> output=new LinkedBlockingQueue<>(4096);
    private final AtomicLong generation=new AtomicLong();
    private final Process process;
    private final BufferedWriter input;
    private final Thread reader;
    private volatile boolean closed;
    private boolean initialized;
    private final int threads, hash;
    private final List<String> transcript=Collections.synchronizedList(new ArrayList<>());

    public UciEngine(Process process, int processors, long memoryBudgetMb) {
        this.process=Objects.requireNonNull(process);
        threads=Math.max(1,Math.min(4,processors-1));
        hash=(int)Math.max(16,Math.min(128,memoryBudgetMb/8));
        input=new BufferedWriter(new OutputStreamWriter(process.getOutputStream(),StandardCharsets.UTF_8));
        reader=new Thread(() -> {
            try(BufferedReader lines=new BufferedReader(new InputStreamReader(process.getInputStream(),StandardCharsets.UTF_8))) {
                String line;
                while((line=lines.readLine())!=null) {
                    if(!output.offer(line)) { process.destroy(); break; }
                }
            } catch(IOException ignored) { }
            output.offer("__EOF__");
        },"aksara-uci-output");
        reader.setDaemon(true); reader.start();
    }
    private synchronized void send(String command) throws IOException {
        if(closed) throw new IOException("Engine closed");
        // Keep only bounded diagnostic command metadata; never store API credentials.
        if(transcript.size()==128) transcript.remove(0);
        transcript.add(command); input.write(command); input.newLine(); input.flush();
    }
    public List<String> commands() { synchronized(transcript) { return List.copyOf(transcript); } }
    private String next(long deadline) throws Exception {
        String line=output.poll(Math.max(1,deadline-System.nanoTime()),TimeUnit.NANOSECONDS);
        if(line==null) throw new TimeoutException("UCI response deadline");
        if(line.equals("__EOF__")) throw new EOFException("Stockfish exited");
        return line;
    }
    private void until(String marker,long deadline) throws Exception {
        while(!next(deadline).equals(marker)) { }
    }
    private void init() throws Exception {
        if(initialized) return;
        long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(15);
        send("uci"); boolean version=false;
        for(String line; !(line=next(deadline)).equals("uciok");) {
            if(line.startsWith("id name Stockfish 19")) version=true;
        }
        if(!version) throw new IOException("Expected official Stockfish 19 identity");
        send("setoption name Threads value "+threads);
        send("setoption name Hash value "+hash);
        send("setoption name UCI_LimitStrength value false");
        send("setoption name Skill Level value 20");
        send("setoption name MultiPV value 1");
        send("isready"); until("readyok",deadline); initialized=true;
    }
    /** FEN and revision are captured atomically from the session. No time control is implied. */
    public CompletableFuture<Answer> search(ChessSession session, int milliseconds) {
        if(milliseconds<1 || milliseconds>30000) throw new IllegalArgumentException("Search budget 1..30000ms");
        final String fen; final long revision; final Set<String> legal;
        synchronized(session) { fen=session.fen(); revision=session.revision(); legal=Set.copyOf(session.legalMoves()); }
        if(legal.isEmpty()) return CompletableFuture.failedFuture(new IllegalStateException("No playable moves"));
        long token=generation.incrementAndGet();
        // Stop any older search before queuing the next position. Its bestmove is drained first.
        try { send("stop"); } catch(IOException e) { return CompletableFuture.failedFuture(e); }
        try { return CompletableFuture.supplyAsync(() -> {
            try {
                if(token!=generation.get()) throw new CancellationException();
                init();
                send("isready"); until("readyok",System.nanoTime()+TimeUnit.SECONDS.toNanos(5));
                if(token!=generation.get()) throw new CancellationException();
                beginSearch(token,fen,milliseconds);
                long deadline=System.nanoTime()+TimeUnit.MILLISECONDS.toNanos(milliseconds+5000L);
                Analysis analysis=new Analysis(0,null,null,List.of());
                while(true) {
                    String line=next(deadline);
                    if(line.startsWith("info ")) analysis=parseInfo(line,analysis);
                    if(line.startsWith("bestmove ")) {
                        if(token!=generation.get()) throw new CancellationException();
                        String move=line.split("\\s+")[1];
                        if(!legal.contains(move)) throw new IOException("Illegal engine bestmove: "+move);
                        return new Answer(revision,fen,move,analysis);
                    }
                }
            } catch(CancellationException e) { throw e; }
            catch(Exception e) { close(); throw new CompletionException(e); }
        },worker); } catch(RejectedExecutionException e) { return CompletableFuture.failedFuture(e); }
    }
    static Analysis parseInfo(String line,Analysis old) {
        String[] p=line.split("\\s+"); int depth=old.depth(); Integer cp=null,mate=null;
        boolean scored=false,bound=false; List<String> pv=List.of();
        try {
            for(int i=1;i<p.length;i++) {
                if(p[i].equals("depth")) depth=Integer.parseInt(p[++i]);
                else if(p[i].equals("score")) {
                    String kind=p[++i]; int value=Integer.parseInt(p[++i]);
                    cp=kind.equals("cp")?value:null; mate=kind.equals("mate")?value:null; scored=true;
                } else if(p[i].equals("lowerbound") || p[i].equals("upperbound")) bound=true;
                else if(p[i].equals("pv")) { pv=List.of(Arrays.copyOfRange(p,i+1,p.length)); break; }
            }
        } catch(RuntimeException ignored) { return old; }
        // Bound scores are not evidence for categorical dialogue judgements.
        return scored&&!bound ? new Analysis(depth,cp,mate,pv) : old;
    }
    private synchronized void beginSearch(long token,String fen,int milliseconds) throws IOException {
        if(token!=generation.get()) throw new CancellationException();
        send("position fen "+fen); send("go movetime "+milliseconds);
    }
    public synchronized void cancel() {
        generation.incrementAndGet();
        try { send("stop"); } catch(IOException ignored) { }
    }
    @Override public synchronized void close() {
        if(closed) return;
        generation.incrementAndGet();
        try { send("stop"); send("quit"); } catch(IOException ignored) { }
        closed=true; process.destroy();
        try { input.close(); } catch(IOException ignored) { }
        worker.shutdownNow(); reader.interrupt();
    }
}
