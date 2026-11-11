package my.aksara.nativeapp.feature.today

import android.content.Context
import android.location.Geocoder
import android.location.Location
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.time.LocalDate
import java.util.Locale
import java.util.concurrent.TimeUnit

internal data class TodayHoliday(val date:LocalDate,val name:String,val tentative:Boolean)
internal data class TodayHolidayFeed(val entries:List<TodayHoliday>,val cached:Boolean)

internal object MalaysiaHolidayStates {
    val all=linkedMapOf(
        "JHR" to "Johor", "KDH" to "Kedah", "KTN" to "Kelantan",
        "MLK" to "Melaka", "NSN" to "Negeri Sembilan", "PHG" to "Pahang",
        "PRK" to "Perak", "PLS" to "Perlis", "PNG" to "Pulau Pinang",
        "SBH" to "Sabah", "SWK" to "Sarawak", "SGR" to "Selangor",
        "TRG" to "Terengganu", "KUL" to "Kuala Lumpur",
        "LBN" to "Labuan", "PJY" to "Putrajaya"
    )
    fun fromName(name:String?):String? {
        if(name.isNullOrBlank())return null
        return all.entries.firstOrNull { name.contains(it.value,ignoreCase=true) }?.key
            ?: when {
                name.contains("Penang",true)->"PNG"
                name.contains("Malacca",true)->"MLK"
                else->null
            }
    }
}
internal object TodayHolidayParser {
    fun parse(raw:String):List<TodayHoliday> {
        val entries=JSONObject(raw).getJSONArray("data")
        return (0 until entries.length()).mapNotNull { index ->
            val row=entries.optJSONObject(index) ?: return@mapNotNull null
            val date=runCatching { LocalDate.parse(row.getString("date")) }.getOrNull()
                ?:return@mapNotNull null
            val name=row.optString("name").trim().take(110)
            if(name.isBlank())return@mapNotNull null
            TodayHoliday(date,name,row.optBoolean("is_subject_to_change",false))
        }.distinctBy { it.date.toString()+"|"+it.name }
    }
}

internal class TodayHolidayRepository(context:Context) {
    private val prefs=context.applicationContext.getSharedPreferences(
        "aksara_today_holidays",Context.MODE_PRIVATE)
    private val client=OkHttpClient.Builder().connectTimeout(9,TimeUnit.SECONDS)
        .readTimeout(12,TimeUnit.SECONDS).callTimeout(18,TimeUnit.SECONDS).build()

    suspend fun fetch(year:Int,state:String):TodayHolidayFeed=withContext(Dispatchers.IO) {
        require(year in 2000..2100 && state in MalaysiaHolidayStates.all) { "Negeri atau tahun tidak sah" }
        val key=state+"_"+year
        val old=prefs.getString(key,null)
        val last=prefs.getLong(key+"_at",0L)
        fun cached():TodayHolidayFeed?=old?.let {
            runCatching { TodayHolidayFeed(TodayHolidayParser.parse(it),true) }.getOrNull()
        }
        if(System.currentTimeMillis()-last<24*60*60_000L)cached()?.let { return@withContext it }
        runCatching {
            val url="https://malaysia-holiday.dydxsoft.my/api/v1/holidays?year="+year+
                "&state="+state
            client.newCall(Request.Builder().url(url).build()).execute().use { response ->
                check(response.isSuccessful) { "Cuti umum HTTP "+response.code }
                val text=response.body?.string() ?: error("Tiada respons cuti")
                check(text.length<250_000) { "Respons terlalu besar" }
                val holidays=TodayHolidayParser.parse(text)
                prefs.edit().putString(key,text).putLong(key+"_at",System.currentTimeMillis()).apply()
                TodayHolidayFeed(holidays,false)
            }
        }.getOrElse {cached() ?: TodayHolidayFeed(emptyList(),true)}
    }

    @Suppress("DEPRECATION")
    suspend fun stateOf(context:Context,location:Location?):String? =
        withContext(Dispatchers.IO) {
            if(location==null || !Geocoder.isPresent())return@withContext null
            val state=runCatching {
                Geocoder(context,Locale("ms","MY"))
                    .getFromLocation(location.latitude,location.longitude,1)
                    ?.firstOrNull()?.adminArea
            }.getOrNull()
            MalaysiaHolidayStates.fromName(state)
        }
}
