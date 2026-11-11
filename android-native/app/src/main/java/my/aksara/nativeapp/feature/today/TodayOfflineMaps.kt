package my.aksara.nativeapp.feature.today

import android.content.Context
import org.maplibre.android.MapLibre
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.geometry.LatLngBounds
import org.maplibre.android.offline.OfflineManager
import org.maplibre.android.offline.OfflineRegion
import org.maplibre.android.offline.OfflineRegionError
import org.maplibre.android.offline.OfflineRegionStatus
import org.maplibre.android.offline.OfflineTilePyramidRegionDefinition
import org.maplibre.android.module.http.HttpRequestUtil
import okhttp3.Dispatcher
import okhttp3.OkHttpClient
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/** OpenFreeMap permits only small explicit user-triggered offline areas, not city-sized scraping. */
internal object TodayOfflineMaps {
    private const val MAX_BYTES=45L*1024L*1024L
    private const val MAX_TILES=2_700L
    private var configured=false
    private var currentRegion:OfflineRegion?=null

    fun configure(context:Context) {
        if(configured)return
        // HTTP parallelism and UA meet provider fair-use requirements.
        val dispatcher=Dispatcher().apply { maxRequests=4;maxRequestsPerHost=4 }
        val client=OkHttpClient.Builder().dispatcher(dispatcher)
            .callTimeout(35,TimeUnit.SECONDS)
            .addInterceptor { chain ->
                val original=chain.request()
                chain.proceed(original.newBuilder().header("User-Agent",
                    "AksaraAndroid/0.2 (+https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas)").build())
            }.build()
        HttpRequestUtil.setOkHttpClient(client)
        MapLibre.getInstance(context.applicationContext)
        configured=true
    }

    fun downloadSmallArea(
        context:Context,route:TodayRoute,
        report:(String)->Unit
    ) {
        require(route.points.isNotEmpty()) { "Laluan belum tersedia" }
        val lowLat=route.points.minOf {it.latitude}
        val highLat=route.points.maxOf {it.latitude}
        val lowLon=route.points.minOf {it.longitude}
        val highLon=route.points.maxOf {it.longitude}
        if(highLat-lowLat>0.025 || highLon-lowLon>0.025) {
            report("Laluan terlalu luas untuk pek kecil. Simpan laluan; pilih perjalanan lebih pendek untuk peta offline.")
            return
        }
        val west=(lowLon-0.002).coerceAtLeast(-180.0)
        val east=(highLon+0.002).coerceAtMost(180.0)
        val south=(lowLat-0.002).coerceAtLeast(-90.0)
        val north=(highLat+0.002).coerceAtMost(90.0)
        val bounds=LatLngBounds.Builder()
            .include(LatLng(south,west)).include(LatLng(north,east)).build()
        runCatching {
            configure(context)
            val manager=OfflineManager.getInstance(context.applicationContext)
            manager.setOfflineMapboxTileCountLimit(MAX_TILES)
            val definition=OfflineTilePyramidRegionDefinition(TodayMapConfig.style,
                bounds,9.0,14.0,1f)
            val metadata=JSONObject().put("name","AKSARA Route Offline")
                .put("createdAt",System.currentTimeMillis()).toString().toByteArray()
            report("Menyediakan pek peta kecil…")
            manager.createOfflineRegion(definition,metadata,
                object:OfflineManager.CreateOfflineRegionCallback {
                    override fun onCreate(region:OfflineRegion) {
                        currentRegion=region
                        region.setObserver(object:OfflineRegion.OfflineRegionObserver {
                            override fun onStatusChanged(status:OfflineRegionStatus) {
                                if(status.completedTileCount>MAX_TILES ||
                                    status.completedResourceSize>MAX_BYTES) {
                                    region.setDownloadState(OfflineRegion.STATE_INACTIVE)
                                    report("Had pek peta dicapai. Muat turun dihentikan.")
                                    return
                                }
                                report(when {
                                    status.isComplete->"Peta kawasan kecil selesai disimpan offline."
                                    else->"Peta: "+status.completedTileCount+
                                        " jubin, "+status.completedResourceSize/1_048_576L+" MB"
                                })
                                if(status.isComplete)region.setDownloadState(
                                    OfflineRegion.STATE_INACTIVE)
                            }
                            override fun onError(error:OfflineRegionError) {
                                region.setDownloadState(OfflineRegion.STATE_INACTIVE)
                                report("Peta offline gagal: "+error.message)
                            }
                            override fun mapboxTileCountLimitExceeded(limit:Long) {
                                region.setDownloadState(OfflineRegion.STATE_INACTIVE)
                                report("Had "+limit+" jubin dicapai. Pilih kawasan lebih kecil.")
                            }
                        })
                        region.setDownloadState(OfflineRegion.STATE_ACTIVE)
                    }
                    override fun onError(error:String) {
                        report("Gagal cipta peta offline: "+error)
                    }
                })
        }.onFailure { report("Peta offline tidak tersedia: "+(it.message ?: "ralat")) }
    }

    fun pause() {
        currentRegion?.setDownloadState(OfflineRegion.STATE_INACTIVE)
    }
}
