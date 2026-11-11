package my.aksara.nativeapp.feature.today

import android.content.Context
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale
import java.time.YearMonth
import java.time.ZoneId
import java.util.concurrent.TimeUnit

internal data class TodayForecastHour(
    val time:String,val celsius:Double,val feels:Double,val humidity:Int,val rain:Int
)
internal data class TodayForecastDay(val date:String,val high:Double,val low:Double,val rain:Int)
internal data class TodayForecast(val hours:List<TodayForecastHour>,val days:List<TodayForecastDay>)
internal data class TodayPrayerDate(val date:String,val hijri:String,val times:List<Pair<String,String>>)
internal data class TodayRevision(val sha:String,val message:String,val author:String,val date:String)
internal data class TodayRelease(
    val tag:String,val title:String,val date:String,val prerelease:Boolean,val apkPublished:Boolean
)
internal data class TodayDevelopment(
    val android:List<TodayRevision>,val web:List<TodayRevision>,val releases:List<TodayRelease>
)

/** No fabricated live weather, prayer time, CI status, or release information. */
internal object TodayDetailParsers {
    fun forecast(raw:String):TodayForecast {
        val root=JSONObject(raw)
        val hourly=root.getJSONObject("hourly")
        val times=hourly.getJSONArray("time")
        val temps=hourly.getJSONArray("temperature_2m")
        val apparent=hourly.getJSONArray("apparent_temperature")
        val humidities=hourly.getJSONArray("relative_humidity_2m")
        val rain=hourly.getJSONArray("precipitation_probability")
        val n=listOf(times.length(),temps.length(),apparent.length(),humidities.length(),rain.length())
            .minOrNull() ?: 0
        require(n>0) { "Ramalan setiap jam tiada" }
        val hours=(0 until n.coerceAtMost(72)).map { i ->
            TodayForecastHour(times.getString(i),temps.getDouble(i),
                apparent.getDouble(i),humidities.getInt(i),rain.getInt(i))
        }
        val daily=root.getJSONObject("daily")
        val dates=daily.getJSONArray("time")
        val high=daily.getJSONArray("temperature_2m_max")
        val low=daily.getJSONArray("temperature_2m_min")
        val rainfall=daily.getJSONArray("precipitation_probability_max")
        val d=listOf(dates.length(),high.length(),low.length(),rainfall.length()).minOrNull() ?: 0
        require(d>0) { "Ramalan harian tiada" }
        val days=(0 until d.coerceAtMost(7)).map { i ->
            TodayForecastDay(dates.getString(i),high.getDouble(i),low.getDouble(i),rainfall.getInt(i))
        }
        return TodayForecast(hours,days)
    }
    fun prayerMonth(raw:String):List<TodayPrayerDate> {
        val root=JSONObject(raw)
        val entries=root.optJSONArray("prayerTime") ?: root.optJSONArray("data")
            ?: root.optJSONObject("data")?.optJSONArray("prayerTime")
            ?: throw IllegalArgumentException("Format jadual bulanan tidak dikenali")
        val result=mutableListOf<TodayPrayerDate>()
        for(i in 0 until entries.length()) {
            val item=entries.optJSONObject(i) ?: continue
            val times=listOf("Subuh" to "fajr","Zohor" to "dhuhr","Asar" to "asr",
                "Maghrib" to "maghrib","Isyak" to "isha")
                .map { (label,key) -> label to item.optString(key).take(5) }
            if(times.any { !it.second.matches(Regex("[0-2][0-9]:[0-5][0-9]")) })continue
            val date=item.optString("date")
            if(date.isNotBlank()) result+=TodayPrayerDate(date,item.optString("hijri"),times)
        }
        require(result.isNotEmpty()) { "Jadual bulanan kosong" }
        return result.take(31)
    }
    fun commits(raw:String):List<TodayRevision> {
        val values=JSONArray(raw)
        return (0 until values.length().coerceAtMost(20)).mapNotNull { i ->
            val o=values.optJSONObject(i) ?: return@mapNotNull null
            val meta=o.optJSONObject("commit") ?: return@mapNotNull null
            val sha=o.optString("sha")
            val message=meta.optString("message").lineSequence().firstOrNull().orEmpty()
            if(sha.length<7 || message.isBlank())return@mapNotNull null
            TodayRevision(sha,message,meta.optJSONObject("author")?.optString("name")
                .orEmpty().ifBlank { "Tidak diketahui" },
                meta.optJSONObject("committer")?.optString("date").orEmpty())
        }
    }
    fun releases(raw:String):List<TodayRelease> {
        val values=JSONArray(raw)
        return (0 until values.length().coerceAtMost(15)).mapNotNull { i ->
            val o=values.optJSONObject(i) ?: return@mapNotNull null
            if(o.optBoolean("draft",false))return@mapNotNull null
            val tag=o.optString("tag_name")
            if(tag.isBlank())return@mapNotNull null
            val assets=o.optJSONArray("assets") ?: JSONArray()
            val apk=(0 until assets.length()).any { j ->
                assets.optJSONObject(j)?.optString("name")?.endsWith(".apk",true)==true
            }
            TodayRelease(tag,o.optString("name").ifBlank { tag },
                o.optString("published_at"),o.optBoolean("prerelease",false),apk)
        }
    }
}

/** Fetches only when a detail window opens; 15s network cap and stale-cache fallback. */
internal class TodayDetailRepository(context:Context) {
    private val prefs=context.applicationContext.getSharedPreferences("aksara_today_v2_extra",Context.MODE_PRIVATE)
    private val client=OkHttpClient.Builder().connectTimeout(7,TimeUnit.SECONDS)
        .readTimeout(11,TimeUnit.SECONDS).callTimeout(15,TimeUnit.SECONDS).build()
    private suspend fun get(url:String):String=withContext(Dispatchers.IO) {
        client.newCall(Request.Builder().url(url).header("Accept","application/json")
            .header("User-Agent","AksaraTodayAndroid/2.0").build()).execute().use { response ->
            if(!response.isSuccessful)throw IllegalStateException("HTTP "+response.code)
            response.body?.string()?.takeIf(String::isNotBlank)
                ?: throw IllegalStateException("Respons kosong")
        }
    }
    private suspend fun <T> cached(
        key:String,ttl:Long,parser:(String)->T,request:suspend()->String
    ):TodayFeed<T> = withContext(Dispatchers.IO) {
        val raw=prefs.getString(key,null)
        val at=prefs.getLong("$key:at",0L)
        val old=raw?.let { runCatching { parser(it) }.getOrNull() }
        val now=System.currentTimeMillis()
        if(old!=null && now-at<ttl)return@withContext TodayFeed(old,false,at)
        try {
            val text=request()
            val result=parser(text)
            prefs.edit().putString(key,text).putLong("$key:at",now).apply()
            TodayFeed(result,false,now)
        } catch (e:Exception) {
            if (e is CancellationException) throw e
            TodayFeed(old,true,at.takeIf { it>0L })
        }
    }
    suspend fun forecast(lat:Double,lon:Double):TodayFeed<TodayForecast> {
        val a=String.format(Locale.US,"%.3f",lat)
        val b=String.format(Locale.US,"%.3f",lon)
        return cached("forecast:$a:$b",30L*60_000L,TodayDetailParsers::forecast) {
            get("https://api.open-meteo.com/v1/forecast?latitude=$a&longitude=$b"+
                "&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability"+
                "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max"+
                "&timezone=auto&forecast_days=7")
        }
    }
    suspend fun prayerMonth(zone:String):TodayFeed<List<TodayPrayerDate>> {
        require(zone.matches(Regex("[A-Z]{3}0[1-9]")))
        val month=YearMonth.now(ZoneId.of("Asia/Kuala_Lumpur"))
        return cached("month:$zone:$month",12L*60L*60_000L,TodayDetailParsers::prayerMonth) {
            get("https://solat.my/api/monthly/$zone/"+month.monthValue)
        }
    }
    suspend fun development():TodayDevelopment=withContext(Dispatchers.IO) {
        val base="https://api.github.com/repos/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas"
        val android=cached("commits:android",20L*60_000L,TodayDetailParsers::commits) {
            get("$base/commits?sha=rebuild%2Faksara-android-native-v1&per_page=12")
        }
        val web=cached("commits:main",60L*60_000L,TodayDetailParsers::commits) {
            get("$base/commits?sha=main&per_page=10")
        }
        val releases=cached("releases",30L*60_000L,TodayDetailParsers::releases) {
            get("$base/releases?per_page=12")
        }
        TodayDevelopment(android.value.orEmpty(),web.value.orEmpty(),releases.value.orEmpty())
    }
}

/** Source: Securities Commission Malaysia digital-assets page, reviewed 11 Nov 2026.
 * "Belum disahkan" MUST be used for coins absent from the explicit SC list. */
internal data class TodayShariahCoin(val symbol:String,val name:String,val sacDate:String)
internal object TodayShariahReference {
    const val sourceUrl="https://www.sc.com.my/digital-assets"
    const val checkedOn="11 November 2026"
    val listed=listOf(
        TodayShariahCoin("BTC","Bitcoin","20 Jul 2020"),
        TodayShariahCoin("ETH","Ethereum","20 Jul 2020"),
        TodayShariahCoin("XRP","Ripple","20 Jul 2020"),
        TodayShariahCoin("LTC","Litecoin","20 Jul 2020"),
        TodayShariahCoin("BCH","Bitcoin Cash","23 Ogos 2021"),
        TodayShariahCoin("SOL","Solana","12 Jan 2023"),
        TodayShariahCoin("ADA","Cardano","12 Jan 2023"),
        TodayShariahCoin("LINK","Chainlink","9 Feb 2023"),
        TodayShariahCoin("UNI","Uniswap","9 Feb 2023"),
        TodayShariahCoin("MATIC","Polygon","10 Ogos 2023"),
        TodayShariahCoin("AVAX","Avalanche","10 Ogos 2023"),
        TodayShariahCoin("DOT","Polkadot","16 Mei 2024"),
        TodayShariahCoin("ATOM","Cosmos","16 Mei 2024"),
        TodayShariahCoin("WLD","Worldcoin","11 Jun 2024"),
        TodayShariahCoin("XLM","Stellar","10 Dis 2024")
    )
    // SC's tradeable-assets page also lists these without an explicit compliant status.
    // Never promote them into the compliant group without an SAC determination.
    val unverified=listOf(
        TodayShariahCoin("SNX","Synthetix",""),
        TodayShariahCoin("MKR","Maker",""),
        TodayShariahCoin("CRV","Curve DAO",""),
        TodayShariahCoin("AAVE","Aave",""),
        TodayShariahCoin("NEAR","Near",""),
        TodayShariahCoin("ALGO","Algorand",""),
        TodayShariahCoin("HBAR","Hedera",""),
        TodayShariahCoin("GRT","The Graph","")
    )
    fun status(symbol:String):String=if(listed.any { it.symbol.equals(symbol,true) })
        "Patuh Syariah menurut SC" else "Belum disahkan"
}
