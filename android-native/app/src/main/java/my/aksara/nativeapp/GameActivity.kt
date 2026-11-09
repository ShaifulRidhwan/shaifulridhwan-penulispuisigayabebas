package my.aksara.nativeapp

import android.os.Bundle
import android.os.Build
import android.media.AudioManager
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.view.WindowManager
import android.util.Log
import android.view.ViewGroup
import android.webkit.*
import android.widget.*
import androidx.activity.ComponentActivity
import androidx.core.view.*
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.os.SystemClock
import android.graphics.Rect
import java.io.ByteArrayInputStream

/** Isolated landscape host. MainActivity and its ViewModel remain on the back stack. */
class GameActivity : ComponentActivity() {
    lateinit var gameWebView: WebView
        private set
    private lateinit var root: FrameLayout
    private var destroyed=false
    private var webAlive=false
    private var lastHaptic=0L
    private val audioManager by lazy { getSystemService(AudioManager::class.java) }
    private val audioFocus by lazy {
        AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
            .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
            .setOnAudioFocusChangeListener { change ->
                if(change<0&&webAlive)runOnUiThread{gameWebView.evaluateJavascript("window.aksaraPause?.()",null)}
            }.build()
    }
    override fun onCreate(savedInstanceState:Bundle?) {
        super.onCreate(savedInstanceState)
        immersive()
        root=FrameLayout(this)
        root.setBackgroundColor(android.graphics.Color.rgb(8,12,25))
        setContentView(root)
        ViewCompat.setOnApplyWindowInsetsListener(root) { view,insets ->
            val safe=insets.getInsets(WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.mandatorySystemGestures())
            // Paint behind cutouts; inset controls, never the rendering surface.
            if(webAlive) {
                val density=resources.displayMetrics.density
                gameWebView.evaluateJavascript("window.aksaraInsets?.(${safe.left/density},${safe.top/density},${safe.right/density},${safe.bottom/density})",null)
            }
            insets
        }
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
            setOnTouchListener { _,event ->
                if(BuildConfig.DEBUG&&event.actionMasked!=MotionEvent.ACTION_MOVE) {
                    val ids=(0 until event.pointerCount).joinToString{event.getPointerId(it).toString()}
                    Log.d("AksaraGame","touch action=${event.actionMasked} index=${event.actionIndex} ids=$ids x=${event.x} y=${event.y}")
                }
                false // WebView retains ownership and maps native IDs to Pointer Events.
            }
            settings.javaScriptEnabled=true
            settings.allowFileAccess=false
            settings.allowContentAccess=false
            settings.domStorageEnabled=true // Local game control preferences, isolated appassets origin.
            settings.mixedContentMode=WebSettings.MIXED_CONTENT_NEVER_ALLOW
            webChromeClient=object:WebChromeClient(){
                override fun onConsoleMessage(m:ConsoleMessage):Boolean {
                    Log.println(if(m.messageLevel()==ConsoleMessage.MessageLevel.ERROR)Log.ERROR else Log.INFO,"AksaraGame", "${m.sourceId()}:${m.lineNumber()} ${m.message()}")
                    return true
                }
            }
            webViewClient=object:WebViewClient(){
                override fun onPageFinished(view:WebView,url:String){ViewCompat.requestApplyInsets(root)}
                override fun shouldOverrideUrlLoading(view:WebView,request:WebResourceRequest):Boolean {
                    val url=request.url.toString()
                    if(url=="https://appassets.androidplatform.net/exit"){finish();return true}
                    // Only the bundled game page may reload for Canvas recovery.
                    val gameUrl="https://appassets.androidplatform.net/assets/game/index.html"
                    return url!=gameUrl&&url!=gameUrl+"?renderer=canvas"
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
            addOnLayoutChangeListener{view,l,t,r,b,_,_,_,_->
                val w=r-l;val h=b-t
                val edgeHeight=minOf(h,(200*resources.displayMetrics.density).toInt())
                view.systemGestureExclusionRects=listOf(Rect(0,h-edgeHeight,w*2/5,h),Rect(w*3/5,h-edgeHeight,w,h))
                Log.i("AksaraGame","viewport ${w}x${h}")
            }
        }
        if(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(gameWebView,"AksaraAudio",setOf("https://appassets.androidplatform.net")) { _,message,_,isMainFrame,reply ->
                if(isMainFrame&&webAlive) {
                    if(message.data=="start"&&hasWindowFocus())reply.postMessage(if(audioManager.requestAudioFocus(audioFocus)==AudioManager.AUDIOFOCUS_REQUEST_GRANTED)"granted" else "denied")
                    else if(message.data=="stop")audioManager.abandonAudioFocusRequest(audioFocus)
                }
            }
            WebViewCompat.addWebMessageListener(gameWebView,"AksaraHaptics",setOf("https://appassets.androidplatform.net")) { view,message,_,isMainFrame,_ ->
                if(isMainFrame&&webAlive&&hasWindowFocus()&&SystemClock.uptimeMillis()-lastHaptic>75) {
                    val effect=when(message.data){
                        "light"->HapticFeedbackConstants.KEYBOARD_TAP
                        "heavy"->HapticFeedbackConstants.CONTEXT_CLICK
                        "jump"->HapticFeedbackConstants.CLOCK_TICK
                        "special"->HapticFeedbackConstants.CONFIRM
                        else->null
                    }
                    if(effect!=null){
                        lastHaptic=SystemClock.uptimeMillis()
                        val accepted=view.performHapticFeedback(effect)
                        Log.i("AksaraGame","haptic ${message.data} nativeAccepted=$accepted")
                    }
                }
            }
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
    private fun immersive() {
        WindowCompat.setDecorFitsSystemWindows(window,false)
        if(Build.VERSION.SDK_INT>=28) window.attributes=window.attributes.apply {
            layoutInDisplayCutoutMode=WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }
        WindowCompat.getInsetsController(window,window.decorView).apply {
            systemBarsBehavior=WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            hide(WindowInsetsCompat.Type.systemBars())
        }
    }
    override fun onWindowFocusChanged(hasFocus:Boolean){super.onWindowFocusChanged(hasFocus);if(hasFocus)immersive()}
    override fun onPause(){audioManager.abandonAudioFocusRequest(audioFocus);if(webAlive){gameWebView.evaluateJavascript("window.aksaraPause && window.aksaraPause()",null);gameWebView.onPause()};super.onPause()}
    override fun onResume(){super.onResume();immersive();if(webAlive)gameWebView.onResume()}
    override fun onDestroy(){audioManager.abandonAudioFocusRequest(audioFocus);destroyed=true;if(webAlive){root.removeView(gameWebView);gameWebView.stopLoading();gameWebView.destroy();webAlive=false};super.onDestroy()}
}
