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
    var introShown by remember { mutableStateOf(permissionPrefs.getBoolean("location_intro_shown",false)) }
    var showLocationDialog by rememberSaveable { mutableStateOf(false) }
    var detailWindow by rememberSaveable { mutableStateOf<String?>(null) }
    LaunchedEffect(active,showLocationDialog,detailWindow) {
        onDialogVisibilityChange(active && (showLocationDialog || detailWindow!=null))
    }
    DisposableEffect(Unit) {
        onDispose { onDialogVisibilityChange(false) }
    }
    fun explainLocation() {
        introShown=true
        permissionPrefs.edit().putBoolean("location_intro_shown",true).apply()
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
    val locationPrompt=rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()) { granted ->
        permissionLocation=granted || hasTodayLocationPermission(context)
        epoch++
    }
    LaunchedEffect(active) {
        if(active) {
            permissionLocation=hasTodayLocationPermission(context)
            if(shouldShowTodayLocationIntro(active,permissionLocation,introShown)) explainLocation()
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
            Column(Modifier.fillMaxSize().safeDrawingPadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal=17.dp,vertical=12.dp),
                verticalArrangement=Arrangement.spacedBy(11.dp)) {
                Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically,
                    horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                    AksaraButton("‹",onBack,Modifier.width(42.dp),height=40.dp,radius=13.dp,size=23f)
                    Column(Modifier.weight(1f)) {
                        AksaraText("AKSARA TODAY",size=15f,weight=700,color=todayGold)
                        AksaraText("Ruang Hari Ini",size=10f,color=todayMuted)
                    }
                    Column(horizontalAlignment=Alignment.End,verticalArrangement=Arrangement.spacedBy(4.dp)) {
                        AksaraButton("Refresh",{
                            epoch++
                            if(!permissionLocation) explainLocation()
                        },height=40.dp,size=10f,radius=13.dp)
                        AksaraText(when {
                            latestUpdate==null -> "Belum dikemas kini"
                            anyCached -> "Cache • "+updatedLabel(latestUpdate,false)
                            else -> updatedLabel(latestUpdate,false)
                        },size=9.5f,line=13f,color=todayMuted)
                    }
                }
                AksaraGlassSurface(Modifier.fillMaxWidth().clickable {
                    detailWindow="clock"
                },radius=20.dp,blur=12.dp) {
                    Column(Modifier.fillMaxWidth().padding(vertical=14.dp,horizontal=16.dp),
                        horizontalAlignment=Alignment.CenterHorizontally) {
                        AksaraText(clock.format(DateTimeFormatter.ofPattern("HH:mm")),
                            size=37f,weight=650)
                        AksaraText(dateLabel,size=11f,color=todayMuted)
                    }
                }
                TodayCard("Cuaca & Lokasi") {
                    Row(Modifier.fillMaxWidth().height(158.dp),
                        horizontalArrangement=Arrangement.spacedBy(9.dp)) {
                        AksaraGlassSurface(
                            Modifier.weight(.60f).fillMaxHeight().clickable {
                                detailWindow="weather"
                            },radius=16.dp,blur=8.dp
                        ) {
                            Column(Modifier.fillMaxSize().padding(11.dp),
                                verticalArrangement=Arrangement.SpaceBetween) {
                                AksaraText("CUACA",size=9.5f,weight=700,color=todayGold)
                                val value=weather?.value
                                if(value!=null) {
                                    AksaraText(String.format(Locale.US,"%.1f°C",value.celsius),
                                        size=24f,weight=700)
                                    AksaraText(todayCondition(value.code),size=11f,weight=600)
                                    AksaraText("Angin "+
                                        String.format(Locale.US,"%.0f",value.windKmh)+" km/j",
                                        size=10f,color=todayMuted)
                                    AksaraText(value.rainChance?.let{"Hujan "+it+"%"}
                                        ?: "Hujan: tiada data",size=10f,color=todayMuted)
                                } else {
                                    AksaraText(if(!permissionLocation)"Aktifkan lokasi"
                                        else if(locating)"Mengesan lokasi…"
                                        else "Cuaca belum tersedia",size=11f,line=17f)
                                    AksaraText("Tekan untuk butiran",size=9.5f,color=todayMuted)
                                }
                            }
                        }
                        TodayMiniMap(
                            latestLocation,city,active,
                            Modifier.weight(.40f).fillMaxHeight(),
                            onClick={
                                if(!permissionLocation) explainLocation()
                                else detailWindow="map"
                            }
                        )
                    }
                }
                TodayCard("Waktu Solat & Hijrah",onClick={ detailWindow="prayer" }) {
                    val value=prayer?.value
                    when {
                        !permissionLocation -> TodayPending("Waktu solat memerlukan zon lokasi. Aktifkan di kad Cuaca.")
                        locating -> TodayPending("Menentukan zon solat…")
                        !locationReady -> TodayPending("Lokasi belum tersedia.")
                        value==null -> TodayPending("Waktu solat JAKIM tidak tersedia buat masa ini.")
                        else -> {
                            AksaraText("Zon "+value.zone+"  •  Hijrah "+value.hijri,
                                size=10.5f,color=todayMuted)
                            value.times.forEach { (name,time) ->
                                Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween) {
                                    AksaraText(name,size=11.5f)
                                    AksaraText(time,size=11.5f,weight=650,color=todayGold)
                                }
                            }
                            AksaraText(countdown?.let { "Seterusnya: "+it.first+" • "+it.second+" lagi" }
                                ?: "Waktu seterusnya tidak tersedia.",size=12f,weight=700,color=todayGold)
                        }
                    }
                }
                TodayCard("Pasaran Kripto • USD",onClick={ detailWindow="crypto" }) {
                    val coins=crypto?.value
                    if(coins.isNullOrEmpty())TodayPending("Harga kripto tidak tersedia. Cuba Refresh.")
                    else {
                        coins.forEach { coin ->
                            Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically,
                                horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                                AksaraText(coin.symbol,Modifier.width(44.dp),size=12f,weight=650)
                                AksaraText(money(coin.usd),Modifier.weight(1f),size=13f,weight=650)
                                AksaraText(String.format(Locale.US,"%+.2f%%",coin.change24h),
                                    size=11f,color=if(coin.change24h>=0)Color(0xFF87D6AD) else Color(0xFFF1A5A1))
                            }
                        }
                        AksaraText("Perubahan harga 24 jam • CoinPaprika",size=9.5f,color=todayMuted)
                    }
                }
                TodayCard("Aktiviti Pembangunan • GitHub",onClick={ detailWindow="development" }) {
                    val commit=github?.value
                    if(commit==null) TodayPending("Aktiviti GitHub tidak tersedia. Cuba Refresh.")
                    else {
                        val actor=commit.pushedBy?.let {
                            if(it.equals("ShaifulRidhwan",ignoreCase=true)) "Shaiful Ridhwan" else it
                        }
                        val author=commit.author?.let {
                            if(it.equals("ShaifulRidhwan",ignoreCase=true)) "Shaiful Ridhwan" else it
                        }
                        AksaraText("Android • "+commit.sha.take(7)+" • "+
                            (localIsoTime(commit.date) ?: "masa tidak tersedia"),
                            size=10.5f,color=todayMuted)
                        AksaraText(commit.message.take(105),size=12f,weight=650,line=18f)
                        AksaraText(when {
                            actor!=null -> "Push oleh $actor"+(commit.pushCount?.let { " • $it commit" } ?: "")
                            author!=null -> "Commit oleh $author"
                            else -> "Pelaku push belum disahkan"
                        },size=10.5f,color=todayMuted)
                        AksaraText("CI: "+commit.ci,size=11f,
                            color=if(commit.ci=="Lulus")Color(0xFF9EE1B5) else todayMuted)
                    }
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
                AksaraGlassModal(onClose={ showLocationDialog=false },preferredHeight=335.dp) {
                    Column(Modifier.fillMaxSize().padding(18.dp),
                        verticalArrangement=Arrangement.spacedBy(11.dp)) {
                        Row(verticalAlignment=Alignment.CenterVertically,
                            horizontalArrangement=Arrangement.spacedBy(12.dp)) {
                            AksaraGlassSurface(Modifier.size(44.dp),radius=999.dp) {
                                AksaraIcon("location",Modifier.align(Alignment.Center).size(23.dp),todayGold)
                            }
                            Column(Modifier.weight(1f)) {
                                AksaraText("Benarkan lokasi",size=17f,weight=700)
                                AksaraText("AKSARA TODAY • KEBENARAN PERANTI",
                                    size=9.5f,color=todayGold)
                            }
                        }
                        AksaraText("Aksara perlukan lokasi anggaran untuk menunjukkan cuaca setempat, zon waktu solat dan kiraan waktu solat seterusnya.",
                            size=12.5f,line=19f)
                        AksaraText("Android hanya meminta izin selepas kau tekan Benarkan lokasi. Jika ditolak, jam, kripto dan GitHub masih berfungsi. Data ramalan mungkin disimpan sementara dalam cache peranti.",
                            size=10.5f,line=17f,color=todayMuted)
                        Spacer(Modifier.weight(1f))
                        Row(Modifier.fillMaxWidth(),
                            horizontalArrangement=Arrangement.spacedBy(9.dp)) {
                            AksaraButton("Bukan sekarang",{showLocationDialog=false},
                                Modifier.weight(1f),height=42.dp,size=10.5f)
                            AksaraButton("Benarkan lokasi",{
                                showLocationDialog=false
                                locationPrompt.launch(Manifest.permission.ACCESS_COARSE_LOCATION)
                            },Modifier.weight(1f),height=42.dp,size=10.5f)
                        }
                    }
                }
            }
        }
    }
}
