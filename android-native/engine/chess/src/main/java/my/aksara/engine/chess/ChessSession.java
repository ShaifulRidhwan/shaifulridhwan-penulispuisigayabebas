package my.aksara.engine.chess;

import com.github.bhlangonijr.chesslib.*;
import com.github.bhlangonijr.chesslib.move.*;
import java.util.*;

/** Authoritative rules state. UI and engine must submit legal UCI moves here. */
public final class ChessSession {
    public static final String START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    public enum End { PLAYING, CHECKMATE, STALEMATE, FIVEFOLD, SEVENTY_FIVE_MOVE, DEAD_MATERIAL, CLAIMED_DRAW, AGREED_DRAW, RESIGNED }
    private final Board board = new Board();
    private final String initialFen;
    private final List<Move> moves = new ArrayList<>();
    private final List<String> keys = new ArrayList<>();
    private End end = End.PLAYING;
    private Side resigned;
    private Side drawOffer;
    private long revision;

    public ChessSession() { this(START); }
    public ChessSession(String fen) {
        if (fen == null || fen.contains("\n") || fen.split(" ").length != 6) throw new IllegalArgumentException("Six-field FEN required");
        board.loadFromFen(fen);
        if (Long.bitCount(board.getBitboard(Piece.WHITE_KING)) != 1 || Long.bitCount(board.getBitboard(Piece.BLACK_KING)) != 1)
            throw new IllegalArgumentException("One king per side required");
        initialFen = board.getFen(); keys.add(key()); updateEnd();
    }
    public synchronized String[] pieces() {
        String[] result=new String[64];
        for(int i=0;i<64;i++) result[i]=board.getPiece(Square.squareAt(i))==Piece.NONE ? "" : board.getPiece(Square.squareAt(i)).getFenSymbol();
        return result;
    }
    public synchronized List<String> history() {
        return moves.stream().map(Move::toString).collect(java.util.stream.Collectors.toList());
    }
    public synchronized List<String> sanHistory() {
        MoveList list=new MoveList(initialFen); list.addAll(moves);
        return Arrays.asList(list.toSanArray());
    }
    public synchronized List<String> capturedPieces() {
        return board.getBackup().stream().map(MoveBackup::getCapturedPiece).filter(p -> p!=Piece.NONE)
            .map(Piece::getFenSymbol).collect(java.util.stream.Collectors.toList());
    }
    public String initialFen() { return initialFen; }
    public synchronized String fen() { return board.getFen(); }
    public synchronized long revision() { return revision; }
    public synchronized Side turn() { return board.getSideToMove(); }
    public synchronized End end() { return end; }
    public synchronized boolean inCheck() { return board.isKingAttacked(); }
    public synchronized List<String> legalMoves() {
        if (end != End.PLAYING) return List.of();
        return board.legalMoves().stream().map(Move::toString).collect(java.util.stream.Collectors.toList());
    }
    public synchronized void play(String uci) {
        if (end != End.PLAYING) throw new IllegalStateException("Game ended");
        Move move = board.legalMoves().stream().filter(m -> m.toString().equals(uci)).findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Illegal UCI move: " + uci));
        if (!board.doMove(move, true)) throw new IllegalStateException("Validated move rejected");
        moves.add(move); keys.add(key()); revision++; drawOffer = null; updateEnd();
    }
    /** Reject a result from any cancelled/replaced search, even if the move is legal now. */
    public synchronized boolean applyEngine(long expectedRevision, String expectedFen, String uci) {
        if (revision != expectedRevision || !fen().equals(expectedFen) || end != End.PLAYING) return false;
        play(uci); return true;
    }
    public synchronized boolean undo() {
        if (moves.isEmpty()) return false;
        board.undoMove(); moves.remove(moves.size()-1); keys.remove(keys.size()-1);
        end=End.PLAYING; resigned=null; drawOffer=null; revision++; updateEnd(); return true;
    }
    private String key() { return board.getFen(false, true); }
    private long repetitions() { return keys.stream().filter(key()::equals).count(); }
    public synchronized boolean canClaimDraw() {
        return end==End.PLAYING && (repetitions()>=3 || board.getHalfMoveCounter()>=100);
    }
    /** Includes a declared intended legal move under FIDE 9.2/9.3 without committing it. */
    public synchronized boolean canClaimWith(String uci) {
        if (end!=End.PLAYING || !legalMoves().contains(uci)) return false;
        ChessSession trial = restore(save()); trial.play(uci);
        return trial.repetitions()>=3 || trial.board.getHalfMoveCounter()>=100;
    }
    public synchronized void claimDraw(String intendedMove) {
        if (!(intendedMove==null ? canClaimDraw() : canClaimWith(intendedMove))) throw new IllegalStateException("No valid draw claim");
        end=End.CLAIMED_DRAW; revision++;
    }
    public synchronized void offerDraw() { if(end==End.PLAYING) drawOffer=turn(); }
    public synchronized void acceptDraw(Side accepting) {
        if(end!=End.PLAYING || drawOffer==null || accepting==drawOffer) throw new IllegalStateException("No opponent offer");
        end=End.AGREED_DRAW; drawOffer=null; revision++;
    }
    public synchronized void resign(Side side) {
        if(end!=End.PLAYING) throw new IllegalStateException("Game ended");
        resigned=Objects.requireNonNull(side); end=End.RESIGNED; revision++;
    }
    private void updateEnd() {
        // Checkmate takes precedence over the automatic 75-move rule.
        if(board.isMated()) end=End.CHECKMATE;
        else if(board.isStaleMate()) end=End.STALEMATE;
        else if(deadMaterial()) end=End.DEAD_MATERIAL;
        else if(repetitions()>=5) end=End.FIVEFOLD;
        else if(board.getHalfMoveCounter()>=150) end=End.SEVENTY_FIVE_MOVE;
    }
    /** Conservative proven dead-material classes; never call K+N vs K+N dead. */
    private boolean deadMaterial() {
        for(Piece p: List.of(Piece.WHITE_PAWN,Piece.BLACK_PAWN,Piece.WHITE_ROOK,Piece.BLACK_ROOK,Piece.WHITE_QUEEN,Piece.BLACK_QUEEN))
            if(board.getBitboard(p)!=0) return false;
        long bishops=board.getBitboard(Piece.WHITE_BISHOP)|board.getBitboard(Piece.BLACK_BISHOP);
        long knights=board.getBitboard(Piece.WHITE_KNIGHT)|board.getBitboard(Piece.BLACK_KNIGHT);
        if(Long.bitCount(bishops|knights)<=1) return true;
        return knights==0 && ((bishops & Bitboard.lightSquares)==0 || (bishops & Bitboard.darkSquares)==0);
    }
    public synchronized String result() {
        if(end==End.PLAYING) return "*";
        if(end==End.CHECKMATE) return turn()==Side.WHITE ? "0-1":"1-0";
        if(end==End.RESIGNED) return resigned==Side.WHITE ? "0-1":"1-0";
        return "1/2-1/2";
    }
    public synchronized String pgn() {
        MoveList list=new MoveList(initialFen); list.addAll(moves);
        String setup=initialFen.equals(START)?"":"[SetUp \"1\"]\n[FEN \""+initialFen+"\"]\n";
        return "[White \"Cahaya\"]\n[Black \"AKSARA A.I. - Queen of Darkness\"]\n[Result \""+result()+"\"]\n"+setup+"\n"+list.toSanWithMoveNumbers()+" "+result();
    }
    /** Versioned local format preserves the move history required for repetition. */
    public synchronized String save() {
        return "AKSARA_CHESS_1\n"+initialFen+"\n"+String.join(" ", moves.stream().map(Move::toString).collect(java.util.stream.Collectors.toList()))+"\n"+end+"\n"+(resigned==null?"-":resigned)+"\n"+(drawOffer==null?"-":drawOffer);
    }
    public static ChessSession restore(String saved) {
        String[] lines=saved.split("\n",-1);
        if(lines.length!=6 || !lines[0].equals("AKSARA_CHESS_1")) throw new IllegalArgumentException("Unsupported save");
        ChessSession s=new ChessSession(lines[1]);
        if(!lines[2].isEmpty()) for(String move:lines[2].split(" ")) s.play(move);
        End declared=End.valueOf(lines[3]);
        if(declared==End.RESIGNED) s.resign(Side.valueOf(lines[4]));
        else if(declared==End.CLAIMED_DRAW || declared==End.AGREED_DRAW) s.end=declared;
        else if(declared!=s.end) throw new IllegalArgumentException("Save result mismatch");
        s.drawOffer=lines[5].equals("-")?null:Side.valueOf(lines[5]);
        return s;
    }
}
