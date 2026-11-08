package my.aksara.nativeapp.core.network

import java.io.IOException
import java.net.ConnectException
import java.net.NoRouteToHostException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import my.aksara.nativeapp.BuildConfig

/** Netlify is the production backend; no automatic Cloudflare fallback. */
object BackendRoutes {
    const val PRODUCTION = "https://shaifulridhwan-penulispuisigayabebas.netlify.app"
    const val CHAT = "/.netlify/functions/bilik-antara"
    const val STREAM = "/.netlify/functions/bilik-antara-stream"
    const val LIVE_TOKEN = "/.netlify/functions/bilik-antara-live-token"
    const val STUDIO_IMAGE = "/.netlify/functions/studio-image"
    const val STUDIO_ENHANCE = "/.netlify/functions/studio-enhance"
    val configuredOrigin: String get() = BuildConfig.API_ORIGIN
}
object BackendNetworkErrors {
    fun transportFailed(error: Throwable): Boolean {
        var cause: Throwable? = error
        repeat(8) {
            if(cause==null)return false
            if(cause is UnknownHostException || cause is ConnectException ||
                cause is NoRouteToHostException || cause is SocketTimeoutException)return true
            cause=cause?.cause
        }
        return false
    }
    fun translate(error: Throwable, origin: String): Throwable {
        if(error is ApiFailure || !transportFailed(error))return error
        val host=runCatching{java.net.URI(origin).host}.getOrNull()?:"production backend"
        return IOException("Backend unreachable ("+host+"). Semak internet/DNS dan cuba semula.",error)
    }
}
