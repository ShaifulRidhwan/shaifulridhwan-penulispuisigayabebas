package my.aksara.nativeapp

import android.graphics.PointF
import android.os.SystemClock
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import my.aksara.engine.chess.ChessSession
import my.aksara.engine.chess.UciEngine
import com.github.bhlangonijr.chesslib.Side
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class ChessAndroidTest {
    private val instrumentation=InstrumentationRegistry.getInstrumentation()
    private val device=UiDevice.getInstance(instrumentation)
    private fun waitFor(timeout:Long=45000,condition:()->Boolean) {
        val deadline=SystemClock.elapsedRealtime()+timeout
        while(SystemClock.elapsedRealtime()<deadline) { if(condition())return;SystemClock.sleep(100) }
        assertTrue("Android condition timed out",condition())
    }
    @Test fun stockfish19NnueCompleteLegalMatchAndCancellation() {
        val context=instrumentation.targetContext
        val binary=File(context.applicationInfo.nativeLibraryDir,"libstockfish.so")
        assertTrue("Packaged PIE must be executable",binary.canExecute())
        val session=ChessSession()
        val report=StringBuilder("Android ${android.os.Build.VERSION.SDK_INT} ${android.os.Build.SUPPORTED_ABIS.joinToString()}\n")
        UciEngine(ProcessBuilder(binary.absolutePath).redirectErrorStream(true).start(),2,256).use { engine ->
            val initial=engine.search(session,100).get(60,TimeUnit.SECONDS)
            assertTrue(session.legalMoves().contains(initial.move()))
            assertTrue(engine.commands().contains("setoption name UCI_LimitStrength value false"))
            val cancelled=engine.search(session,5000)
            waitFor { engine.commands().contains("go movetime 5000") };engine.cancel()
            runCatching { cancelled.get(20,TimeUnit.SECONDS) }.onSuccess { fail("Cancelled search returned a result") }
            var blackMoves=0
            while(session.end()==ChessSession.End.PLAYING && blackMoves<160) {
                if(session.turn()==Side.WHITE) {
                    // Deliberately simple legal human fixture. Only Stockfish chooses Black.
                    val legal=session.legalMoves().sorted()
                    val move=if(session.history().isEmpty()) "f2f3" else if("g2g4" in legal) "g2g4" else legal.first()
                    session.play(move); report.append("White $move\n")
                } else {
                    val answer=engine.search(session,100).get(60,TimeUnit.SECONDS)
                    assertTrue("Bestmove must be legal",session.legalMoves().contains(answer.move()))
                    assertTrue(session.applyEngine(answer.revision(),answer.fen(),answer.move()))
                    assertTrue("NNUE must produce completed analysis",answer.analysis().depth()>0)
                    report.append("Black ${answer.move()} depth=${answer.analysis().depth()} cp=${answer.analysis().centipawns()} mate=${answer.analysis().mate()}\n")
                    blackMoves++
                }
            }
            assertNotEquals("Match must reach a rules-defined termination",ChessSession.End.PLAYING,session.end())
            report.append("termination=${session.end()} result=${session.result()}\n${session.pgn()}\n")
            assertEquals(session.save(),ChessSession.restore(session.save()).save())
        }
        File(context.getExternalFilesDir(null),"chess-engine-match.txt").writeText(report.toString())
    }
    @Test fun nativeTouchPlayUndoAndLifecycleRestore() {
        ActivityScenario.launch(ChessActivity::class.java).use { scenario ->
            scenario.onActivity { it.chess.restart() }
            var ready=false
            waitFor { scenario.onActivity { ready=boardReady(it) };ready }
            fun click(square:Int) {
                var p=PointF(); val offset=IntArray(2)
                scenario.onActivity { a->p=a.board.squareCenter(square);a.board.getLocationOnScreen(offset) }
                device.click((p.x+offset[0]).toInt(),(p.y+offset[1]).toInt())
            }
            instrumentation.waitForIdleSync()
            click(12)
            var selected=-1
            waitFor { scenario.onActivity {selected=it.chess.selected};selected==12 }
            click(28) // e2-e4, through actual Android touchscreen events.
            var count=0
            try {
                waitFor { scenario.onActivity {
                    count=it.chess.session.history().size
                    assertTrue("Engine failure: ${it.chess.error}",it.chess.error.isEmpty())
                };count>=2 }
            } finally {
                device.takeScreenshot(File(instrumentation.targetContext.getExternalFilesDir(null),"chess-after-tap.png"))
                scenario.onActivity { android.util.Log.i("AksaraChessTest","history=${it.chess.session.history()} selected=${it.chess.selected} activeThinking=${it.chess.thinking} error=${it.chess.error}") }
            }
            scenario.onActivity { a ->
                assertEquals("e2e4",a.chess.session.history().first())
                assertEquals(Side.WHITE,a.chess.session.turn());assertTrue(a.chess.error.isEmpty())
            }
            var saved="";scenario.onActivity{saved=it.chess.session.save()}
            scenario.recreate()
            scenario.onActivity { assertEquals(saved,it.chess.session.save());it.chess.undo();assertEquals(ChessSession.START,it.chess.session.fen()) }
            device.takeScreenshot(File(instrumentation.targetContext.getExternalFilesDir(null),"chess-android.png"))
            scenario.onActivity { it.chess.resign();assertEquals("0-1",it.chess.session.result());it.chess.restart() }
        }
    }
    private fun boardReady(a:ChessActivity)=runCatching{a.board.width>0 && a.board.height>0 && a.board.hasRendered && a.board.hasWindowFocus() && a.chess.engineStatus.contains("sedia")}.getOrDefault(false)
}
