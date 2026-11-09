package my.aksara.nativeapp

import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.os.SystemClock
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

class NativeGameActivityTest {
    private val instrument=InstrumentationRegistry.getInstrumentation()
    private fun js(a:GameActivity,code:String):String {
        val result=AtomicReference("");val done=CountDownLatch(1)
        instrument.runOnMainSync{a.gameWebView.evaluateJavascript(code){result.set(it);done.countDown()}}
        assertTrue(done.await(5,TimeUnit.SECONDS));return result.get()
    }
    private fun waitJs(a:GameActivity,code:String){
        val until=SystemClock.uptimeMillis()+30000
        while(SystemClock.uptimeMillis()<until){if(js(a,code)=="true")return;SystemClock.sleep(150)}
        fail("Timed out: $code; diagnostics="+js(a,"JSON.stringify(window.gameDiagnostics)"))
    }
    @Test fun webglAndCanvasRenderCombatTouchRotationAndBackToChat(){
        val device=UiDevice.getInstance(instrument)
        ActivityScenario.launch(MainActivity::class.java).use { main ->
            var chat:MainActivity?=null
            main.onActivity{chat=it}
            for(canvas in listOf(false,true)){
                val intent=Intent(instrument.targetContext,GameActivity::class.java).putExtra("forceCanvas",canvas)
                ActivityScenario.launch<GameActivity>(intent).use { game ->
                    lateinit var a:GameActivity;game.onActivity{a=it}
                    waitJs(a,"!!window.gameDiagnostics && gameDiagnostics.ready && gameDiagnostics.frames>3 && gameDiagnostics.width>0 && gameDiagnostics.height>0")
                    assertEquals(Configuration.ORIENTATION_LANDSCAPE,a.resources.configuration.orientation)
                    if(canvas){
                        assertEquals("\"canvas\"",js(a,"gameDiagnostics.renderer"))
                        assertEquals("true",js(a,"game.canvas.getContext('2d').getImageData(260,330,1,1).data[0]>100"))
                    }
                    js(a,"document.querySelector('#start').click()")
                    waitJs(a,"!paused && match.elapsed>0.1 && document.querySelector('#menu').style.display==='none'")
                    val x0=js(a,"match.fighters[0].x").toDouble()
                    // Coordinates are derived from the real WebView/CSS viewport.
                    val xy=js(a,"(()=>{const r=document.querySelector('[data-axis=\"1\"]').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2,innerWidth,innerHeight].join(',')})()").trim('"').split(',').map{it.toDouble()}
                    val loc=IntArray(2);instrument.runOnMainSync{a.gameWebView.getLocationOnScreen(loc)}
                    val sx=loc[0]+xy[0]/xy[2]*a.gameWebView.width;val sy=loc[1]+xy[1]/xy[3]*a.gameWebView.height
                    device.swipe(sx.toInt(),sy.toInt(),sx.toInt(),sy.toInt(),35)
                    assertTrue("Touch must move fighter",js(a,"match.fighters[0].x").toDouble()>x0)
                    val frames=js(a,"gameDiagnostics.frames").toInt()
                    instrument.runOnMainSync{a.requestedOrientation=ActivityInfo.SCREEN_ORIENTATION_REVERSE_LANDSCAPE}
                    waitJs(a,"gameDiagnostics.frames>${frames+2}")
                    assertFalse(a.isDestroyed)
                    device.takeScreenshot(java.io.File(instrument.targetContext.getExternalFilesDir(null),"game-${if(canvas)"canvas" else "auto"}.png"))
                    js(a,"window.aksaraPause()")
                    assertEquals("true",js(a,"paused"))
                    device.pressBack()
                }
                main.onActivity{assertSame("Chat activity should survive game rotation",chat,it);assertEquals(Configuration.ORIENTATION_PORTRAIT,it.resources.configuration.orientation)}
            }
        }
    }
}
