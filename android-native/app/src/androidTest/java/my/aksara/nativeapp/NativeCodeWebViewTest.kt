package my.aksara.nativeapp

import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.view.ViewGroup
import android.widget.FrameLayout
import android.webkit.WebView
import androidx.test.platform.app.InstrumentationRegistry
import my.aksara.nativeapp.feature.tools.CodeEngineWebRuntime
import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

/** Runs the bundled real JavaScript Web Worker in a sandboxed Android WebView. */
class NativeCodeWebViewTest {
    @Test fun bundledBrowserJavaScriptActuallyExecutes(){
        val instrument=InstrumentationRegistry.getInstrumentation()
        val activity=instrument.startActivitySync(
            Intent(instrument.targetContext,MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ) as MainActivity
        val completed=CountDownLatch(1)
        val outcome=AtomicReference("No result")
        lateinit var web:WebView
        instrument.runOnMainSync {
            web=CodeEngineWebRuntime.create(activity) {
                web.evaluateJavascript(
                    "(async function(){try{const r=await AksaraCodeRuntime.run('javascript','console.log(6*7)');document.title='AKSARA_RESULT:'+r.output;}catch(e){document.title='AKSARA_ERROR:'+String(e.message||e);}})();",
                    null
                )
                val ui=Handler(Looper.getMainLooper())
                val poll=object:Runnable {
                    override fun run(){
                        web.evaluateJavascript("document.title"){title->
                            if(title.contains("AKSARA_RESULT:")||title.contains("AKSARA_ERROR:")){
                                outcome.set(title);completed.countDown()
                            } else ui.postDelayed(this,200)
                        }
                    }
                }
                ui.postDelayed(poll,300)
            }
            activity.addContentView(web,FrameLayout.LayoutParams(440,650))
        }
        try{
            assertTrue("WebView Worker did not finish: "+outcome.get(),completed.await(25000,TimeUnit.MILLISECONDS))
            assertTrue("Real JS output: "+outcome.get(),outcome.get().contains("AKSARA_RESULT:42"))
        } finally{
            instrument.runOnMainSync {
                (web.parent as? ViewGroup)?.removeView(web)
                web.destroy()
                activity.finish()
            }
        }
    }
}
