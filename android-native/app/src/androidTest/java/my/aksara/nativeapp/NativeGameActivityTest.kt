package my.aksara.nativeapp

import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.os.SystemClock
import android.view.MotionEvent
import android.view.InputDevice
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Until
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
        fail("Timed out: $code; diagnostics="+js(a,"JSON.stringify({runtime:window.gameDiagnostics,paused:typeof paused!=='undefined'?paused:null,input:typeof controls!=='undefined'?controls.sample():null,pointers:typeof controls!=='undefined'?controls.pointers.size:null})"))
    }
    private fun heldJoystickMovement(a:GameActivity){
        val x0=js(a,"match.fighters[0].x").toDouble()
        val rect=js(a,"(()=>{const r=document.querySelector('#stick-zone').getBoundingClientRect();return [r.x+70,r.y+r.height/2,innerWidth,innerHeight].join(',')})()").trim('"').split(',').map{it.toFloat()}
        val loc=IntArray(2);instrument.runOnMainSync{a.gameWebView.getLocationOnScreen(loc)}
        val scaleX=a.gameWebView.width/rect[2];val scaleY=a.gameWebView.height/rect[3]
        val down=SystemClock.uptimeMillis()
        fun send(action:Int,dx:Float){
            val p=MotionEvent.PointerProperties().apply{id=0;toolType=MotionEvent.TOOL_TYPE_FINGER}
            val c=MotionEvent.PointerCoords().apply{x=loc[0]+(rect[0]+dx)*scaleX;y=loc[1]+rect[1]*scaleY;pressure=1f;size=1f}
            val e=MotionEvent.obtain(down,SystemClock.uptimeMillis(),action,1,arrayOf(p),arrayOf(c),0,0,1f,1f,0,0,InputDevice.SOURCE_TOUCHSCREEN,0)
            instrument.sendPointerSync(e);e.recycle()
        }
        send(MotionEvent.ACTION_DOWN,0f);send(MotionEvent.ACTION_MOVE,45f)
        try {
            waitJs(a,"controls.sample().axis===1")
            waitJs(a,"match.fighters[0].x>${x0+5}")
        } finally {send(MotionEvent.ACTION_UP,45f)}
        waitJs(a,"controls.pointers.size===0 && controls.sample().axis===0")
    }
    private fun nativeMultitouch(a:GameActivity,canvas:Boolean){
        fun center(selector:String):Pair<Float,Float>{
            val values=js(a,"(()=>{const r=document.querySelector('$selector').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2,innerWidth,innerHeight].join(',')})()").trim('"').split(',').map{it.toFloat()}
            val loc=IntArray(2);instrument.runOnMainSync{a.gameWebView.getLocationOnScreen(loc)}
            return Pair(loc[0]+values[0]/values[2]*a.gameWebView.width,loc[1]+values[1]/values[3]*a.gameWebView.height)
        }
        val pts=listOf(center("#stick-zone"),center("[data-action=jump]"),center("[data-action=light]"),center("[data-action=heavy]"))
        val scale=a.gameWebView.width/js(a,"innerWidth").toFloat()
        val down=SystemClock.uptimeMillis()
        fun send(action:Int,indices:List<Int>,move:Boolean=false){
            val props=indices.map{n->MotionEvent.PointerProperties().apply{id=n+3;toolType=MotionEvent.TOOL_TYPE_FINGER}}.toTypedArray()
            val coords=indices.map{n->MotionEvent.PointerCoords().apply{x=pts[n].first+if(n==0&&move)45*scale else 0f;y=pts[n].second;pressure=1f;size=1f}}.toTypedArray()
            val event=MotionEvent.obtain(down,SystemClock.uptimeMillis(),action,indices.size,props,coords,0,0,1f,1f,0,0,InputDevice.SOURCE_TOUCHSCREEN,0)
            instrument.sendPointerSync(event);event.recycle()
        }
        send(MotionEvent.ACTION_DOWN,listOf(0))
        for(n in 1..3)send(MotionEvent.ACTION_POINTER_DOWN or (n shl MotionEvent.ACTION_POINTER_INDEX_SHIFT),(0..n).toList())
        send(MotionEvent.ACTION_MOVE,listOf(0,1,2,3),true)
        waitJs(a,"controls.pointers.size===4 && controls.sample().jump && controls.sample().axis===1")
        UiDevice.getInstance(instrument).takeScreenshot(java.io.File(instrument.targetContext.getExternalFilesDir(null),"game-${if(canvas)"canvas" else "auto"}-touch.png"))
        send(MotionEvent.ACTION_POINTER_UP or (2 shl MotionEvent.ACTION_POINTER_INDEX_SHIFT),listOf(0,1,2,3),true)
        waitJs(a,"controls.pointers.size===3")
        send(MotionEvent.ACTION_CANCEL,listOf(0,1,3),true)
        waitJs(a,"controls.pointers.size===0 && controls.sample().axis===0")
        send(MotionEvent.ACTION_DOWN,listOf(0))
        send(MotionEvent.ACTION_MOVE,listOf(0),true)
        js(a,"window.aksaraPause()")
        send(MotionEvent.ACTION_CANCEL,listOf(0),true)
        waitJs(a,"paused && controls.pointers.size===0 && controls.sample().axis===0")
        js(a,"document.querySelector('#start').click()")
        // Window background/foreground must clear live input and require explicit resume.
        send(MotionEvent.ACTION_DOWN,listOf(0))
        send(MotionEvent.ACTION_MOVE,listOf(0),true)
        instrument.runOnMainSync{a.moveTaskToBack(true)}
        waitJs(a,"paused && controls.pointers.size===0")
        instrument.runOnMainSync{a.startActivity(Intent(a,GameActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT))}
        instrument.waitForIdleSync()
        send(MotionEvent.ACTION_CANCEL,listOf(0),true)
        js(a,"document.querySelector('#start').click()")
    }
    @Test fun fullscreenAspectRatioMatrix() {
        val device=UiDevice.getInstance(instrument)
        val overlays=device.executeShellCommand("cmd overlay list --user 0")
        val cutout="com.android.internal.display.cutout.emulation.tall"
        val gesture="com.android.internal.systemui.navbar.gestural"
        val previousNavigation=overlays.lineSequence().firstOrNull{it.startsWith("[x]")&&it.contains("com.android.internal.systemui.navbar.")}?.substringAfter("[x] ")?.trim()
        val cutoutWasEnabled=overlays.contains("[x] $cutout")
        try {
            device.executeShellCommand("cmd overlay enable --user 0 $cutout")
            device.executeShellCommand("cmd overlay enable-exclusive --user 0 --category $gesture")
            assertTrue("Cutout emulation must be active",device.executeShellCommand("cmd overlay list --user 0").contains("[x] $cutout"))
            assertTrue("Gesture navigation must be active",device.executeShellCommand("cmd overlay list --user 0").contains("[x] $gesture"))
            for(spec in listOf("640x360","844x390","1080x486","1280x800")) {
                device.executeShellCommand("wm size $spec")
                device.executeShellCommand("wm density 160")
                ActivityScenario.launch<GameActivity>(Intent(instrument.targetContext,GameActivity::class.java)).use { scenario ->
                    lateinit var activity:GameActivity
                    scenario.onActivity{activity=it}
                    waitJs(activity,"!!window.gameDiagnostics && gameDiagnostics.ready")
                    waitJs(activity,"(()=>{const r=game.canvas.getBoundingClientRect();return Math.abs(r.width-innerWidth)<2&&Math.abs(r.height-innerHeight)<2&&Math.abs(r.x)<2&&Math.abs(r.y)<2})()")
                    assertEquals("true",js(activity,"[...document.querySelectorAll('#actions button')].every(b=>{const r=b.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&r.width>=44&&r.height>=44})"))
                    js(activity,"document.querySelector('#mode').value='training';document.querySelector('#start').click()")
                    waitJs(activity,"match.roundState==='FIGHT'")
                    heldJoystickMovement(activity)
                    device.takeScreenshot(java.io.File(instrument.targetContext.getExternalFilesDir(null),"game-matrix-$spec.png"))
                }
            }
        } finally {
            device.executeShellCommand("wm size reset");device.executeShellCommand("wm density reset")
            if(!cutoutWasEnabled)device.executeShellCommand("cmd overlay disable --user 0 $cutout")
            if(previousNavigation!=null)device.executeShellCommand("cmd overlay enable-exclusive --user 0 --category $previousNavigation")
        }
    }
    @Test fun recreationRestoresPreferencesAndClearsInterruptedInput(){
        ActivityScenario.launch(MainActivity::class.java).use { main ->
            fun openMonitor()=instrument.addMonitor(GameActivity::class.java.name,null,false)
            val first=openMonitor()
            main.onActivity{it.startActivity(Intent(it,GameActivity::class.java))}
            val old=instrument.waitForMonitorWithTimeout(first,30000) as GameActivity
            instrument.removeMonitor(first)
            waitJs(old,"!!window.gameDiagnostics && gameDiagnostics.ready")
            js(old,"controlSettings.opacity=62;saveControls();document.querySelector('#start').click();controls.down(91,'stick',100,200);controls.move(91,145,200)")
            waitJs(old,"controls.pointers.size===1")
            val next=openMonitor();instrument.runOnMainSync{old.recreate()}
            val recreated=instrument.waitForMonitorWithTimeout(next,30000) as GameActivity
            instrument.removeMonitor(next)
            try {
                waitJs(recreated,"!!window.gameDiagnostics && gameDiagnostics.ready")
                assertTrue(old.isDestroyed)
                assertEquals("true",js(recreated,"paused && controls.pointers.size===0 && controlSettings.opacity===62"))
                js(recreated,"controlSettings=AksaraInput.normalize();saveControls()")
            } finally {instrument.runOnMainSync{recreated.finish()}}
            main.onActivity{assertEquals(Configuration.ORIENTATION_PORTRAIT,it.resources.configuration.orientation)}
        }
    }
    @Test fun realPortalLaunchReturnsToUnchangedChatDraft(){
        val device=UiDevice.getInstance(instrument)
        ActivityScenario.launch(MainActivity::class.java).use { main ->
            var original:MainActivity?=null;main.onActivity{original=it}
            val draft="Draf kekal selepas game"
            val field=device.wait(Until.findObject(By.desc("Tulis mesej untuk Aksara A.I.")),30000)
            assertNotNull("Chat composer",field)
            field.text=draft
            device.wait(Until.findObject(By.desc("Ciri & Fungsi")),10000).click()
            val entry=device.wait(Until.findObject(By.text("Game · Cahaya vs Gelap")),10000)
            assertNotNull("Visible game portal entry",entry);entry.click()
            assertTrue("Fullscreen game WebView must open",device.wait(Until.hasObject(By.clazz("android.webkit.WebView")),30000))
            assertTrue("Landscape window",device.displayWidth>device.displayHeight)
            device.pressBack()
            val returned=device.wait(Until.findObject(By.desc("Tulis mesej untuk Aksara A.I.")),15000)
            assertNotNull("Return to Chat",returned);assertEquals(draft,returned.text)
            main.onActivity{assertSame(original,it);assertEquals(Configuration.ORIENTATION_PORTRAIT,it.resources.configuration.orientation)}
        }
    }
    @Test fun webglAndCanvasRenderCombatTouchRotationAndBackToChat(){
        val device=UiDevice.getInstance(instrument)
        ActivityScenario.launch(MainActivity::class.java).use { main ->
            var chat:MainActivity?=null
            main.onActivity{chat=it}
            for(canvas in listOf(false,true)){
                val intent=Intent(instrument.targetContext,GameActivity::class.java).putExtra("forceCanvas",canvas)
                // ActivityScenario.launch(GameActivity) clears the task and destroys Chat.
                // Launch exactly as the production Portal does, within MainActivity's task.
                val monitor=instrument.addMonitor(GameActivity::class.java.name,null,false)
                main.onActivity{it.startActivity(intent)}
                val launched=instrument.waitForMonitorWithTimeout(monitor,30000)
                instrument.removeMonitor(monitor)
                assertNotNull("Game activity launched in Chat task",launched)
                val a=launched as GameActivity
                try {
                    waitJs(a,"!!window.gameDiagnostics && gameDiagnostics.ready && gameDiagnostics.frames>3 && gameDiagnostics.width>0 && gameDiagnostics.height>0")
                    assertEquals(Configuration.ORIENTATION_LANDSCAPE,a.resources.configuration.orientation)
                    if(canvas){
                        assertEquals("\"canvas\"",js(a,"gameDiagnostics.renderer"))
                        assertEquals("true",js(a,"scene.presentation.sprites.every(s=>s.texture.key==='warriors'&&s.visible) && game.canvas.getContext('2d').getImageData(200,280,200,150).data.some(v=>v>0)"))
                    }
                    js(a,"document.querySelector('#start').click()")
                    waitJs(a,"!paused && match.elapsed>0.1 && document.querySelector('#menu').style.display==='none'")
                    heldJoystickMovement(a)
                    nativeMultitouch(a,canvas)
                    js(a,"gameDiagnostics.performance=null")
                    waitJs(a,"!!gameDiagnostics.performance")
                    android.util.Log.i("AksaraGame","ECLIPSE_METRICS "+js(a,"JSON.stringify(gameDiagnostics)")+" appPssKiB="+android.os.Debug.getPss())
                    val frames=js(a,"gameDiagnostics.frames").toInt()
                    instrument.runOnMainSync{a.requestedOrientation=ActivityInfo.SCREEN_ORIENTATION_REVERSE_LANDSCAPE}
                    waitJs(a,"gameDiagnostics.frames>${frames+2}")
                    assertFalse(a.isDestroyed)
                    device.takeScreenshot(java.io.File(instrument.targetContext.getExternalFilesDir(null),"game-${if(canvas)"canvas" else "auto"}.png"))
                    js(a,"window.aksaraPause()")
                    assertEquals("true",js(a,"paused"))
                    if(!canvas){
                        js(a,"window.gameFailure('Ujian pemulihan runtime')")
                        assertEquals("true",js(a,"paused && controls.pointers.size===0 && !gameDiagnostics.ready"))
                        js(a,"document.querySelector('#start').click()")
                        waitJs(a,"!!window.gameDiagnostics && gameDiagnostics.ready && gameDiagnostics.renderer==='canvas' && location.search==='?renderer=canvas'")
                    }
                    device.pressBack()
                } finally {
                    instrument.runOnMainSync{if(!a.isFinishing&&!a.isDestroyed)a.finish()}
                }
                main.onActivity{assertSame("Chat activity should survive game rotation",chat,it);assertEquals(Configuration.ORIENTATION_PORTRAIT,it.resources.configuration.orientation)}
            }
        }
    }
}
