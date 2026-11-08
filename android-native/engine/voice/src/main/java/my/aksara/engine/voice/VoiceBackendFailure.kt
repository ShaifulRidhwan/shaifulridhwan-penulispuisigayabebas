package my.aksara.engine.voice

import java.net.ConnectException
import java.net.NoRouteToHostException
import java.net.SocketTimeoutException
import java.net.UnknownHostException

object VoiceBackendFailure {
    fun message(error: Throwable, origin: String): String {
        var cause: Throwable? = error
        repeat(8) {
            if(cause==null)return error.message?:"Voice gagal disambungkan."
            if(cause is UnknownHostException || cause is ConnectException ||
                cause is NoRouteToHostException || cause is SocketTimeoutException)
                return "Backend unreachable ("+java.net.URI(origin).host+"). Semak internet/DNS dan cuba semula."
            cause=cause?.cause
        }
        return error.message?:"Voice gagal disambungkan."
    }
}
