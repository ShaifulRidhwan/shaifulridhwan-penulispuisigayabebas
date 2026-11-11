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
    var navigationActive by remember { mutableStateOf(false) }
    var liveLocation by remember { mutableStateOf<Location?>(null) }
    var navProgress by remember { mutableStateOf<TodayNavProgress?>(null) }
    var lastIndex by remember { mutableIntStateOf(0) }
    var lastAnnounced by remember { mutableIntStateOf(-1) }
    var offRouteSamples by remember { mutableIntStateOf(0) }
    var lastRerouteAt by remember { mutableLongStateOf(0L) }
    val navigationVoice=remember(context) { TodayNavigationVoice(context) }
    val fineGranted=ContextCompat.checkSelfPermission(context,
        Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED
    val finePrompt=rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()) { permissions ->
        if(permissions[Manifest.permission.ACCESS_FINE_LOCATION]==true)navigationActive=true
        else error="Navigasi langsung memerlukan izin lokasi tepat."
    }
    DisposableEffect(navigationVoice) { onDispose { navigationVoice.stop() } }
    DisposableEffect(owner,navigationActive) {
        val observer=LifecycleEventObserver { _,event ->
            if(event==Lifecycle.Event.ON_STOP)navigationActive=false
        }
        owner.lifecycle.addObserver(observer)
        onDispose { owner.lifecycle.removeObserver(observer) }
    }
    LaunchedEffect(route) {
        lastIndex=0
        lastAnnounced=-1
        offRouteSamples=0
    }
    DisposableEffect(navigationActive,route) {
        if(!navigationActive || route==null) return@DisposableEffect onDispose { }
        val service=context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val listener=object:LocationListener {
            override fun onLocationChanged(position:Location) {liveLocation=position}
        }
        try {
            var watching=false
            listOf(LocationManager.GPS_PROVIDER,LocationManager.NETWORK_PROVIDER).forEach { provider ->
                if(service.isProviderEnabled(provider)) {
                    service.requestLocationUpdates(provider,1_500L,3f,listener,Looper.getMainLooper())
                    watching=true
                }
            }
            if(!watching)error="GPS/lokasi peranti belum diaktifkan."
        } catch(e:SecurityException) {
            error="Izin lokasi tepat telah ditarik balik."
            navigationActive=false
        } catch(e:Exception) {error="Tidak dapat memulakan GPS: "+e.message}
        onDispose { runCatching { service.removeUpdates(listener) } }
    }
    LaunchedEffect(navigationActive,liveLocation,route) {
        val current=liveLocation
        val currentRoute=route
        if(navigationActive && current!=null && currentRoute!=null) {
            val position=RouteCoordinate(current.latitude,current.longitude)
            val progress=TodayNavigationMath.progress(currentRoute,position,lastIndex)
            navProgress=progress
            lastIndex=progress.nearestIndex
            mapView.getMapAsync { map ->
                map.cameraPosition=CameraPosition.Builder()
                    .target(LatLng(current.latitude,current.longitude))
                    .zoom(16.2).bearing(current.bearing.toDouble()).tilt(35.0).build()
            }
            val upcoming=progress.nextStep
            if(upcoming!=null && progress.distanceToStepMetres<=140.0 &&
                upcoming.shapeIndex!=lastAnnounced && progress.offRouteMetres<65.0) {
                navigationVoice.speakMalay(TodayNavigationMath.malayVoice(upcoming.type))
                lastAnnounced=upcoming.shapeIndex
            }
            if(progress.remainingMetres<35.0 && progress.offRouteMetres<45.0) {
                navigationVoice.speakMalay("Destinasi sudah tiba.")
                navigationActive=false
            } else {
                offRouteSamples=if(progress.offRouteMetres>120.0)offRouteSamples+1 else 0
                val now=System.currentTimeMillis()
                val point=destination
                if(offRouteSamples>=3 && point!=null && now-lastRerouteAt>60_000L) {
                    lastRerouteAt=now
                    offRouteSamples=0
                    runCatching {
                        routingRepo.route(current,
                            RouteCoordinate(point.latitude,point.longitude),routeMode)
                    }.onSuccess {
                        route=it
                        navigationVoice.speakMalay("Laluan telah dikira semula.")
                    }.onFailure {error="Tidak dapat kira laluan semula: "+it.message}
                }
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
                AksaraButton(if(routeLoading)"Mengira laluan…" else "Kira laluan",{
                    val point=destination
                    if(point!=null && !routeLoading) {
                        routeLoading=true
                        error=null
                        scope.launch {
                            runCatching {
                                routingRepo.route(location,
                                    RouteCoordinate(point.latitude,point.longitude),routeMode)
                            }.onSuccess { route=it }
                                .onFailure { error=it.message ?: "Laluan tidak tersedia." }
                            routeLoading=false
                        }
                    }
                },Modifier.fillMaxWidth(),height=39.dp,size=11f,
                    enabled=destination!=null && !routeLoading)
                if(route!=null) {
                    AksaraButton(if(navigationActive)"Hentikan panduan" else "Mulakan panduan GPS",{
                        if(navigationActive) {
                            navigationActive=false
                            navProgress=null
                        } else if(fineGranted) {
                            navigationActive=true
                            liveLocation=null
                            navigationVoice.speakMalay("Panduan laluan dimulakan.")
                        } else {
                            error="Aktifkan lokasi tepat untuk navigasi langsung."
                            finePrompt.launch(arrayOf(Manifest.permission.ACCESS_COARSE_LOCATION,
                                Manifest.permission.ACCESS_FINE_LOCATION))
                        }
                    },Modifier.fillMaxWidth(),height=38.dp,size=11f)
                    if(navigationActive) {
                        val progress=navProgress
                        AksaraText("GPS langsung • "+(if(navigationVoice.isMalayReady())
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
                    AksaraText("Anggaran laluan Valhalla/OSM. Tiada trafik langsung.",
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
                AksaraText("GPS dan arahan suara berfungsi selagi skrin navigasi aktif. Tiada trafik langsung atau navigasi latar. Sentiasa perhatikan keadaan jalan.",
                    size=9.5f,line=14f,color=AksaraColors.muted)
                if(error!=null)AksaraText(error!!,size=10.5f,color=Color(0xFFF1A5A1))
            }
        }
    }
}
