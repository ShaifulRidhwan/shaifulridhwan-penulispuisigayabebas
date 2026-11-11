package my.aksara.nativeapp.feature.today

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationListener
import android.location.LocationManager
import android.os.Looper
import androidx.core.content.ContextCompat
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Bitmap
import android.location.Location
import android.net.Uri
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.graphics.SolidColor
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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.maplibre.android.annotations.Polyline
import org.maplibre.android.annotations.PolylineOptions
import org.maplibre.android.camera.CameraUpdateFactory
import org.maplibre.android.geometry.LatLngBounds
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
    val routingRepo=remember { TodayRouteRepository() }
    val trafficRepo=remember { TodayTrafficRepository() }
    var trafficKey by remember { mutableStateOf("") }
    var trafficLoading by remember { mutableStateOf(false) }
    var trafficFlow by remember { mutableStateOf<TodayTrafficFlow?>(null) }
    var offlineStatus by remember { mutableStateOf("") }
    val scope=rememberCoroutineScope()
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
    var searchTerm by remember { mutableStateOf("") }
    var searchBusy by remember { mutableStateOf(false) }
    var route by remember { mutableStateOf<TodayRoute?>(null) }
    var routeMode by remember { mutableStateOf("auto") }
    var routeLoading by remember { mutableStateOf(false) }
    var drawnRoute by remember { mutableStateOf<Polyline?>(null) }
    val session by TodayNavigationSession.state.collectAsState()
    val navigationActive=session.active
    val navProgress=session.progress
    var savedRouteAvailable by remember { mutableStateOf(TodaySavedRoute.load(context)!=null) }
    val fineGranted=ContextCompat.checkSelfPermission(context,
        Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED
    val finePrompt=rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()) { permissions ->
        if(permissions[Manifest.permission.ACCESS_FINE_LOCATION]==true) {
            runCatching { TodayNavigationService.start(context) }
                .onFailure { error="Gagal menghidupkan navigasi: "+it.message }
        } else error="Navigasi skrin terkunci memerlukan lokasi tepat."
    }
    LaunchedEffect(session.latitude,session.longitude,navigationActive) {
        if(navigationActive && session.latitude!=null && session.longitude!=null) {
            mapView.getMapAsync { map ->
                map.cameraPosition=CameraPosition.Builder()
                    .target(LatLng(session.latitude!!,session.longitude!!))
                    .zoom(16.2).build()
            }
        }
    }
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
                    route=null
                    drawnRoute?.let { map.removePolyline(it) }
                    drawnRoute=null
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
    LaunchedEffect(route,mapReady) {
        val result=route
        if(result!=null && mapReady) {
            mapView.getMapAsync { map ->
                drawnRoute?.let { map.removePolyline(it) }
                val path=result.points.map { LatLng(it.latitude,it.longitude) }
                if(path.size>=2) {
                    @Suppress("DEPRECATION")
                    drawnRoute=map.addPolyline(PolylineOptions().addAll(path)
                        .color(android.graphics.Color.rgb(229,195,136)).width(6f))
                    val bounds=LatLngBounds.Builder().includes(path).build()
                    map.animateCamera(CameraUpdateFactory.newLatLngBounds(bounds,55),600)
                }
            }
        }
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
                Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(7.dp),
                    verticalAlignment=Alignment.CenterVertically) {
                    AksaraGlassSurface(Modifier.weight(1f).height(41.dp),radius=11.dp) {
                        BasicTextField(searchTerm,{searchTerm=it.take(90)},
                            Modifier.fillMaxSize().padding(horizontal=10.dp,vertical=10.dp),
                            singleLine=true,
                            textStyle=AksaraTypography.style(11f,16f),
                            cursorBrush=SolidColor(AksaraColors.gold),
                            decorationBox={inner->Box {
                                if(searchTerm.isBlank())AksaraText("Cari tempat atau alamat",
                                    size=10.5f,color=AksaraColors.muted)
                                inner()
                            }})
                    }
                    AksaraButton(if(searchBusy)"…" else "Cari",{
                        val query=searchTerm.trim()
                        if(query.length>=3 && !searchBusy) {
                            searchBusy=true
                            error=null
                            scope.launch {
                                val result=withContext(Dispatchers.IO) {
                                    @Suppress("DEPRECATION")
                                    runCatching {
                                        if(!android.location.Geocoder.isPresent())null
                                        else android.location.Geocoder(context,Locale("ms","MY"))
                                            .getFromLocationName(query,1)?.firstOrNull()
                                    }.getOrNull()
                                }
                                if(result==null)error="Tempat tidak ditemui oleh geocoder peranti. Pilih terus pada peta."
                                else {
                                    destination=LatLng(result.latitude,result.longitude)
                                    focus=destination
                                    route=null
                                }
                                searchBusy=false
                            }
                        }
                    },Modifier.width(69.dp),height=41.dp,size=10.5f,
                        enabled=searchTerm.trim().length>=3 && !searchBusy)
                }
                AksaraText(destination?.let{
                    "Destinasi dipilih: "+String.format(Locale.US,"%.5f, %.5f",it.latitude,it.longitude)
                } ?: "Tekan peta untuk pilih destinasi.",size=10.5f,color=AksaraColors.muted)
                Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                    listOf("auto" to "Kereta","pedestrian" to "Jalan kaki",
                        "bicycle" to "Basikal").forEach { (mode,label) ->
                        AksaraButton(if(routeMode==mode)"✓ "+label else label,{
                            routeMode=mode
                            route=null
                        },Modifier.weight(1f),height=34.dp,size=9.2f)
                    }
                }
                if(route==null && savedRouteAvailable) {
                    AksaraButton("Buka laluan tersimpan (offline)",{
                        val saved=TodaySavedRoute.load(context)
                        if(saved!=null) {
                            route=saved
                            routeMode="auto"
                            val point=saved.points.last()
                            destination=LatLng(point.latitude,point.longitude)
                            error=null
                        } else error="Laluan tersimpan tidak tersedia."
                    },Modifier.fillMaxWidth(),height=35.dp,size=10f)
                }
                AksaraButton(if(routeLoading)"Mengira laluan…" else "Kira laluan",{
                    val point=destination
                    if(point!=null && !routeLoading) {
                        routeLoading=true
                        error=null
                        scope.launch {
                            runCatching {
                                routingRepo.route(location,
                                    RouteCoordinate(point.latitude,point.longitude),routeMode)
                            }.onSuccess {
                                route=it
                                savedRouteAvailable=TodaySavedRoute.save(context,it)
                            }.onFailure { error=it.message ?: "Laluan tidak tersedia." }
                            routeLoading=false
                        }
                    }
                },Modifier.fillMaxWidth(),height=39.dp,size=11f,
                    enabled=destination!=null && !routeLoading)
                if(route!=null) {
                    AksaraButton("Simpan peta kecil untuk offline",{
                        val current=route
                        if(current!=null) {
                            TodayOfflineMaps.downloadSmallArea(context,current) { offlineStatus=it }
                        }
                    },Modifier.fillMaxWidth(),height=35.dp,size=10.3f)
                    if(offlineStatus.isNotBlank())AksaraText(offlineStatus,size=9.6f,
                        color=AksaraColors.muted)
                }
                if(route!=null && routeMode=="auto") {
                    AksaraText("Trafik langsung • TomTom (pilihan, kunci sendiri)",
                        size=11f,weight=650,color=AksaraColors.gold)
                    AksaraGlassSurface(Modifier.fillMaxWidth().height(39.dp),radius=12.dp) {
                        BasicTextField(trafficKey,{trafficKey=it.take(128)},
                            Modifier.fillMaxSize().padding(horizontal=10.dp,vertical=9.dp),
                            singleLine=true,visualTransformation=PasswordVisualTransformation(),textStyle=AksaraTypography.style(11f,16f),
                            cursorBrush=SolidColor(AksaraColors.gold),
                            decorationBox={inner->Box {
                                if(trafficKey.isBlank())AksaraText("Masukkan TomTom API key (tidak disimpan)",
                                    size=10.5f,color=AksaraColors.muted)
                                inner()
                            }})
                    }
                    AksaraButton(if(trafficLoading)"Menyemak…" else "Semak kelajuan trafik langsung",{
                        val current=route
                        if(current!=null && !trafficLoading && trafficKey.isNotBlank()) {
                            trafficLoading=true
                            error=null
                            scope.launch {
                                val midpoint=current.points[current.points.size/2]
                                runCatching { trafficRepo.sample(midpoint,trafficKey) }
                                    .onSuccess { trafficFlow=it }
                                    .onFailure { error="Trafik belum tersedia: "+it.message }
                                trafficLoading=false
                            }
                        }
                    },Modifier.fillMaxWidth(),height=35.dp,size=10f,
                        enabled=trafficKey.isNotBlank() && !trafficLoading)
                    val flow=trafficFlow
                    if(flow!=null) {
                        AksaraText("Segmen berhampiran laluan: "+
                            flow.currentKmh+" km/j (lancar "+flow.freeFlowKmh+" km/j)"+
                            (if(flow.roadClosed)" • JALAN DITUTUP" else ""),
                            size=10.5f,color=if(flow.roadClosed)Color(0xFFF1A5A1)
                            else AksaraColors.gold)
                        AksaraText("Sampel satu segmen TomTom, bukan ETA trafik seluruh laluan. "+
                            "Key kekal dalam sesi ini sahaja; tiada bil diaktifkan oleh Aksara.",
                            size=9.5f,color=AksaraColors.muted)
                    } else AksaraText("Belum dikonfigurasikan. Tanpa kunci TomTom, hanya ETA "+
                        "Valhalla biasa digunakan.",size=9.5f,color=AksaraColors.muted)
                }
                if(route!=null) {
                    AksaraButton(if(navigationActive)"Hentikan panduan" else "Mulakan panduan • skrin terkunci",{
                        if(navigationActive) {
                            TodayNavigationService.stop(context)
                        } else {
                            val currentRoute=route
                            if(currentRoute==null || !TodaySavedRoute.save(context,currentRoute)) {
                                error="Tidak dapat menyimpan laluan untuk navigasi."
                            } else if(fineGranted) {
                                runCatching { TodayNavigationService.start(context) }
                                    .onFailure { error="Gagal memulakan navigasi: "+it.message }
                            } else {
                                finePrompt.launch(arrayOf(Manifest.permission.ACCESS_COARSE_LOCATION,
                                    Manifest.permission.ACCESS_FINE_LOCATION))
                            }
                        }
                    },Modifier.fillMaxWidth(),height=38.dp,size=11f)
                    if(navigationActive) {
                        val progress=navProgress
                        AksaraText("GPS langsung • "+(if(session.voiceAvailable)
                            "Suara Melayu aktif" else "Suara Melayu tidak tersedia pada peranti"),
                            size=10f,color=AksaraColors.gold)
                        if(progress!=null) {
                            AksaraText(String.format(Locale.US,"Baki %.1f km • Jarak ke arahan %.0f m",
                                progress.remainingMetres/1000.0,
                                progress.distanceToStepMetres.coerceAtMost(99_999.0)),
                                size=10f,color=AksaraColors.muted)
                            AksaraText(progress.nextStep?.let{
                                TodayNavigationMath.malayVoice(it.type)} ?: "Ikut peta.",
                                size=11f,weight=650)
                        }
                    }
                }
                if(route!=null) {
                    val result=route!!
                    AksaraText(String.format(Locale.US,"%.1f km • %d minit",
                        result.kilometres,(result.seconds+59)/60),size=12f,
                        weight=700,color=AksaraColors.gold)
                    AksaraText("ETA Valhalla tidak mengambil kira trafik. Bacaan TomTom di atas ialah segmen berasingan.",
                        size=9.5f,color=AksaraColors.muted)
                    result.steps.take(3).forEach { step ->
                        AksaraText("• "+step.instruction,size=10f,color=AksaraColors.muted)
                    }
                }
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
                AksaraText("Skrin terkunci: GPS dan suara diteruskan dengan notifikasi aktif. Laluan tersimpan boleh diikuti offline, tetapi laluan baharu dan trafik memerlukan internet.",
                    size=9.5f,line=14f,color=AksaraColors.muted)
                if(error!=null)AksaraText(error!!,size=10.5f,color=Color(0xFFF1A5A1))
            }
        }
    }
}
