package my.aksara.nativeapp.feature.today

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.net.URLEncoder
import java.util.Locale
import java.util.concurrent.TimeUnit

internal data class TodayTrafficFlow(
    val currentKmh:Int,val freeFlowKmh:Int,val confidence:Double,
    val roadClosed:Boolean,val observedAt:Long
)
internal object TodayTrafficParser {
    fun parse(text:String,at:Long=System.currentTimeMillis()):TodayTrafficFlow {
        val data=JSONObject(text).getJSONObject("flowSegmentData")
        val current=data.getInt("currentSpeed")
        val free=data.getInt("freeFlowSpeed")
        val confidence=data.optDouble("confidence",Double.NaN)
        require(current in 0..300 && free in 1..300 &&
            confidence.isFinite() && confidence in 0.0..1.0) {
            "Respons trafik tidak sah"
        }
        return TodayTrafficFlow(current,free,confidence,
            data.optBoolean("roadClosure",false),at)
    }
}

internal class TodayTrafficRepository {
    private val client=OkHttpClient.Builder().connectTimeout(8,TimeUnit.SECONDS)
        .readTimeout(12,TimeUnit.SECONDS).callTimeout(18,TimeUnit.SECONDS).build()
    private var lastAt=0L
    private var count=0
    private var currentDay=0L
    private var lastFlow:TodayTrafficFlow?=null

    /** Explicit BYO TomTom key, no key baked into APK, no billing setup or automatic calls. */
    suspend fun sample(point:RouteCoordinate,key:String):TodayTrafficFlow=
        withContext(Dispatchers.IO) {
            require(key.matches(Regex("[A-Za-z0-9_-]{10,128}"))) {
                "Masukkan API key TomTom yang sah."
            }
            require(point.latitude in -90.0..90.0 && point.longitude in -180.0..180.0) {
                "Titik trafik tidak sah"
            }
            val now=System.currentTimeMillis()
            val day=now/86_400_000L
            synchronized(this@TodayTrafficRepository) {
                if(day!=currentDay) {currentDay=day;count=0;lastFlow=null}
                if(now-lastAt<5*60_000L && lastFlow!=null)return@withContext lastFlow!!
                check(count<20) { "Had semakan trafik harian per peranti telah dicapai." }
                check(now-lastAt>=30_000L) { "Tunggu sebelum semakan trafik seterusnya." }
                lastAt=now
                count++
            }
            val pointParam=String.format(Locale.US,"%.6f,%.6f",
                point.latitude,point.longitude)
            val url="https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/12/json"+
                "?key="+URLEncoder.encode(key,"UTF-8")+
                "&point="+URLEncoder.encode(pointParam,"UTF-8")+
                "&unit=kmph"
            client.newCall(Request.Builder().url(url).build()).execute().use { resp ->
                check(resp.isSuccessful) { if(resp.code==429)"Kuota TomTom dicapai."
                    else "TomTom HTTP "+resp.code }
                val text=resp.body?.string() ?: error("Respons trafik kosong")
                check(text.length<100_000) { "Respons trafik terlalu besar" }
                val flow=TodayTrafficParser.parse(text)
                synchronized(this@TodayTrafficRepository) {lastFlow=flow}
                flow
            }
        }
}
