package my.aksara.nativeapp.feature.today

import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Bitmap
import android.location.Location
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import kotlinx.coroutines.delay
import my.aksara.nativeapp.core.design.*
import org.maplibre.android.MapLibre
import org.maplibre.android.annotations.MarkerOptions
import org.maplibre.android.camera.CameraPosition
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.maps.MapView
import org.maplibre.android.maps.Style
import org.maplibre.android.snapshotter.MapSnapshotter
import java.util.Locale

/** Public tiles, no paid key. Credits MUST remain visible in preview and full map. */
internal object TodayMapConfig {
    const val style="https://tiles.openfreemap.org/styles/positron"
    const val credits="© OpenMapTiles © OpenStreetMap"
    fun navigationUri(lat:Double,lon:Double):Uri {
        require(lat in -90.0..90.0 && lon in -180.0..180.0)
        val a=String.format(Locale.US,"%.6f",lat)
        val b=String.format(Locale.US,"%.6f",lon)
        return Uri.parse("https://www.google.com/maps/dir/?api=1&destination=$a%2C$b")
    }
}

/**
 * Snapshot rather than a second live MapView, so TODAY's 40% cube stays light.
 * No request happens until location has been granted and its page becomes active.
 */
@Composable internal fun TodayMiniMap(
    location:Location?,city:String?,active:Boolean,retryNonce:Int,modifier:Modifier,onClick:()->Unit
) {
    val context=LocalContext.current
    var bitmap by remember(location?.latitude,location?.longitude,retryNonce) { mutableStateOf<Bitmap?>(null) }
    var failed by remember(location?.latitude,location?.longitude,retryNonce) { mutableStateOf(false) }
    DisposableEffect(location?.latitude,location?.longitude,active,retryNonce) {
        if(!active || location==null) return@DisposableEffect onDispose {}
        val snap=runCatching {
            MapLibre.getInstance(context.applicationContext)
            MapSnapshotter(context.applicationContext,
                MapSnapshotter.Options(320,320)
                    .withStyleBuilder(Style.Builder().fromUri(TodayMapConfig.style))
                    .withCameraPosition(CameraPosition.Builder()
                        .target(LatLng(location.latitude,location.longitude))
                        .zoom(12.5).build())
            )
        }.getOrNull()
        if(snap==null) failed=true
        else snap.start({ result -> bitmap=result.bitmap },{ _ -> failed=true })
        onDispose { snap?.cancel() }
    }
    Box(modifier.clip(RoundedCornerShape(16.dp))
        .semantics { contentDescription="Buka peta lokasi" }.clickable(onClick=onClick)) {
        if(bitmap!=null)Image(bitmap!!.asImageBitmap(),contentDescription="Pratonton peta setempat",
            modifier=Modifier.fillMaxSize(),contentScale=ContentScale.Crop)
        else Box(Modifier.fillMaxSize().background(Color(0xB4D5D9DA)),
            contentAlignment=Alignment.Center) {
            AksaraText(when {
                location==null->"Benarkan lokasi"
                failed->"Peta belum tersedia"
                else->"Memuat peta…"
            },size=10.5f,color=Color(0xFFE5C388))
        }
        if(location!=null)AksaraIcon("location",
            Modifier.align(Alignment.Center).size(29.dp),Color(0xFFE5C388))
        Box(Modifier.fillMaxWidth().align(Alignment.BottomCenter)
            .background(Color(0xA9324149)).padding(horizontal=6.dp,vertical=5.dp)) {
            Column(verticalArrangement=Arrangement.spacedBy(2.dp)) {
                AksaraText(city ?: "Lokasi semasa",size=10f,weight=650)
                AksaraText(TodayMapConfig.credits,size=7.5f,color=Color(0xFFD2DCEB))
            }
        }
    }
}

/**
 * Full interactive native map. A click picks a destination; route guidance is
 * explicitly delegated to an installed browser/map app, not claimed in-app.
 */
@Composable internal fun TodayFullMap(
    location:Location?,city:String?,modifier:Modifier=Modifier
) {
    val context=LocalContext.current
    if(location==null) {
        Column(modifier,verticalArrangement=Arrangement.spacedBy(12.dp),
            horizontalAlignment=Alignment.CenterHorizontally) {
            AksaraText("Lokasi belum dibenarkan atau tidak tersedia.",size=12f)
            AksaraText("Kembali ke dashboard dan aktifkan lokasi terlebih dahulu.",
                size=10.5f,color=AksaraColors.muted)
        }
        return
    }
    val owner=LocalLifecycleOwner.current
    val mapView=remember(context) {
        MapLibre.getInstance(context.applicationContext)
        MapView(context).apply { onCreate(null) }
    }
    var mapReady by remember { mutableStateOf(false) }
    var focus by remember { mutableStateOf<LatLng?>(null) }
    var destination by remember { mutableStateOf<LatLng?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    DisposableEffect(mapView,owner) {
        val observer=LifecycleEventObserver { _,event ->
            when(event) {
                Lifecycle.Event.ON_START->mapView.onStart()
                Lifecycle.Event.ON_RESUME->mapView.onResume()
                Lifecycle.Event.ON_PAUSE->mapView.onPause()
                Lifecycle.Event.ON_STOP->mapView.onStop()
                else->Unit
            }
        }
        owner.lifecycle.addObserver(observer)
        if(owner.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED))mapView.onStart()
        if(owner.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED))mapView.onResume()
        onDispose {
            owner.lifecycle.removeObserver(observer)
            if(owner.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED))mapView.onPause()
            if(owner.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED))mapView.onStop()
            mapView.onDestroy()
        }
    }
    LaunchedEffect(mapView,location.latitude,location.longitude) {
        mapView.getMapAsync { map ->
            map.setStyle(Style.Builder().fromUri(TodayMapConfig.style)) {
                map.cameraPosition=CameraPosition.Builder()
                    .target(LatLng(location.latitude,location.longitude)).zoom(13.5).build()
                @Suppress("DEPRECATION")
                map.addMarker(MarkerOptions().position(
                    LatLng(location.latitude,location.longitude)).title("Lokasi semasa"))
                map.addOnMapClickListener { picked ->
                    destination=picked
                    focus=picked
                    true
                }
                mapReady=true
            }
        }
    }
    LaunchedEffect(mapView) {
        delay(12_000L)
        if(!mapReady)error="Peta tidak dapat dimuatkan. Periksa sambungan dan cuba buka semula."
    }
    LaunchedEffect(focus) {
        focus?.let { point ->
            mapView.getMapAsync { map ->
                map.cameraPosition=CameraPosition.Builder()
                    .target(point).zoom(14.5).build()
            }
        }
    }
    Column(modifier,verticalArrangement=Arrangement.spacedBy(9.dp)) {
        Box(Modifier.fillMaxWidth().weight(1f).clip(RoundedCornerShape(17.dp))) {
            AndroidView(factory={ mapView },modifier=Modifier.fillMaxSize())
            if(!mapReady) Box(Modifier.align(Alignment.Center)) {
                AksaraText("Memuat peta OpenFreeMap…",size=11f,color=AksaraColors.gold)
            }
            Box(Modifier.fillMaxWidth().align(Alignment.BottomCenter)
                .background(Color(0xC1324149)).padding(7.dp)) {
                AksaraText(TodayMapConfig.credits+" • OpenFreeMap",size=9f)
            }
        }
        AksaraGlassSurface(Modifier.fillMaxWidth(),radius=13.dp) {
            Column(Modifier.fillMaxWidth().padding(11.dp),
                verticalArrangement=Arrangement.spacedBy(8.dp)) {
                AksaraText(city ?: "Lokasi peranti",size=12f,weight=650,color=AksaraColors.gold)
                AksaraText(destination?.let{
                    "Destinasi dipilih: "+String.format(Locale.US,"%.5f, %.5f",it.latitude,it.longitude)
                } ?: "Tekan peta untuk pilih destinasi.",size=10.5f,color=AksaraColors.muted)
                Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                    AksaraButton("Lokasi saya",{
                        focus=LatLng(location.latitude,location.longitude)
                    },Modifier.weight(1f),height=38.dp,size=10.5f)
                    AksaraButton("Navigasi luar",{
                        val point=destination ?: return@AksaraButton
                        runCatching {
                            context.startActivity(Intent(Intent.ACTION_VIEW,
                                TodayMapConfig.navigationUri(point.latitude,point.longitude)))
                        }.onFailure { error="Tiada aplikasi/pelayar navigasi tersedia." }
                    },Modifier.weight(1f),height=38.dp,size=10.5f,
                        enabled=destination!=null)
                }
                AksaraText("Navigasi dibuka melalui aplikasi luar. Laluan/ETA dan trafik langsung tidak disediakan oleh Aksara.",
                    size=9.5f,line=14f,color=AksaraColors.muted)
                if(error!=null)AksaraText(error!!,size=10.5f,color=Color(0xFFF1A5A1))
            }
        }
    }
}
