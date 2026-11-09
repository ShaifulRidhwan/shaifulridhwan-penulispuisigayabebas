package my.aksara.nativeapp.feature.tools

import android.app.Activity
import android.content.pm.ActivityInfo
import android.webkit.*
import androidx.webkit.WebViewAssetLoader
import androidx.compose.runtime.*
import androidx.compose.foundation.layout.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import my.aksara.nativeapp.core.design.*
import java.io.ByteArrayInputStream

@Composable fun GameContent(onClose:()->Unit) {
    val context=LocalContext.current
    val owner=LocalLifecycleOwner.current
    val web=remember(context){
        val loader=WebViewAssetLoader.Builder().addPathHandler("/assets/",WebViewAssetLoader.AssetsPathHandler(context)).build()
        WebView(context).apply {
            settings.javaScriptEnabled=true
            settings.allowFileAccess=false
            settings.allowContentAccess=false
            settings.domStorageEnabled=false
            settings.mixedContentMode=WebSettings.MIXED_CONTENT_NEVER_ALLOW
            webViewClient=object:WebViewClient(){
                override fun shouldOverrideUrlLoading(view:WebView,request:WebResourceRequest)=true
                override fun shouldInterceptRequest(view:WebView,request:WebResourceRequest):WebResourceResponse =
                    loader.shouldInterceptRequest(request.url)?:WebResourceResponse("text/plain","UTF-8",ByteArrayInputStream(ByteArray(0)))
            }
            loadUrl("https://appassets.androidplatform.net/assets/game/index.html")
        }
    }
    DisposableEffect(web,owner){
        val activity=context as? Activity
        val previous=activity?.requestedOrientation
        activity?.requestedOrientation=ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        val observer=LifecycleEventObserver{_,event->when(event){
            Lifecycle.Event.ON_PAUSE->{web.evaluateJavascript("window.aksaraPause?.()",null);web.onPause()}
            Lifecycle.Event.ON_RESUME->web.onResume()
            else->Unit
        }}
        owner.lifecycle.addObserver(observer)
        onDispose {owner.lifecycle.removeObserver(observer);if(previous!=null)activity?.requestedOrientation=previous;web.stopLoading();web.loadUrl("about:blank");web.removeAllViews();web.destroy()}
    }
    Column(Modifier.fillMaxSize().padding(8.dp)){
        AksaraButton("‹ Kembali ke Aksara",onClose,Modifier.height(40.dp))
        AndroidView(factory={web},modifier=Modifier.fillMaxWidth().weight(1f))
    }
}
