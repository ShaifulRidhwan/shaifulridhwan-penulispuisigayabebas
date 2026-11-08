package my.aksara.nativeapp.feature.tools

import android.content.Context
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.unit.dp
import my.aksara.nativeapp.core.design.*
import java.io.ByteArrayInputStream

/** Browser runtime kept local to the Code Engine panel, never a wrapper for the app. */
object CodeEngineWebRuntime {
    private const val scriptTag="<script src=\"bilik-antara-code-runtime.js?v=5\"></script>"
    fun loadBundledPage(context:Context):String {
        val html=context.assets.open("aksara-code-engine.html").bufferedReader().use { it.readText() }
        val script=context.assets.open("aksara-code-runtime.js").bufferedReader().use { it.readText() }
        require(html.contains(scriptTag)){"Versi runtime HTML dan JavaScript tidak sepadan."}
        require(!script.contains("</script>",ignoreCase=true)){"Runtime tidak selamat untuk diselitkan."}
        return html.replace(scriptTag,"<script>\n"+script+"\n</script>")
    }
    fun create(context:Context,onReady:(()->Unit)?=null):WebView=WebView(context).apply {
        settings.apply {
            javaScriptEnabled=true // Required by actual JS/WebAssembly code engine.
            domStorageEnabled=false
            allowFileAccess=false
            allowContentAccess=false
            javaScriptCanOpenWindowsAutomatically=false
            setSupportMultipleWindows(false)
            mixedContentMode=WebSettings.MIXED_CONTENT_NEVER_ALLOW
            safeBrowsingEnabled=true
        }
        webViewClient=object:WebViewClient() {
            override fun shouldOverrideUrlLoading(view:WebView,request:WebResourceRequest):Boolean =
                request.isForMainFrame // Never navigate the app into the browser page.
            override fun shouldInterceptRequest(view:WebView?,request:WebResourceRequest?):WebResourceResponse? {
                val uri=request?.url?:return blocked()
                if(uri.scheme in listOf("blob","data","about"))return null
                // The shipped browser engine fetches actual Python/TS/SQLite/Clang WASM only here.
                if(uri.scheme=="https"&&uri.host=="cdn.jsdelivr.net")return null
                return blocked()
            }
            override fun onPageFinished(view:WebView?,url:String?){super.onPageFinished(view,url);onReady?.invoke()}
        }
        loadDataWithBaseURL("https://aksara-runtime.invalid/",loadBundledPage(context),"text/html","UTF-8",null)
    }
    private fun blocked()=WebResourceResponse("text/plain","UTF-8",ByteArrayInputStream(ByteArray(0)))
}

@Composable fun ColumnScope.CodeEngineContent(onNavigate:(String)->Unit){
    var webMode by rememberSaveable {mutableStateOf(false)}
    if(!webMode){
        RuntimeHealthContent(onNavigate)
        Spacer(Modifier.height(9.dp))
        AksaraButton("Buka 5 Runtime Web · JS / Python / TS / SQL / C++20",
            {webMode=true},Modifier.fillMaxWidth())
    }else{
        AksaraButton("Kembali ke Runtime Native",{webMode=false},Modifier.fillMaxWidth())
        Spacer(Modifier.height(8.dp))
        AksaraText("Sandbox browser terasing. Python, TypeScript, SQLite dan Clang memerlukan CDN untuk komponen WebAssembly.",size=10.5f,color=AksaraColors.muted)
        Spacer(Modifier.height(8.dp))
        CodeWebView(Modifier.fillMaxWidth().weight(1f))
    }
}
@Composable private fun CodeWebView(modifier:Modifier) {
    val context=LocalContext.current
    val web=remember(context){CodeEngineWebRuntime.create(context)}
    DisposableEffect(web){onDispose{
        web.stopLoading()
        (web.parent as? android.view.ViewGroup)?.removeView(web)
        web.destroy()
    }}
    AndroidView(factory={web},modifier=modifier)
}
