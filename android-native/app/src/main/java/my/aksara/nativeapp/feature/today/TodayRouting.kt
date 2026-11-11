package my.aksara.nativeapp.feature.today

import android.location.Location
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/** No simulated routes, and no traffic claims. Distances and turns come from Valhalla. */
internal data class RouteCoordinate(val latitude:Double,val longitude:Double)
internal data class RouteStep(val instruction:String,val shapeIndex:Int,val type:Int)
internal data class TodayRoute(
    val points:List<RouteCoordinate>,val kilometres:Double,val seconds:Int,
    val steps:List<RouteStep>,val provider:String="Valhalla / OpenStreetMap"
)
internal object TodayRouteParser {
    /** Valhalla encodes coordinates at 1e-6 precision, unlike Google polyline5. */
    fun decodePolyline6(encoded:String):List<RouteCoordinate> {
        val points=ArrayList<RouteCoordinate>()
        var index=0
        var latitude=0L
        var longitude=0L
        fun nextDelta():Long {
            var shift=0
            var value=0L
            while(true) {
                require(index<encoded.length && shift<=30) { "Bentuk laluan rosak" }
                val code=encoded[index++].code-63
                require(code in 0..63) { "Bentuk laluan tidak sah" }
                value=value or ((code.toLong() and 31L) shl shift)
                shift+=5
                if(code<32)break
            }
            return if(value and 1L!=0L) (value shr 1).inv() else value shr 1
        }
        while(index<encoded.length) {
            latitude+=nextDelta()
            longitude+=nextDelta()
            val a=latitude/1e6
            val b=longitude/1e6
            require(a in -90.0..90.0 && b in -180.0..180.0) { "Koordinat laluan tidak sah" }
            points+=RouteCoordinate(a,b)
            require(points.size<50_000) { "Laluan terlalu panjang" }
        }
        return points
    }

    fun parse(text:String):TodayRoute {
        val trip=JSONObject(text).getJSONObject("trip")
        require(trip.optInt("status",0)==0) { "Tiada laluan tersedia" }
        val summary=trip.getJSONObject("summary")
        val legs=trip.getJSONArray("legs")
        require(legs.length()>0) { "Tiada segmen laluan" }
        val points=ArrayList<RouteCoordinate>()
        val steps=ArrayList<RouteStep>()
        for(i in 0 until legs.length()) {
            val leg=legs.getJSONObject(i)
            val decoded=decodePolyline6(leg.getString("shape"))
            require(decoded.size>=2) { "Geometri laluan tidak lengkap" }
            val offset=if(points.isEmpty())0 else points.size-1
            points.addAll(if(points.isEmpty())decoded else decoded.drop(1))
            val moves=leg.optJSONArray("maneuvers")
            if(moves!=null)for(j in 0 until moves.length()) {
                val move=moves.getJSONObject(j)
                val instruction=move.optString("instruction").trim()
                if(instruction.isNotBlank())steps+=RouteStep(instruction,
                    (offset+move.optInt("begin_shape_index",0)).coerceIn(0,points.lastIndex),
                    move.optInt("type",-1))
            }
        }
        val km=summary.getDouble("length")
        val seconds=summary.getInt("time")
        require(km.isFinite() && km>0 && seconds>0) { "Jarak atau tempoh tidak sah" }
        return TodayRoute(points,km,seconds,steps)
    }
}

internal class TodayRouteRepository {
    private val client=OkHttpClient.Builder().connectTimeout(9,TimeUnit.SECONDS)
        .readTimeout(17,TimeUnit.SECONDS).callTimeout(23,TimeUnit.SECONDS).build()
    private var lastRequest=0L
    private var day=0L
    private var requestsToday=0
    private var lastKey:String?=null
    private var lastRoute:TodayRoute?=null
    private val endpoint="https://valhalla1.openstreetmap.de/route"
    suspend fun route(from:Location,to:RouteCoordinate,costing:String="auto"):TodayRoute =
        withContext(Dispatchers.IO) {
            require(costing in setOf("auto","pedestrian","bicycle")) { "Mod tidak disokong" }
            require(to.latitude in -90.0..90.0 && to.longitude in -180.0..180.0) {
                "Destinasi tidak sah"
            }
            // Never auto-poll this public demo server; user must press a button.
            val key=listOf(from.latitude.toString(),from.longitude.toString(),
                to.latitude.toString(),to.longitude.toString(),costing).joinToString("|")
            synchronized(this@TodayRouteRepository) {
                val now=System.currentTimeMillis()
                val today=now/86_400_000L
                if(today!=day) { day=today;requestsToday=0 }
                if(lastKey==key && lastRoute!=null && now-lastRequest<120_000L) {
                    return@withContext lastRoute!!
                }
                check(now-lastRequest>=2_000L) { "Cuba semula selepas dua saat." }
                check(requestsToday<50) { "Had penggunaan pelayan demonstrasi hari ini dicapai." }
                lastRequest=now
                requestsToday++
            }
            val requestJson=JSONObject().apply {
                put("locations",org.json.JSONArray().apply {
                    put(JSONObject().put("lat",from.latitude).put("lon",from.longitude))
                    put(JSONObject().put("lat",to.latitude).put("lon",to.longitude))
                })
                put("costing",costing)
                put("units","kilometers")
                put("language","en-US")
            }
            val request=Request.Builder().url(endpoint)
                .header("X-Client-Id","aksara-ai-android")
                .header("User-Agent","AksaraAndroid/0.2 (https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas)")
                .post(requestJson.toString().toRequestBody("application/json".toMediaType()))
                .build()
            client.newCall(request).execute().use { response ->
                if(!response.isSuccessful)error(when(response.code) {
                    429->"Pelayan laluan sedang mengehadkan permintaan."
                    else->"Pelayan laluan tidak tersedia (HTTP "+response.code+")."
                })
                val body=response.body ?: error("Tiada respons laluan")
                val raw=body.charStream().readText()
                check(raw.length<750_000) { "Respons laluan terlalu besar" }
                val result=TodayRouteParser.parse(raw)
                synchronized(this@TodayRouteRepository) { lastKey=key;lastRoute=result }
                result
            }
        }
}
