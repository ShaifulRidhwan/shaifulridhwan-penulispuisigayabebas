package my.aksara.nativeapp

import android.os.Bundle
import android.util.Log
import android.view.ViewGroup
import android.webkit.*
import android.widget.*
import androidx.activity.ComponentActivity
import androidx.core.view.*
import androidx.webkit.WebViewAssetLoader
import java.io.ByteArrayInputStream

/** Isolated landscape host. MainActivity and its ViewModel remain on the back stack. */
class GameActivity : ComponentActivity() {
    lateinit var gameWebView: WebView
        private set
    private lateinit var root: FrameLayout
    private var destroyed=false
    private var webAlive=false
    override fun onCreate(savedInstanceState:Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window,false)
        WindowCompat.getInsetsController(window,window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior=WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
        root=FrameLayout(this)
        root.setBackgroundColor(android.graphics.Color.rgb(8,12,25))
        setContentView(root)
        loadGame(intent.getBooleanExtra("forceCanvas",false))
    }
    private fun loadGame(canvas:Boolean) {
        val previousAlive=webAlive
        webAlive=false
        if(previousAlive) { (gameWebView.parent as? ViewGroup)?.removeView(gameWebView); gameWebView.destroy() }

        root.removeAllViews()
        val loader=WebViewAssetLoader.Builder().addPathHandler("/assets/",WebViewAssetLoader.AssetsPathHandler(this)).build()
        gameWebView=WebView(this).apply {
            id=android.view.View.generateViewId()
            settings.javaScriptEnabled=true
            settings.allowFileAccess=false
            settings.allowContentAccess=false
            settings.domStorageEnabled=false
            settings.mixedContentMode=WebSettings.MIXED_CONTENT_NEVER_ALLOW
            webChromeClient=object:WebChromeClient(){
                override fun onConsoleMessage(m:ConsoleMessage):Boolean {
                    Log.println(if(m.messageLevel()==ConsoleMessage.MessageLevel.ERROR)Log.ERROR else Log.INFO,"AksaraGame", "${m.sourceId()}:${m.lineNumber()} ${m.message()}")
                    return true
                }
            }
            webViewClient=object:WebViewClient(){
                override fun shouldOverrideUrlLoading(view:WebView,request:WebResourceRequest):Boolean {
                    if(request.url.toString()=="https://appassets.androidplatform.net/exit")finish()
                    return true
                }
                override fun shouldInterceptRequest(view:WebView,request:WebResourceRequest):WebResourceResponse =
                    loader.shouldInterceptRequest(request.url)?:WebResourceResponse("text/plain","UTF-8",ByteArrayInputStream(ByteArray(0)))
                override fun onReceivedError(view:WebView,request:WebResourceRequest,error:WebResourceError){
                    Log.e("AksaraGame","WebView ${request.url}: ${error.description}")
                    if(request.isForMainFrame)runOnUiThread{showRecovery("Fail permainan tidak dapat dimuatkan.")}
                }
                override fun onRenderProcessGone(view:WebView,detail:RenderProcessGoneDetail):Boolean {
                    Log.e("AksaraGame","Renderer gone, crashed=${detail.didCrash()}")
                    webAlive=false
                    root.removeView(view)
                    view.destroy()
                    runOnUiThread{showRecovery("Renderer terhenti. Cuba Canvas atau kembali ke Aksara.")}
                    return true
                }
            }
            addOnLayoutChangeListener{_,l,t,r,b,_,_,_,_->Log.i("AksaraGame","viewport ${r-l}x${b-t}")}
        }
        webAlive=true
        root.addView(gameWebView,FrameLayout.LayoutParams(-1,-1))
        gameWebView.loadUrl("https://appassets.androidplatform.net/assets/game/index.html"+if(canvas)"?renderer=canvas" else "")
    }
    private fun showRecovery(message:String) {
        if(destroyed)return
        val box=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(32,32,32,32);setBackgroundColor(0xff101725.toInt())}
        box.addView(TextView(this).apply{text=message;setTextColor(-1)})
        box.addView(Button(this).apply{text="Cuba Canvas";setOnClickListener{loadGame(true)}})
        box.addView(Button(this).apply{text="Kembali ke Aksara";setOnClickListener{finish()}})
        root.addView(box,FrameLayout.LayoutParams(-1,-2))
    }
    override fun onPause(){if(webAlive){gameWebView.evaluateJavascript("window.aksaraPause && window.aksaraPause()",null);gameWebView.onPause()};super.onPause()}
    override fun onResume(){super.onResume();if(webAlive)gameWebView.onResume()}
    override fun onDestroy(){destroyed=true;if(webAlive){root.removeView(gameWebView);gameWebView.stopLoading();gameWebView.destroy();webAlive=false};super.onDestroy()}
}
