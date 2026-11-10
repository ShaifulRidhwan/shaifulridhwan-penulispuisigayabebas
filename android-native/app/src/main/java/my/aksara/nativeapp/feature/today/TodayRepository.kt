package my.aksara.nativeapp.feature.today

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.CancellationSignal
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.ZoneId
import java.util.Locale
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume

// No API credentials, no inference calls, and no app-specific backend changes.
internal data class TodayFeed<T>(val value:T?,val fromCache:Boolean,val updatedAt:Long?)
internal data class TodayWeather(val celsius:Double,val code:Int,val windKmh:Double,val rainChance:Int?)
internal data class TodayPrayer(val zone:String,val hijri:String,val times:List<Pair<String,String>>)
internal data class TodayCoin(val symbol:String,val usd:Double,val change24h:Double,val updatedAt:String)
internal data class TodayCommit(val sha:String,val message:String,val date:String,val url:String,val ci:String,val ciUrl:String?)

internal object TodayParsers {
    fun weather(text:String):TodayWeather {
        val root=JSONObject(text)
        val now=root.getJSONObject("current")
        require(now.has("temperature_2m")) { "Suhu tiada dalam respons cuaca" }
        val rain=root.optJSONObject("daily")?.optJSONArray("precipitation_probability_max")
            ?.takeIf { it.length()>0 && !it.isNull(0) }?.optInt(0)
        return TodayWeather(now.getDouble("temperature_2m"),now.optInt("weather_code",-1),
            now.optDouble("wind_speed_10m",0.0),rain)
    }

    fun prayer(text:String,zone:String):TodayPrayer {
        val root=JSONObject(text)
        val times=root.getJSONArray("prayerTime")
        require(times.length()>0) { "Waktu solat tidak tersedia" }
        val item=times.getJSONObject(0)
        val fields=listOf("Subuh" to "fajr","Zohor" to "dhuhr","Asar" to "asr",
            "Maghrib" to "maghrib","Isyak" to "isha")
        val values=fields.map { (name,key) -> name to item.optString(key).take(5) }
        require(values.all { it.second.matches(Regex("[0-2][0-9]:[0-5][0-9]")) }) {
            "Format waktu solat tidak sah"
        }
        return TodayPrayer(zone,item.optString("hijri"),values)
    }

    fun zone(text:String):String {
        val root=JSONObject(text)
        val nested=root.optJSONObject("data") ?: root.optJSONObject("location")
        val value=listOf(root.optString("zone"),root.optString("code"),
            nested?.optString("zone").orEmpty(),nested?.optString("code").orEmpty())
            .firstOrNull { it.matches(Regex("[A-Z]{3}0[1-9]")) }
        return value ?: throw IllegalArgumentException("Zon solat tidak ditemui")
    }

    fun coins(text:String):List<TodayCoin> {
        val values=JSONArray(text)
        return (0 until values.length()).map { index ->
            val item=values.getJSONObject(index)
            val quote=item.getJSONObject("quotes").getJSONObject("USD")
            TodayCoin(item.getString("symbol"),quote.getDouble("price"),
                quote.getDouble("percent_change_24h"),item.optString("last_updated"))
        }.also { require(it.size==3) { "Harga aset tidak lengkap" } }
    }

    fun commit(text:String):TodayCommit {
        val root=JSONObject(text)
        val commit=root.getJSONArray("commits").getJSONObject(0)
        val sha=commit.getString("sha")
        val details=commit.getJSONObject("commit")
        val message=details.optString("message").lineSequence().firstOrNull().orEmpty()
        val date=details.optJSONObject("committer")?.optString("date").orEmpty()
        require(sha.length>=7 && message.isNotBlank()) { "Commit tidak lengkap" }
        val runs=root.optJSONArray("workflow_runs")
        var ci="Belum disahkan"
        var ciUrl:String?=null
        if (runs!=null) for(index in 0 until runs.length()) {
            val run=runs.optJSONObject(index) ?: continue
            if(run.optString("head_sha")!=sha)continue
            ci=when {
                run.optString("status")!="completed" -> "Sedang berjalan"
                run.optString("conclusion")=="success" -> "Lulus"
                run.optString("conclusion")=="failure" -> "Gagal"
                run.optString("conclusion")=="cancelled" -> "Dibatalkan"
                else -> "Tidak diketahui"
            }
            ciUrl=run.optString("html_url").takeIf { it.startsWith("https://github.com/") }
            break
        }
        return TodayCommit(sha,message,date,commit.optString("html_url"),ci,ciUrl)
    }
}

internal fun hasTodayLocationPermission(context:Context)=
    ContextCompat.checkSelfPermission(context,Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED ||
    ContextCompat.checkSelfPermission(context,Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED

internal suspend fun todayLocation(context:Context):Location? {
    if(!hasTodayLocationPermission(context))return null
    val manager=context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    val provider=when {
        manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
        manager.isProviderEnabled(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
        else -> return null
    }
    val last=runCatching { manager.getLastKnownLocation(provider) }.getOrNull()
    if(last!=null && System.currentTimeMillis()-last.time<60L*60L*1000L)return last
    return suspendCancellableCoroutine { continuation ->
        val cancellation=CancellationSignal()
        continuation.invokeOnCancellation { cancellation.cancel() }
        try {
            manager.getCurrentLocation(provider,cancellation,context.mainExecutor) { found ->
                if(continuation.isActive) continuation.resume(found)
            }
        } catch (_:Exception) {
            if(continuation.isActive) continuation.resume(null)
        }
    }
}

internal class TodayRepository(context:Context) {
    private val prefs=context.applicationContext.getSharedPreferences("aksara_today_v1",Context.MODE_PRIVATE)
    private val client=OkHttpClient.Builder().connectTimeout(8,TimeUnit.SECONDS)
        .readTimeout(10,TimeUnit.SECONDS).callTimeout(14,TimeUnit.SECONDS).build()

    private suspend fun request(url:String):String=withContext(Dispatchers.IO) {
        client.newCall(Request.Builder().url(url).header("Accept","application/json")
            .header("User-Agent","AksaraTodayAndroid/1.0").build()).execute().use { response ->
            if(!response.isSuccessful)throw IllegalStateException("HTTP "+response.code)
            response.body?.string()?.takeIf { it.isNotBlank() }
                ?: throw IllegalStateException("Respons kosong")
        }
    }

    // Cache first: a failed refresh must not replace a working snapshot with fake data.
    private suspend fun <T> cached(
        key:String, ttlMs:Long, force:Boolean=false, parser:(String)->T, loader:suspend()->String
    ):TodayFeed<T> {
        val raw=prefs.getString(key,null)
        val updated=prefs.getLong(key+":at",0L)
        val previous=raw?.let { runCatching { parser(it) }.getOrNull() }
        val now=System.currentTimeMillis()
        if(!force && previous!=null && now-updated<ttlMs)
            return TodayFeed(previous,false,updated)
        return try {
            val response=loader()
            val value=parser(response)
            prefs.edit().putString(key,response).putLong(key+":at",System.currentTimeMillis()).apply()
            TodayFeed(value,false,System.currentTimeMillis())
        } catch (_:Exception) {
            TodayFeed(previous,true,updated.takeIf { it>0L })
        }
    }

    suspend fun weather(location:Location,force:Boolean=false):TodayFeed<TodayWeather> {
        val lat=String.format(Locale.US,"%.3f",location.latitude)
        val lon=String.format(Locale.US,"%.3f",location.longitude)
        val url="https://api.open-meteo.com/v1/forecast?latitude="+lat+"&longitude="+lon+
            "&current=temperature_2m,weather_code,wind_speed_10m"+
            "&daily=precipitation_probability_max&timezone=auto&forecast_days=1"
        return cached("weather:"+lat+":"+lon,30L*60_000L,force,TodayParsers::weather) { request(url) }
    }

    suspend fun prayer(location:Location,force:Boolean=false):TodayFeed<TodayPrayer> {
        val lat=String.format(Locale.US,"%.4f",location.latitude)
        val lon=String.format(Locale.US,"%.4f",location.longitude)
        val today=LocalDate.now(ZoneId.of("Asia/Kuala_Lumpur")).toString()
        return cached("prayer:"+lat+":"+lon+":"+today,6L*60L*60_000L,force,
            { text ->
                val root=JSONObject(text)
                TodayParsers.prayer(root.getJSONObject("timetable").toString(),root.getString("zone"))
            }) {
            val detected=TodayParsers.zone(request(
                "https://solat.my/api/detect?latitude="+lat+"&longitude="+lon))
            val response=request("https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat&period=today&zone="+detected)
            JSONObject().put("zone",detected).put("timetable",JSONObject(response)).toString()
        }
    }

    suspend fun crypto(force:Boolean=false):TodayFeed<List<TodayCoin>> =
        cached("crypto",15L*60_000L,force,TodayParsers::coins) {
            val result=JSONArray()
            for(id in listOf("btc-bitcoin","eth-ethereum","sol-solana")) {
                result.put(JSONObject(request("https://api.coinpaprika.com/v1/tickers/"+id)))
            }
            result.toString()
        }

    suspend fun github(force:Boolean=false):TodayFeed<TodayCommit> =
        cached("github",10L*60_000L,force,TodayParsers::commit) {
            val base="https://api.github.com/repos/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas"
            val commits=JSONArray(request(base+"/commits?sha=rebuild%2Faksara-android-native-v1&per_page=1"))
            require(commits.length()>0) { "Tiada commit" }
            // CI may be temporarily unavailable; preserve the real commit and mark CI unknown.
            val runs=runCatching {
                JSONObject(request(base+"/actions/runs?branch=rebuild%2Faksara-android-native-v1&per_page=10"))
                    .optJSONArray("workflow_runs") ?: JSONArray()
            }.getOrDefault(JSONArray())
            JSONObject().put("commits",commits).put("workflow_runs",runs).toString()
        }
}
