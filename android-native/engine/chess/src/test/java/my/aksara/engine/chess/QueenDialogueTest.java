package my.aksara.engine.chess;
import org.junit.Test;
import static org.junit.Assert.*;
import java.util.List;
public class QueenDialogueTest {
    @Test public void ordinaryMovesStaySilentAndDoNotInventBlunders() {
        var planner=new QueenDialogue();var game=new ChessSession();
        assertNull(planner.plan(game,"quiet",null,0));
        assertNull(planner.plan(game,"quiet",new UciEngine.Analysis(5,800,null,List.of()),1000));
    }
    @Test public void mateRequiresCompletedDeepAnalysis() {
        var game=new ChessSession();var p=new QueenDialogue();
        assertNull(p.plan(game,"quiet",new UciEngine.Analysis(3,null,2,List.of()),0));
        var line=p.plan(game,"quiet",new UciEngine.Analysis(18,null,2,List.of()),1);
        assertNotNull(line);assertTrue(line.text().contains("2 langkah"));
    }
    @Test public void criticalEventsOverrideCooldownAndEndingUsesRealResult() {
        var game=new ChessSession();var p=new QueenDialogue();
        assertNotNull(p.plan(game,"opening",null,0));
        assertNull(p.plan(game,"capture",null,1000));
        for(String m:List.of("f2f3","e7e5","g2g4","d8h4"))game.play(m);
        assertEquals(5,p.plan(game,"mate",null,1001).priority());
    }
}
