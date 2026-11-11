package my.aksara.nativeapp.feature.today

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/** Private app storage; no backup, no public share, no simulated offline rerouting. */
internal object TodaySavedRoute {
    private const val name="aksara_navigation_last_route.json"
    fun serialize(route:TodayRoute):String {
        require(route.points.size in 2..25_000) { "Laluan terlalu besar" }
        return JSONObject().apply {
            put("version",1)
            put("kilometres",route.kilometres)
            put("seconds",route.seconds)
            put("costing",route.costing)
            put("savedAt",System.currentTimeMillis())
            put("points",JSONArray().apply {
                route.points.forEach { p ->
                    put(JSONArray().put(p.latitude).put(p.longitude))
                }
            })
            put("steps",JSONArray().apply {
                route.steps.forEach { step -> put(JSONObject()
                    .put("instruction",step.instruction.take(170))
                    .put("shapeIndex",step.shapeIndex)
                    .put("type",step.type))
                }
            })
        }.toString()
    }
    fun deserialize(json:String):TodayRoute {
        require(json.length<2_500_000) { "Fail laluan terlalu besar" }
        val root=JSONObject(json)
        require(root.getInt("version")==1) { "Versi fail tidak disokong" }
        val raw=root.getJSONArray("points")
        require(raw.length() in 2..25_000) { "Koordinat tidak lengkap" }
        val points=(0 until raw.length()).map { i ->
            val value=raw.getJSONArray(i)
            val lat=value.getDouble(0)
            val lon=value.getDouble(1)
            require(lat.isFinite() && lon.isFinite() &&
                lat in -90.0..90.0 && lon in -180.0..180.0) {
                "Koordinat rosak"
            }
            RouteCoordinate(lat,lon)
        }
        val maneuvers=root.getJSONArray("steps")
        require(maneuvers.length()<3000) { "Arahan terlalu banyak" }
        val steps=(0 until maneuvers.length()).map { i ->
            val row=maneuvers.getJSONObject(i)
            RouteStep(row.optString("instruction").take(170),
                row.getInt("shapeIndex").coerceIn(0,points.lastIndex),
                row.getInt("type"))
        }
        val mode=root.optString("costing","auto").takeIf {
            it in setOf("auto","pedestrian","bicycle")
        } ?: "auto"
        return TodayRoute(points,root.getDouble("kilometres"),root.getInt("seconds"),
            steps,"Laluan tersimpan / offline",mode)
    }
    fun save(context:Context,route:TodayRoute):Boolean=runCatching {
        val target=File(context.filesDir,name)
        val temp=File(context.filesDir,name+".tmp")
        temp.writeText(serialize(route))
        check(temp.renameTo(target)) { "Gagal simpan laluan" }
        true
    }.getOrDefault(false)
    fun load(context:Context):TodayRoute?=runCatching {
        val file=File(context.filesDir,name)
        if(file.exists())deserialize(file.readText()) else null
    }.getOrNull()
}
