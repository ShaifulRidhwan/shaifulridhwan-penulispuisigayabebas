package my.aksara.engine.chess;
import org.junit.Test;
import org.junit.Assume;
import static org.junit.Assert.*;
import java.util.List;
import java.util.concurrent.*;

public class UciEngineTest {
    @Test public void boundedScoresCannotBecomeDialogueEvidence() {
        var old=new UciEngine.Analysis(0,null,null,List.of());
        assertEquals(old,UciEngine.parseInfo("info depth 10 score cp 350 lowerbound pv e2e4",old));
        var mate=UciEngine.parseInfo("info depth 18 score mate 3 pv d8h4",old);
        assertEquals(Integer.valueOf(3),mate.mate()); assertEquals(18,mate.depth());
    }
    @Test public void realStockfishSearchCancelAndRestart() throws Exception {
        String binary=System.getenv("AKSARA_STOCKFISH_HOST"); Assume.assumeNotNull(binary);
        ChessSession s=new ChessSession();
        try(var engine=new UciEngine(new ProcessBuilder(binary).redirectErrorStream(true).start(),2,256)) {
            var answer=engine.search(s,200).get(20,TimeUnit.SECONDS);
            assertTrue(s.legalMoves().contains(answer.move()));
            assertTrue(s.applyEngine(answer.revision(),answer.fen(),answer.move()));
            assertTrue(engine.commands().contains("setoption name UCI_LimitStrength value false"));
            var cancelled=engine.search(s,5000);
            long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(5);
            while(!engine.commands().contains("go movetime 5000") && System.nanoTime()<deadline) Thread.yield();
            assertTrue("Search must start before cancellation",engine.commands().contains("go movetime 5000"));
            engine.cancel();
            try { cancelled.get(10,TimeUnit.SECONDS); fail("cancel must invalidate result"); }
            catch(CancellationException|ExecutionException expected) { }
            var next=engine.search(s,100).get(15,TimeUnit.SECONDS);
            assertTrue(s.legalMoves().contains(next.move()));
        }
    }
}
