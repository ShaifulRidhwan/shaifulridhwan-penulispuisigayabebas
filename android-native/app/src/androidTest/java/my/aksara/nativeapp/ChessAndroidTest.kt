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
            try {
            var ready=false
            waitFor {
                device.findObject(androidx.test.uiautomator.By.text("Got it"))?.click()
                scenario.onActivity { ready=boardReady(it) };ready
            }
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
            scenario.onActivity{it.chess.stopEngineForTest()}
            scenario.recreate()
            scenario.onActivity { it.requestedOrientation=android.content.pm.ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE }
            waitFor {var landscape=false;scenario.onActivity{landscape=runCatching{it.resources.configuration.orientation==android.content.res.Configuration.ORIENTATION_LANDSCAPE && it.board.hasRendered && it.board.height==it.window.decorView.height}.getOrDefault(false)};landscape}
            device.waitForIdle(3000)
            device.takeScreenshot(File(instrumentation.targetContext.getExternalFilesDir(null),"chess-landscape.png"))
            scenario.onActivity {assertEquals(saved,it.chess.session.save());it.requestedOrientation=android.content.pm.ActivityInfo.SCREEN_ORIENTATION_PORTRAIT}
            waitFor {var portrait=false;scenario.onActivity{portrait=runCatching{it.resources.configuration.orientation==android.content.res.Configuration.ORIENTATION_PORTRAIT && it.board.hasRendered && it.board.width==it.window.decorView.width}.getOrDefault(false)};portrait}
            scenario.onActivity { assertEquals(saved,it.chess.session.save());it.chess.undo();assertEquals(ChessSession.START,it.chess.session.fen()) }
            device.waitForIdle(3000)
            device.takeScreenshot(File(instrumentation.targetContext.getExternalFilesDir(null),"chess-android.png"))
            click(12);click(28)
            waitFor {scenario.onActivity{count=it.chess.session.history().size};count==2}
            scenario.onActivity { it.chess.resign();assertEquals("0-1",it.chess.session.result());it.chess.restart() }
            } finally {
                val dir=instrumentation.targetContext.getExternalFilesDir(null)
                device.takeScreenshot(File(dir,"chess-window-final.png"))
                scenario.onActivity { a ->
                    val report=runCatching {"size=${a.board.width}x${a.board.height} rendered=${a.board.hasRendered} focus=${a.board.hasWindowFocus()} shown=${a.board.isShown} window=${a.board.windowVisibility} engine=${a.chess.engineStatus} error=${a.chess.error} history=${a.chess.session.history()} selected=${a.chess.selected}"}.getOrElse{it.toString()}
                    android.util.Log.i("AksaraChessTest",report)
                    File(dir,"chess-ui-state.txt").writeText(report)
                    File(dir,"chess-voice-status.txt").writeText(a.voiceDebugState())
                }
                File(dir,"chess-gfxinfo.txt").writeText(device.executeShellCommand("dumpsys gfxinfo my.aksara.nativeapp framestats"))
                File(dir,"chess-meminfo.txt").writeText(device.executeShellCommand("dumpsys meminfo my.aksara.nativeapp"))
                File(dir,"chess-processes.txt").writeText(device.executeShellCommand("ps -A -o PID,PPID,RSS,NAME"))
            }
        }
    }
    @Test fun specialRulesReplayAndUndoDuringAnimation() {
        ActivityScenario.launch(ChessActivity::class.java).use { scenario ->
            fun ready() {var ok=false;waitFor{device.findObject(androidx.test.uiautomator.By.text("Got it"))?.click();scenario.onActivity{ok=boardReady(it)};ok}}
            fun load(fen:String){scenario.onActivity{it.chess.loadForTest(fen)};instrumentation.waitForIdleSync();ready()}
            fun click(square:Int){var p=PointF();val offset=IntArray(2);scenario.onActivity{p=it.board.squareCenter(square);it.board.getLocationOnScreen(offset)};device.click((p.x+offset[0]).toInt(),(p.y+offset[1]).toInt())}
            fun move(from:Int,to:Int){click(from);var selected=-1;waitFor{scenario.onActivity{selected=it.chess.selected};selected==from};click(to)}
            try {
                ready()
                load("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1")
                move(4,6)
                var castled=false
                waitFor{scenario.onActivity{castled=it.chess.session.pieces()[6]=="K" && it.chess.session.pieces()[5]=="R"};castled}
                load("k7/8/8/3pP3/8/8/8/4K3 w - d6 0 1")
                move(36,43)
                var ep=false;waitFor{scenario.onActivity{ep=it.chess.session.pieces()[43]=="P" && it.chess.session.pieces()[35].isEmpty()};ep}
                load("7k/P7/8/8/8/8/8/4K3 w - - 0 1")
                move(48,56)
                val knight=device.wait(androidx.test.uiautomator.Until.findObject(androidx.test.uiautomator.By.text("Knight")),10000)
                assertNotNull("Promotion selector must offer Knight",knight);knight.click()
                var promoted=false;waitFor{scenario.onActivity{promoted=it.chess.session.pieces()[56]=="N"};promoted}
                load("7k/6pp/5KQ1/8/8/8/8/8 w - - 0 1")
                move(46,54)
                var mate=false;waitFor{scenario.onActivity{mate=it.chess.session.end()==ChessSession.End.CHECKMATE};mate}
                scenario.onActivity{assertEquals("1-0",it.chess.session.result());it.chess.replayStep(0)}
                var replay=-1;waitFor{scenario.onActivity{replay=it.chess.replayIndex};replay==0}
                scenario.onActivity{it.chess.replayStep(1)};waitFor{scenario.onActivity{replay=it.chess.replayIndex};replay==1}
                scenario.onActivity{assertEquals(ChessSession.End.CHECKMATE,it.chess.session.end());it.chess.replayStep(0);it.chess.exitReplay()}
                SystemClock.sleep(300)
                scenario.onActivity{assertEquals("Pending replay must not resurrect after exit",-1,it.chess.replayIndex);it.chess.restart()}
                load("rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2")
                waitFor{scenario.onActivity{mate=it.chess.session.end()==ChessSession.End.CHECKMATE};mate}
                scenario.onActivity{assertEquals("0-1",it.chess.session.result());assertEquals("d8h4",it.chess.session.history().last())}
                SystemClock.sleep(250)
                device.takeScreenshot(File(instrumentation.targetContext.getExternalFilesDir(null),"chess-dark-queen-mate.png"))
                scenario.onActivity{it.chess.restart()}
                ready()
                val undo=device.findObject(androidx.test.uiautomator.By.text("Undo"));assertNotNull(undo)
                val undoCenter=undo.visibleCenter
                move(1,18) // Native knight animation must not block Undo.
                var moved=false;waitFor{scenario.onActivity{moved=it.chess.session.history().isNotEmpty()};moved}
                var animating=false
                waitFor(3000){scenario.onActivity{animating=(it.board as my.aksara.nativeapp.feature.chess.ArenaBoardView).isAnimating};animating}
                device.click(undoCenter.x,undoCenter.y)
                var restored=false;waitFor{scenario.onActivity{restored=it.chess.session.fen()==ChessSession.START};restored}
                SystemClock.sleep(3000)
                scenario.onActivity{assertEquals("Stale engine result after Undo",ChessSession.START,it.chess.session.fen());assertTrue(it.chess.error.isEmpty())}
            } finally {
                val dir=instrumentation.targetContext.getExternalFilesDir(null)
                device.takeScreenshot(File(dir,"chess-premium-special-rules.png"))
                File(dir,"chess-premium-gfxinfo.txt").writeText(device.executeShellCommand("dumpsys gfxinfo my.aksara.nativeapp framestats"))
            }
        }
    }
    @Test fun rendererCacheBenchmarkUsesActualAndroidFrames() {
        ActivityScenario.launch(ChessActivity::class.java).use { scenario ->
            var arena:my.aksara.nativeapp.feature.chess.ArenaBoardView?=null
            scenario.onActivity { a ->
                a.chess.restart()
                arena=my.aksara.nativeapp.feature.chess.ArenaBoardView(a)
                a.setContentView(arena)
            }
            waitFor {device.findObject(androidx.test.uiautomator.By.text("Got it"))?.click();var ready=false;scenario.onActivity{ready=arena?.hasRendered==true && arena?.hasWindowFocus()==true};ready}
            // This is a renderer replay fixture, never a substitute for the real-engine match.
            val fixture=listOf("e2e4","e7e5","g1f3","b8c6","f1c4","g8f6","d2d3","f8c5","e1g1","e8g8","b1c3","d7d6","c1g5","h7h6","g5h4","g7g5")
            val dir=instrumentation.targetContext.getExternalFilesDir(null)
            for(disabled in listOf(true,false)) {
                val position=ChessSession()
                scenario.onActivity{arena!!.disableRenderCachesForBenchmark=disabled;arena!!.pieces=position.pieces();arena!!.skipAnimation()}
                SystemClock.sleep(600)
                device.executeShellCommand("dumpsys gfxinfo my.aksara.nativeapp reset")
                for((index,move) in fixture.withIndex()) {
                    val before=position.pieces();position.play(move)
                    scenario.onActivity {
                        arena!!.pieces=position.pieces();arena!!.lastMove=move
                        arena!!.check=position.inCheck();arena!!.checkKing=if(position.turn()==Side.WHITE)"K" else "k"
                        arena!!.showCommittedMove(before,move,if(disabled)1000+index else 2000+index,false)
                    }
                    SystemClock.sleep(560)
                }
                val label=if(disabled)"uncached" else "cached"
                File(dir,"chess-renderer-$label-frames.txt").writeText(device.executeShellCommand("dumpsys gfxinfo my.aksara.nativeapp framestats"))
                File(dir,"chess-renderer-$label-memory.txt").writeText(device.executeShellCommand("dumpsys meminfo my.aksara.nativeapp"))
                device.takeScreenshot(File(dir,"chess-renderer-$label.png"))
            }
            scenario.onActivity {a ->
                val evidence=a.voiceDebugState();File(dir,"chess-voice-playback.txt").writeText(evidence)
                if(evidence.contains("available=true")) {
                    val started=Regex("started=(\\d+)").find(evidence)?.groupValues?.get(1)?.toInt()?:0
                    val done=Regex("completed=(\\d+)").find(evidence)?.groupValues?.get(1)?.toInt()?:0
                    assertTrue("Real Malay TTS must start",started>0);assertTrue("Real Malay TTS must complete",done>0)
                }
            }
            File(dir,"chess-renderer-benchmark-method.txt").writeText("Android ${android.os.Build.VERSION.SDK_INT}. ${android.os.Build.SUPPORTED_ABIS.joinToString()}. Same original materials, silhouettes, animations and legal 16-ply replay in both passes. Only static board-plane batching and path caches change. The cached plane is 1024 pixels; original textures and vector pieces retain their quality. Debug-only benchmark, not AI move selection or a physical-device FPS guarantee.")
        }
    }
    private fun boardReady(a:ChessActivity)=runCatching{a.board.width>0 && a.board.height>0 && a.board.hasRendered && a.board.hasWindowFocus() && a.chess.engineReady}.getOrDefault(false)
}
