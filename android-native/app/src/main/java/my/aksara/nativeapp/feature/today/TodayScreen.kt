package my.aksara.nativeapp.feature.today

import android.Manifest
import android.content.Context
import android.location.Geocoder
import android.location.Location
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.hazeSource
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import my.aksara.nativeapp.core.design.*
import my.aksara.nativeapp.feature.chat.ChatWallpaper
import my.aksara.nativeapp.feature.chat.AksaraGlassModal
import java.text.NumberFormat
import java.time.Duration
import java.time.Instant
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

private val todayMuted=Color(0xFFD2DCEB)
private val todayGold=Color(0xFFE5C388)
private val malay=Locale("ms","MY")
private val malaysiaZone=ZoneId.of("Asia/Kuala_Lumpur")
private fun todayCondition(code:Int)=when(code) {
    0 -> "Cerah"
    1,2 -> "Sebahagiannya berawan"
    3 -> "Berawan"
    45,48 -> "Berkabus"
    51,53,55,56,57 -> "Gerimis"
    61,63,65,66,67,80,81,82 -> "Hujan"
    71,73,75,77,85,86 -> "Salji"
    95,96,99 -> "Ribut petir"
    else -> "Keadaan cuaca"
}

private fun money(value:Double):String=NumberFormat.getCurrencyInstance(Locale.US).apply {
    maximumFractionDigits=if(value<1.0)4 else 2
}.format(value)

internal fun nextPrayer(prayer:TodayPrayer?,now:LocalTime):Pair<String,String>? {
    if(prayer==null)return null
    val next=prayer.times.firstOrNull { (_,time) ->
        runCatching { LocalTime.parse(time).isAfter(now) }.getOrDefault(false)
    } ?: prayer.times.firstOrNull() ?: return null // Next day's Subuh after Isyak.
    val minutes=Duration.between(now,LocalTime.parse(next.second)).toMinutes()
    val remaining=if(minutes<0)minutes+24L*60L else minutes
    val hours=remaining/60L
    val mins=remaining%60L
    val duration=when {
        hours>0 && mins>0 -> "$hours jam $mins minit"
        hours>0 -> "$hours jam"
        else -> "$mins minit"
    }
    return next.first to duration
}

@Suppress("DEPRECATION")
private fun resolveCity(context:Context,location:Location):String? {
    if(!Geocoder.isPresent())return null
    return runCatching {
        val place=Geocoder(context,malay).getFromLocation(location.latitude,location.longitude,1)
            ?.firstOrNull()
        listOf(place?.locality,place?.subAdminArea,place?.subLocality)
            .firstOrNull { !it.isNullOrBlank() }
    }.getOrNull()
}

private fun localIsoTime(iso:String):String?=runCatching {
    Instant.parse(iso).atZone(malaysiaZone)
        .format(DateTimeFormatter.ofPattern("dd MMM, HH:mm",malay))
}.getOrNull()

private fun updatedLabel(at:Long?,cached:Boolean):String {
    val time=at?.let {
        Instant.ofEpochMilli(it).atZone(malaysiaZone)
            .format(DateTimeFormatter.ofPattern("dd MMM, HH:mm",malay))
    } ?: "masa tidak tersedia"
    return (if(cached) "Data cache • terakhir " else "Dikemas kini ")+time
}

@Composable private fun TodayCard(
    title:String,onClick:(()->Unit)?=null,content:@Composable ()->Unit
) {
    AksaraGlassSurface(Modifier.fillMaxWidth().then(
        if(onClick!=null)Modifier.clickable(onClick=onClick) else Modifier
    ),radius=20.dp,blur=12.dp) {
        Column(Modifier.fillMaxWidth().padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
            AksaraText(title,size=14f,weight=700,color=todayGold)
            content()
        }
    }
}

@Composable private fun TodayPending(message:String) {
    AksaraText(message,size=11.5f,line=17f,color=todayMuted)
}
/** The location education sheet is displayed on first entry, never as a surprise OS prompt. */
internal fun shouldShowTodayLocationIntro(active:Boolean,permissionGranted:Boolean,introShown:Boolean):Boolean =
    active && !permissionGranted && !introShown

@Composable internal fun TodayScreen(
    active:Boolean,onBack:()->Unit,
    onDialogVisibilityChange:(Boolean)->Unit={}
) {
    val context=LocalContext.current
    val repo=remember(context) { TodayRepository(context) }
    val detailRepo=remember(context) { TodayDetailRepository(context) }
    val permissionPrefs=remember(context) {
        context.getSharedPreferences("aksara_today_v1_permissions",Context.MODE_PRIVATE)
    }
    var permissionLocation by remember { mutableStateOf(hasTodayLocationPermission(context)) }
    var introShown by remember { mutableStateOf(permissionPrefs.getBoolean("today_all_permissions_intro_shown",false)) }
    var showLocationDialog by rememberSaveable { mutableStateOf(false) }
    var detailWindow by rememberSaveable { mutableStateOf<String?>(null) }
    var gestureMessage by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(gestureMessage) {
        if(gestureMessage!=null) {
            delay(1_800L)
            gestureMessage=null
        }
    }
    LaunchedEffect(active,showLocationDialog,detailWindow) {
        onDialogVisibilityChange(active && (showLocationDialog || detailWindow!=null))
    }
    DisposableEffect(Unit) {
        onDispose { onDialogVisibilityChange(false) }
    }
    fun explainLocation() {
        introShown=true
        permissionPrefs.edit().putBoolean("today_all_permissions_intro_shown",true).apply()
        showLocationDialog=true
    }
    BackHandler(enabled=active) {
        when {
            detailWindow!=null -> detailWindow=null
            showLocationDialog -> showLocationDialog=false
            else -> onBack()
        }
    }
    var epoch by remember { mutableIntStateOf(0) }
    var locating by remember { mutableStateOf(false) }
    var locationReady by remember { mutableStateOf(false) }
    var city by remember { mutableStateOf<String?>(null) }
    var latestLocation by remember { mutableStateOf<Location?>(null) }
    var weather by remember { mutableStateOf<TodayFeed<TodayWeather>?>(null) }
    var prayer by remember { mutableStateOf<TodayFeed<TodayPrayer>?>(null) }
    var crypto by remember { mutableStateOf<TodayFeed<List<TodayCoin>>?>(null) }
    var github by remember { mutableStateOf<TodayFeed<TodayCommit>?>(null) }
    var clock by remember { mutableStateOf(ZonedDateTime.now()) }
    val todayPermissionPrompt=rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()) { grants ->
        permissionLocation=hasTodayLocationPermission(context) ||
            grants[Manifest.permission.ACCESS_COARSE_LOCATION]==true ||
            grants[Manifest.permission.ACCESS_FINE_LOCATION]==true
        epoch++
    }
    LaunchedEffect(active) {
        if(active) {
            permissionLocation=hasTodayLocationPermission(context)
            if(active && !introShown) explainLocation()
        }
    }

    LaunchedEffect(active,detailWindow) {
        while(active) {
            clock=ZonedDateTime.now()
            delay(if(detailWindow=="clock")1_000L else 30_000L)
        }
    }
    LaunchedEffect(active,epoch,permissionLocation) {
        if(!active)return@LaunchedEffect
        launch { crypto=repo.crypto(force=epoch>0) }
        launch { github=repo.github(force=epoch>0) }
        if(permissionLocation) {
            locating=true
            val found=withTimeoutOrNull(12_000L) { todayLocation(context) }
            locating=false
            locationReady=found!=null
            latestLocation=found
            if(found!=null) {
                city=null
                launch { city=withContext(Dispatchers.IO) { resolveCity(context,found) } }
                weather=null
                prayer=null
                launch { weather=repo.weather(found,force=epoch>0) }
                launch { prayer=repo.prayer(found,force=epoch>0) }
            } else { city=null; weather=null; prayer=null }
        } else {
            latestLocation=null
            locationReady=false
            city=null
            weather=null
            prayer=null
        }
    }
    val dateLabel=clock.format(DateTimeFormatter.ofPattern("EEEE, d MMMM yyyy",malay))
    val prayerNow=LocalTime.now(malaysiaZone)
    val countdown=nextPrayer(prayer?.value,prayerNow)
    val latestUpdate=listOfNotNull(weather?.updatedAt,prayer?.updatedAt,crypto?.updatedAt,github?.updatedAt).maxOrNull()
    val anyCached=listOfNotNull(weather,prayer,crypto,github).any { it.fromCache }
    val wallpaperBackdrop=remember { HazeState() }

    CompositionLocalProvider(LocalBackdrop provides wallpaperBackdrop) {
        Box(Modifier.fillMaxSize()) {
            ChatWallpaper(Modifier.fillMaxSize().hazeSource(wallpaperBackdrop))
            var dragDown by remember { mutableFloatStateOf(0f) }
            val refreshModifier=Modifier.pointerInput(active,detailWindow,showLocationDialog) {
                if(active && detailWindow==null && !showLocationDialog) {
                    val threshold=100.dp.toPx()
                    detectVerticalDragGestures(
                        onDragStart={dragDown=0f},
                        onVerticalDrag={_,delta->dragDown=(dragDown+delta).coerceAtLeast(0f)},
                        onDragEnd={
                            if(dragDown>threshold) {
                                epoch++
                                gestureMessage="Menyegarkan data…"
                            }
                            dragDown=0f
                        },
                        onDragCancel={dragDown=0f}
                    )
                }
            }
            Column(Modifier.fillMaxSize().safeDrawingPadding().then(refreshModifier)
                .padding(horizontal=15.dp,vertical=8.dp),
                verticalArrangement=Arrangement.spacedBy(8.dp)) {
                AksaraGlassSurface(Modifier.fillMaxWidth().weight(.155f).clickable {
                    detailWindow="clock"
                },radius=19.dp,blur=12.dp) {
                    Column(Modifier.fillMaxSize().padding(5.dp),
                        horizontalAlignment=Alignment.CenterHorizontally,
                        verticalArrangement=Arrangement.Center) {
                        AksaraText(clock.format(DateTimeFormatter.ofPattern("HH:mm")),
                            size=34f,weight=650)
                        AksaraText(dateLabel,size=10.5f,color=todayMuted)
                    }
                }
                AksaraGlassSurface(Modifier.fillMaxWidth().weight(.265f),radius=19.dp,blur=12.dp) {
                    Column(Modifier.fillMaxSize().padding(10.dp),
                        verticalArrangement=Arrangement.spacedBy(6.dp)) {
                        AksaraText("Cuaca & Lokasi",size=12.5f,weight=700,color=todayGold)
                        Row(Modifier.fillMaxWidth().weight(1f),
                            horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                            AksaraGlassSurface(Modifier.weight(.60f).fillMaxHeight()
                                .clickable { detailWindow="weather" },radius=14.dp,blur=7.dp) {
                                Column(Modifier.fillMaxSize().padding(8.dp),
                                    verticalArrangement=Arrangement.SpaceBetween) {
                                    val value=weather?.value
                                    AksaraText("CUACA",size=9f,color=todayGold)
                                    AksaraText(value?.let{String.format(Locale.US,"%.1f°C",it.celsius)}
                                        ?: if(!permissionLocation)"Aktifkan lokasi" else "Tiada data",
                                        size=if(value==null)12f else 22f,weight=650)
                                    AksaraText(value?.let{todayCondition(it.code)} ?: "Tekan untuk butiran",
                                        size=10f,color=todayMuted)
                                    AksaraText(value?.rainChance?.let{"Hujan "+it+"%"} ?: " ",
                                        size=9.5f,color=todayMuted)
                                }
                            }
                            TodayMiniMap(latestLocation,city,active,epoch,
                                Modifier.weight(.40f).fillMaxHeight(),onClick={
                                    if(!permissionLocation)explainLocation()
                                    else detailWindow="map"
                                })
                        }
                    }
                }
                AksaraGlassSurface(Modifier.fillMaxWidth().weight(.235f)
                    .clickable{detailWindow="prayer"},radius=19.dp,blur=12.dp) {
                    Column(Modifier.fillMaxSize().padding(horizontal=12.dp,vertical=8.dp),
                        verticalArrangement=Arrangement.SpaceBetween) {
                        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween) {
                            AksaraText("Waktu Solat & Hijrah",size=12.5f,weight=700,color=todayGold)
                            AksaraText(prayer?.value?.zone ?: "—",size=9f,color=todayMuted)
                        }
                        if(prayer?.value!=null) {
                            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(3.dp)) {
                                prayer!!.value!!.times.forEach { (name,time) ->
                                    Column(Modifier.weight(1f),horizontalAlignment=Alignment.CenterHorizontally,
                                        verticalArrangement=Arrangement.spacedBy(4.dp)) {
                                        AksaraText(name,size=9.2f,color=todayMuted)
                                        AksaraText(time,size=10.4f,weight=650,color=todayGold)
                                    }
                                }
                            }
                            AksaraText(countdown?.let{"Seterusnya: "+it.first+" • "+it.second+" lagi"}
                                ?: "Waktu seterusnya tidak tersedia",size=10.3f,color=todayMuted)
                        } else TodayPending(if(!permissionLocation)"Aktifkan lokasi untuk jadual solat."
                            else "Waktu solat tidak tersedia.")
                    }
                }
                AksaraGlassSurface(Modifier.fillMaxWidth().weight(.17f)
                    .clickable{detailWindow="crypto"},radius=19.dp,blur=12.dp) {
                    Column(Modifier.fillMaxSize().padding(horizontal=12.dp,vertical=8.dp),
                        verticalArrangement=Arrangement.SpaceBetween) {
                        AksaraText("Pasaran Kripto · USD",size=12.5f,weight=700,color=todayGold)
                        val coins=crypto?.value.orEmpty()
                        if(coins.isEmpty())TodayPending("Harga belum tersedia.")
                        else Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(4.dp)) {
                            coins.take(3).forEach { coin ->
                                Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(2.dp)) {
                                    AksaraText(coin.symbol,size=9.5f,color=todayMuted)
                                    AksaraText(money(coin.usd),size=10.5f,weight=650)
                                    AksaraText(String.format(Locale.US,"%+.2f%%",coin.change24h),
                                        size=9f,color=if(coin.change24h>=0)Color(0xFF87D6AD)
                                        else Color(0xFFF1A5A1))
                                }
                            }
                        }
                    }
                }
                AksaraGlassSurface(Modifier.fillMaxWidth().weight(.175f)
                    .clickable{detailWindow="development"},radius=19.dp,blur=12.dp) {
                    Column(Modifier.fillMaxSize().padding(horizontal=12.dp,vertical=8.dp),
                        verticalArrangement=Arrangement.SpaceBetween) {
                        AksaraText("Aktiviti Pembangunan · GitHub",size=12.5f,weight=700,color=todayGold)
                        if(github?.value!=null) {
                            val commit=github!!.value!!
                            AksaraText("Android · "+commit.sha.take(7)+" · "+
                                (localIsoTime(commit.date) ?: "masa tiada"),
                                size=9.5f,color=todayMuted)
                            AksaraText(commit.message.take(75),size=10.5f,weight=600,line=13f)
                        } else TodayPending("Aktiviti GitHub belum tersedia.")
                    }
                }
            }
            if(gestureMessage!=null && active && detailWindow==null && !showLocationDialog) {
                AksaraGlassSurface(Modifier.align(Alignment.TopCenter)
                    .safeDrawingPadding().padding(top=8.dp),radius=999.dp,blur=12.dp) {
                    AksaraText(gestureMessage!!,Modifier.padding(horizontal=14.dp,vertical=8.dp),
                        size=10.5f,color=todayGold)
                }
            }
            if(detailWindow!=null && active) {
                TodayDetailWindow(
                    kind=detailWindow!!,onClose={detailWindow=null},clock=clock,
                    weather=weather,prayer=prayer,coins=crypto,github=github,
                    location=latestLocation,city=city,detailRepo=detailRepo
                )
            }
            if(showLocationDialog && active) {
                AksaraGlassModal(onClose={ showLocationDialog=false },preferredHeight=365.dp) {
                    Column(Modifier.fillMaxSize().padding(18.dp),
                        verticalArrangement=Arrangement.spacedBy(11.dp)) {
                        Row(verticalAlignment=Alignment.CenterVertically,
                            horizontalArrangement=Arrangement.spacedBy(12.dp)) {
                            AksaraGlassSurface(Modifier.size(44.dp),radius=999.dp) {
                                AksaraIcon("location",Modifier.align(Alignment.Center).size(23.dp),todayGold)
                            }
                            Column(Modifier.weight(1f)) {
                                AksaraText("Kebenaran AKSARA TODAY",size=17f,weight=700)
                                AksaraText("AKSARA TODAY • SEMUA AKSES BERKAITAN",
                                    size=9.5f,color=todayGold)
                            }
                        }
                        AksaraText("Lokasi: cuaca, solat, peta dan panduan GPS. Kalendar: membaca agenda. Notifikasi: paparan arahan ketika navigasi di latar/skrin terkunci. Benarkan semua melalui dialog Android.",
                            size=12.5f,line=19f)
                        AksaraText("Izin boleh ditolak. Jam, kripto dan GitHub tetap berfungsi. Tiada mikrofon/Bluetooth diminta oleh TODAY. Lokasi boleh dihantar kepada penyedia cuaca, solat, peta dan routing.",
                            size=10.5f,line=17f,color=todayMuted)
                        Spacer(Modifier.weight(1f))
                        Row(Modifier.fillMaxWidth(),
                            horizontalArrangement=Arrangement.spacedBy(9.dp)) {
                            AksaraButton("Bukan sekarang",{showLocationDialog=false},
                                Modifier.weight(1f),height=42.dp,size=10.5f)
                            AksaraButton("Benarkan semua",{
                                showLocationDialog=false
                                todayPermissionPrompt.launch(arrayOf(
                                    Manifest.permission.ACCESS_COARSE_LOCATION,
                                    Manifest.permission.ACCESS_FINE_LOCATION,
                                    Manifest.permission.READ_CALENDAR
                                ) + if(android.os.Build.VERSION.SDK_INT>=33)
                                    arrayOf(Manifest.permission.POST_NOTIFICATIONS)
                                else emptyArray<String>())
                            },Modifier.weight(1f),height=42.dp,size=10.5f)
                        }
                    }
                }
            }
        }
    }
}
