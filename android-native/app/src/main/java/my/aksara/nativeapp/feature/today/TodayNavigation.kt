package my.aksara.nativeapp.feature.today

import android.content.Context
import android.speech.tts.TextToSpeech
import java.util.Locale
import kotlin.math.*

internal data class TodayNavProgress(
    val nearestIndex:Int,val offRouteMetres:Double,val remainingMetres:Double,
    val nextStep:RouteStep?,val distanceToStepMetres:Double
)

internal object TodayNavigationMath {
    fun distanceMetres(a:RouteCoordinate,b:RouteCoordinate):Double {
        val dLat=Math.toRadians(b.latitude-a.latitude)
        val dLon=Math.toRadians(b.longitude-a.longitude)
        val lat1=Math.toRadians(a.latitude)
        val lat2=Math.toRadians(b.latitude)
        val hav=sin(dLat/2).pow(2.0)+cos(lat1)*cos(lat2)*sin(dLon/2).pow(2.0)
        return 12_742_000.0*asin(sqrt(hav.coerceIn(0.0,1.0)))
    }
    fun progress(route:TodayRoute,position:RouteCoordinate,lastIndex:Int):TodayNavProgress {
        require(route.points.isNotEmpty()) { "Tiada geometri laluan" }
        // Search all geometry so reroutes or GPS jumps cannot produce a false arrival.
        var best=0
        var closest=Double.POSITIVE_INFINITY
        route.points.forEachIndexed { index,p ->
            val d=distanceMetres(position,p)
            if(d<closest) {closest=d;best=index}
        }
        val at=best.coerceAtLeast((lastIndex-4).coerceAtLeast(0))
            .coerceAtMost(route.points.lastIndex)
        var remaining=0.0
        for(i in at until route.points.lastIndex) {
            remaining+=distanceMetres(route.points[i],route.points[i+1])
        }
        val upcoming=route.steps.firstOrNull { it.shapeIndex>at && it.type !in 1..3 }
            ?: route.steps.lastOrNull()
        val dist=upcoming?.let {
            distanceMetres(position,route.points[it.shapeIndex.coerceIn(0,route.points.lastIndex)])
        } ?: Double.POSITIVE_INFINITY
        return TodayNavProgress(at,closest,remaining,upcoming,dist)
    }

    /** Spoken text uses provider maneuver type, not fabricated street names. */
    fun malayVoice(type:Int):String=when(type) {
        1,2,3->"Mulakan perjalanan."
        4,5,6->"Anda sudah tiba di destinasi."
        8,17,22->"Teruskan perjalanan."
        9,23->"Ikut jalan sedikit ke kanan."
        10,11,18,20,37->"Belok kanan."
        12,13->"Buat pusingan U apabila selamat."
        14,15,19,21,38->"Belok kiri."
        16,24->"Ikut jalan sedikit ke kiri."
        25->"Masuk ke laluan utama."
        26->"Masuk ke bulatan."
        27->"Keluar dari bulatan."
        else->"Ikut petunjuk laluan pada skrin."
    }
}

/** TTS runs only during the visible guided-navigation session. */
internal class TodayNavigationVoice(context:Context) {
    private var ready=false
    private var voice:TextToSpeech?=null
    private var malayAvailable=false
    init {
        voice=TextToSpeech(context.applicationContext) { status ->
            if(status==TextToSpeech.SUCCESS) {
                val result=voice?.setLanguage(Locale.forLanguageTag("ms-MY")) ?: -1
                malayAvailable=result>=TextToSpeech.LANG_AVAILABLE
                ready=malayAvailable
            }
        }
    }
    fun speakMalay(message:String) {
        if(ready && malayAvailable) {
            voice?.speak(message,TextToSpeech.QUEUE_FLUSH,null,"aksara-navigation-turn")
        }
    }
    fun stop() {
        voice?.stop()
        voice?.shutdown()
        ready=false
    }
    fun isMalayReady()=ready && malayAvailable
}
