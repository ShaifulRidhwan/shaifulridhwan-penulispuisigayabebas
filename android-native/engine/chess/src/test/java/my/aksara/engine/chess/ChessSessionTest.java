package my.aksara.engine.chess;
import org.junit.Test;
import static org.junit.Assert.*;
import com.github.bhlangonijr.chesslib.*;
import com.github.bhlangonijr.chesslib.move.Move;

public class ChessSessionTest {
    long perft(Board b,int depth) {
        if(depth==0) return 1;
        long nodes=0;
        for(Move m:b.legalMoves()) { assertTrue(b.doMove(m,true)); nodes+=perft(b,depth-1); b.undoMove(); }
        return nodes;
    }
    @Test public void androidBoardSnapshotHasNoGhostPieces() {
        ChessSession s=new ChessSession();
        assertEquals("R",s.pieces()[0]); assertEquals("r",s.pieces()[56]);
        assertEquals("",s.pieces()[28]);
        s.play("e2e4"); assertEquals("P",s.pieces()[28]); assertEquals("",s.pieces()[12]);
        assertEquals(java.util.List.of("e4"),s.sanHistory());
    }
    @Test public void startingPositionPerft() {
        Board b=new Board();
        assertEquals(20,perft(b,1)); assertEquals(400,perft(b,2));
        assertEquals(8902,perft(b,3)); assertEquals(197281,perft(b,4));
    }
    @Test public void kiwipetePerft() {
        Board b=new Board(); b.loadFromFen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1");
        assertEquals(48,perft(b,1)); assertEquals(2039,perft(b,2)); assertEquals(97862,perft(b,3));
    }
    @Test public void enPassantRookEndgamePerft() {
        Board b=new Board(); b.loadFromFen("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1");
        assertEquals(14,perft(b,1)); assertEquals(191,perft(b,2)); assertEquals(2812,perft(b,3)); assertEquals(43238,perft(b,4));
    }
    @Test public void completeFoolsMateAndPgn() {
        ChessSession s=new ChessSession();
        for(String m:new String[]{"f2f3","e7e5","g2g4","d8h4"}) s.play(m);
        assertEquals(ChessSession.End.CHECKMATE,s.end()); assertEquals("0-1",s.result());
        assertTrue(s.pgn().contains("Qh4#")); assertEquals(s.save(),ChessSession.restore(s.save()).save());
        var imported=new com.github.bhlangonijr.chesslib.pgn.PgnHolder();imported.loadPgn(s.pgn());
        assertEquals(1,imported.getGames().size());
        var parsed=imported.getGames().get(0);
        assertEquals("AKSARA Chess",parsed.getRound().getEvent().getName());
        assertEquals("0-1",parsed.getResult().getDescription());
        assertEquals(4,parsed.getHalfMoves().size());assertEquals("d8h4",parsed.getHalfMoves().get(3).toString());
        var promotion=new ChessSession("7k/P7/8/8/8/8/8/4K3 w - - 0 1");promotion.play("a7a8n");
        imported=new com.github.bhlangonijr.chesslib.pgn.PgnHolder();imported.loadPgn(promotion.pgn());
        assertEquals(promotion.initialFen(),imported.getGames().get(0).getFen());
        assertEquals("a7a8n",imported.getGames().get(0).getHalfMoves().get(0).toString());
        assertTrue(s.undo()); assertEquals(ChessSession.End.PLAYING,s.end());
    }
    @Test public void repetitionClaimAndAutomaticDraw() {
        ChessSession s=new ChessSession();
        String[] cycle={"g1f3","g8f6","f3g1","f6g8"};
        for(int i=0;i<2;i++) for(String m:cycle) s.play(m);
        assertTrue(s.canClaimDraw()); assertEquals(ChessSession.End.PLAYING,s.end());
        s=ChessSession.restore(s.save());
        for(int i=0;i<2;i++) for(String m:cycle) s.play(m);
        assertEquals(ChessSession.End.FIVEFOLD,s.end());
    }
    @Test public void intendedClaimProbeRestoresHistoryAndSpecialRights() {
        ChessSession s=new ChessSession("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 99 1");
        String saved=s.save(); assertTrue(s.canClaimWith("e1g1")); assertEquals(saved,s.save());
        s=new ChessSession();
        for(String m:new String[]{"g1f3","g8f6","f3g1","f6g8","g1f3","g8f6","f3g1"})s.play(m);
        saved=s.save(); assertTrue(s.canClaimWith("f6g8")); assertEquals(saved,s.save());
        assertFalse(s.canClaimDraw()); s.play("f6g8"); assertTrue(s.canClaimDraw());
    }
    @Test public void fiftyVersusSeventyFive() {
        ChessSession s=new ChessSession("4k3/8/8/8/8/8/8/R3K3 w - - 99 1");
        assertTrue(s.canClaimWith("a1a2")); assertFalse(s.canClaimDraw());
        s.play("a1a2"); assertTrue(s.canClaimDraw()); assertEquals(ChessSession.End.PLAYING,s.end());
        s.claimDraw(null); assertEquals("1/2-1/2",s.result());
        s=new ChessSession("4k3/8/8/8/8/8/8/R3K3 w - - 149 1"); s.play("a1a2");
        assertEquals(ChessSession.End.SEVENTY_FIVE_MOVE,s.end());
    }
    @Test public void castlingAndAttackedTransit() {
        ChessSession s=new ChessSession("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
        assertTrue(s.legalMoves().contains("e1g1")); s.play("e1c1");
        assertTrue(s.fen().contains("2KR3R")); s.undo(); assertTrue(s.fen().contains("KQkq"));
        s=new ChessSession("r3kr1r/8/8/8/8/8/8/R3K2R w KQ - 0 1");
        assertFalse(s.legalMoves().contains("e1g1"));
    }
    @Test public void pinnedEnPassantIsIllegal() {
        ChessSession s=new ChessSession("k3r3/8/8/3pP3/8/8/8/4K3 w - d6 0 1");
        assertFalse(s.legalMoves().contains("e5d6"));
        s=new ChessSession("k7/8/8/3pP3/8/8/8/4K3 w - d6 0 1"); s.play("e5d6");
        assertTrue(s.fen().startsWith("k7/8/3P4/8/"));
    }
    @Test public void allPromotionsRequireChoice() {
        ChessSession s=new ChessSession("7k/P7/8/8/8/8/8/4K3 w - - 0 1");
        for(String p:new String[]{"q","r","b","n"}) assertTrue(s.legalMoves().contains("a7a8"+p));
        assertFalse(s.legalMoves().contains("a7a8")); s.play("a7a8n"); assertEquals(ChessSession.End.DEAD_MATERIAL,s.end());
    }
    @Test public void doubleCheckAndCaptureLedgerAreBoardFacts() {
        ChessSession s=new ChessSession("k3r3/8/8/8/1b6/8/8/4K3 w - - 0 1");
        assertEquals(2,s.checkerCount());assertTrue(s.inCheck());
        s=new ChessSession("k7/8/8/3pP3/8/8/8/4K3 w - d6 0 1");s.play("e5d6");
        assertEquals(java.util.List.of("p"),s.capturedPieces());s.undo();assertTrue(s.capturedPieces().isEmpty());
    }
    @Test public void stalemateAndMaterial() {
        assertEquals(ChessSession.End.STALEMATE,new ChessSession("7k/5K2/6Q1/8/8/8/8/8 b - - 0 1").end());
        assertEquals(ChessSession.End.DEAD_MATERIAL,new ChessSession("7k/8/8/8/8/8/8/4K3 w - - 0 1").end());
        assertEquals(ChessSession.End.PLAYING,new ChessSession("6nk/8/8/8/8/8/8/4K1N1 w - - 0 1").end());
    }
    @Test public void staleEngineResultsAreRejected() {
        ChessSession s=new ChessSession(); long rev=s.revision(); String fen=s.fen();
        s.play("e2e4"); s.undo(); assertEquals(fen,s.fen());
        assertFalse(s.applyEngine(rev,fen,"d2d4"));
    }
    @Test(expected=IllegalArgumentException.class) public void illegalMoveRejected() { new ChessSession().play("e2e5"); }
    @Test public void longLegalGameRestoresAndUndoDoesNotCorruptState() {
        ChessSession s=new ChessSession(); java.util.Random fixture=new java.util.Random(19);
        int plies=0;
        while(s.end()==ChessSession.End.PLAYING && plies<500) {
            var legal=s.legalMoves();String before=s.save();String move=legal.get(fixture.nextInt(legal.size()));
            s.play(move);plies++;
            if(plies%13==0) {String after=s.save();assertTrue(s.undo());assertEquals(before,s.save());s.play(move);assertEquals(after,s.save());s=ChessSession.restore(s.save());}
        }
        assertTrue("Exercise a sustained rules session",plies>=40);
        assertEquals(s.save(),ChessSession.restore(s.save()).save());
    }
    @Test public void resignDrawAndRestore() {
        ChessSession s=new ChessSession(); s.offerDraw(); s.acceptDraw(Side.BLACK);
        assertEquals(s.save(),ChessSession.restore(s.save()).save());
        s=new ChessSession(); s.resign(Side.WHITE); assertEquals("0-1",ChessSession.restore(s.save()).result());
    }
}
