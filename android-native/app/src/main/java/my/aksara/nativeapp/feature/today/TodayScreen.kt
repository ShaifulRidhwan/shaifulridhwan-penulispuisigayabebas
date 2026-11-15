package my.aksara.nativeapp.feature.today

import android.Manifest
import android.content.Context
import android.location.Geocoder
import android.location.Location
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.background
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.draw.clip
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
import my.aksara.nativeapp.BuildConfig
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

private fun todayCoinGlyph(symbol:String):String=when(symbol.uppercase(Locale.US)) {
    "BTC" -> "₿"
    "ETH" -> "Ξ"
    "SOL" -> "◎"
    else -> "●"
}

private fun money(value:Double):String=NumberFormat.getCurrencyInstance(Locale.US).apply {
    maximumFractionDigits=if(value<1.0)4 else 2
}.format(value)

internal fun nextPrayer(prayer:TodayPrayer?,now:LocalTime):Pair<String,String>? {
    if(prayer==null)return null
    val next=prayer.times.firstOrNull { (_,time) ->
        runCatching { LocalTime.parse(time).isAfter(now) }.getOrDefault(false)
    } ?: prayer.nextDaySubuh?.let { "Subuh" to it } ?: return null
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

/** Progress between the previous and next prayer, including the midnight Isyak/Subuh gap. */
internal fun prayerTimelineProgress(prayer:TodayPrayer?, now:LocalTime):Float? {
    val minutes=prayer?.times?.mapNotNull { (_,raw) ->
        runCatching { LocalTime.parse(raw).toSecondOfDay()/60 }.getOrNull()
    }?.sorted() ?: return null
    if(minutes.size<2 || minutes.distinct().size!=minutes.size)return null
    val current=now.toSecondOfDay()/60
    // Before Subuh we cannot know yesterday's Isyak from today's single-day list.
    val previous=minutes.lastOrNull { it<=current } ?: return null
    val tomorrow=prayer.nextDaySubuh?.let { runCatching { LocalTime.parse(it).toSecondOfDay()/60+1440 }.getOrNull() }
    val next=minutes.firstOrNull { it>current } ?: tomorrow ?: return null
    return if(next>previous) ((current-previous).toFloat()/(next-previous)).coerceIn(0f,1f) else null
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

private fun updatedLabel(at:Long?,cached:Boolean,freshness:TodayFreshness=if(cached)TodayFreshness.CACHED else TodayFreshness.LIVE):String {
    val time=at?.let {
        Instant.ofEpochMilli(it).atZone(malaysiaZone)
            .format(DateTimeFormatter.ofPattern("dd MMM, HH:mm",malay))
    } ?: "masa tidak tersedia"
    return when(freshness) {
        TodayFreshness.LIVE -> "Dikemas kini "+time
        TodayFreshness.CACHED -> "Cache segar • "+time
        TodayFreshness.STALE -> "Data lama • "+time
        TodayFreshness.UNAVAILABLE -> "Data tidak tersedia"
    }
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
    val zonePrefs=remember(context) {
        context.getSharedPreferences("aksara_today_prayer_zone",Context.MODE_PRIVATE)
    }
    var manualPrayerZone by rememberSaveable {
        mutableStateOf(zonePrefs.getString("manual_zone",null))
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
    var refreshTick by remember { mutableIntStateOf(0) }
    var lastLocationCheck by remember { mutableLongStateOf(0L) }
    LaunchedEffect(active) {
        while(active) {
            delay(60_000L)
            refreshTick++
        }
    }
    // Navigation should re-use each feed's TTL, not turn one manual refresh into
    // a permanent forced-refresh flag on every return to Dashboard.
    var consumedRefreshEpoch by remember { mutableIntStateOf(0) }
    var locating by remember { mutableStateOf(false) }
    var locationReady by remember { mutableStateOf(false) }
    var city by remember { mutableStateOf<String?>(null) }
    var latestLocation by remember { mutableStateOf<Location?>(null) }
    var weather by remember { mutableStateOf<TodayFeed<TodayWeather>?>(null) }
    var prayer by remember { mutableStateOf<TodayFeed<TodayPrayer>?>(null) }
    var crypto by remember { mutableStateOf<TodayFeed<List<TodayCoin>>?>(null) }
    var github by remember { mutableStateOf<TodayFeed<TodayCommit>?>(null) }
    var clock by remember { mutableStateOf(ZonedDateTime.now(malaysiaZone)) }
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
            if(shouldShowTodayLocationIntro(active,permissionLocation,introShown)) explainLocation()
            else if(permissionLocation && !introShown) {
                introShown=true
                permissionPrefs.edit().putBoolean("today_all_permissions_intro_shown",true).apply()
            }
        }
    }

    LaunchedEffect(active,detailWindow) {
        while(active) {
            clock=ZonedDateTime.now(malaysiaZone)
            delay(if(detailWindow=="clock")1_000L else 30_000L)
        }
    }
    LaunchedEffect(active,epoch,refreshTick,permissionLocation,manualPrayerZone) {
        if(!active)return@LaunchedEffect
        val forceReload=epoch>consumedRefreshEpoch
        consumedRefreshEpoch=epoch
        launch { crypto=repo.crypto(force=forceReload) }
        launch { github=repo.github(force=forceReload) }
        if(permissionLocation) {
            val now=System.currentTimeMillis()
            val shouldLocate=forceReload || latestLocation==null ||
                now-lastLocationCheck !in 0L..(30L*60_000L)
            if(shouldLocate)locating=true
            val previous=latestLocation
            val found=if(shouldLocate)withTimeoutOrNull(12_000L) { todayLocation(context) }
                else latestLocation
            if(shouldLocate)lastLocationCheck=now
            locating=false
            locationReady=found!=null
            if(found!=null) {
                val moved=previous==null || previous.distanceTo(found)>1500f
                latestLocation=found
                if(moved) {
                    city=null
                    weather=null
                    if(manualPrayerZone==null)prayer=null
                    launch { city=withContext(Dispatchers.IO) { resolveCity(context,found) } }
                }
                launch { weather=repo.weather(found,force=forceReload) }
                if(manualPrayerZone==null)
                    launch { prayer=repo.prayer(found,force=forceReload) }
            } else if(previous==null) {
                city=null;weather=null
                if(manualPrayerZone==null)prayer=null
            }
        } else {
            context.getSharedPreferences("aksara_today_location",Context.MODE_PRIVATE)
                .edit().clear().apply()
            repo.clearLocationData()
            detailRepo.clearLocationData()
            latestLocation=null
            locationReady=false
            city=null
            weather=null
            if(manualPrayerZone==null)prayer=null
        }
        manualPrayerZone?.let { zone ->
            launch { prayer=repo.prayerByZone(zone,force=forceReload) }
        }
    }
    // Clock ticks should not recreate expensive date/time format patterns.
    val dateFormatter=remember { DateTimeFormatter.ofPattern("EEEE, d MMMM yyyy",malay) }
    val timeFormatter=remember { DateTimeFormatter.ofPattern("HH:mm") }
    val dateLabel=remember(clock.toLocalDate()) { clock.format(dateFormatter) }
    val prayerNow=LocalTime.now(malaysiaZone)
    val countdown=nextPrayer(prayer?.value,prayerNow)
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
            BoxWithConstraints(Modifier.fillMaxSize()) {
            val compact=maxHeight<560.dp
            Column(Modifier.fillMaxSize().safeDrawingPadding().then(refreshModifier)
                .padding(horizontal=15.dp,vertical=if(compact)4.dp else 8.dp),
                verticalArrangement=Arrangement.spacedBy(if(compact)4.dp else 8.dp)) {


                // Five classic Liquid Glass cards, no top toolbar or dashboard scrolling.
                // Android Back returns to chat, swipe down refreshes as before.
                AksaraGlassSurface(Modifier.fillMaxWidth().weight(if(compact).20f else .13f).aksaraBouncyClick {
                    detailWindow="clock"
                },radius=19.dp,blur=12.dp) {
                    Column(Modifier.fillMaxSize().padding(horizontal=10.dp,vertical=4.dp),
                        horizontalAlignment=Alignment.CenterHorizontally,
                        verticalArrangement=Arrangement.Center) {
                        AksaraText(clock.format(timeFormatter),
                            size=if(compact)23f else 33f,
                            line=if(compact)26f else 37f,weight=650)
                        AksaraText(dateLabel,size=if(compact)9f else 10.5f,
                            line=if(compact)11f else 14f,color=todayMuted)
                    }
                }
                AksaraGlassSurface(Modifier.fillMaxWidth().weight(.21f)
                    .aksaraBouncyClick { detailWindow="weather" },radius=19.dp,blur=12.dp) {
                    val value=weather?.value
                    Row(Modifier.fillMaxSize(),verticalAlignment=Alignment.CenterVertically) {
                        Column(Modifier.weight(.60f).fillMaxHeight()
                            .padding(start=if(compact)8.dp else 12.dp,top=4.dp,bottom=4.dp),
                            verticalArrangement=Arrangement.SpaceEvenly) {
                            AksaraText("Cuaca & Lokasi",size=if(compact)10f else 12.5f,
                                line=if(compact)12f else 16f,weight=700,color=todayGold)
                            if(value!=null) {
                                AksaraText(String.format(Locale.US,"%.1f°C",value.celsius)+
                                    (if(compact)"" else " · "+todayCondition(value.code)),
                                    size=if(compact)17f else 20f,
                                    line=if(compact)20f else 25f,weight=650)
                                if(!compact) {
                                    AksaraText((city ?: "Lokasi semasa")+
                                        " · Angin "+String.format(Locale.US,"%.0f km/j",value.windKmh),
                                        size=9.8f,line=13f,color=todayMuted)
                                    val trend=value.temperatureTrend3Hours?.let {
                                        String.format(Locale.US," · Suhu %+.1f°C",it)
                                    }.orEmpty()
                                    AksaraText(value.rainNext3Hours?.let {
                                        "3 jam · Potensi hujan $it%"+trend
                                    } ?: "Hujan harian: "+(value.rainChance?.let { "$it%" } ?: "tiada data"),
                                        size=9.2f,line=12f,color=todayMuted)
                                    AksaraText("Ramalan, bukan amaran rasmi METMalaysia.",
                                        size=8.3f,line=10f,color=todayMuted)
                                }
                            } else TodayPending(if(!permissionLocation)"Benarkan lokasi."
                                else if(locating)"Mendapatkan lokasi…" else "Cuaca tidak tersedia.")
                        }
                        TodayMiniMap(latestLocation,city,active,epoch,
                            Modifier.weight(.40f).fillMaxHeight()
                                .padding(horizontal=4.dp,vertical=4.dp)) {
                            detailWindow="map"
                        }
                    }
                }
                AksaraGlassSurface(Modifier.fillMaxWidth().weight(if(compact).25f else .29f)
                    .aksaraBouncyClick { detailWindow="prayer" },radius=19.dp,blur=12.dp) {
                    val value=prayer?.value
                    Column(Modifier.fillMaxSize().padding(horizontal=14.dp,vertical=9.dp),
                        verticalArrangement=Arrangement.SpaceEvenly) {
                        Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically,
                            horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                            AksaraText("Waktu Solat & Hijrah",Modifier.weight(1f),
                                size=12.5f,line=16f,weight=700,color=todayGold)
                            AksaraText(value?.zone ?: "—",size=9f,line=12f,color=todayMuted)
                        }
                        if(value!=null) {
                            if(!compact)AksaraText("Zon "+value.zone+
                                (if(value.hijri.isNotBlank())" · Hijrah "+value.hijri else ""),
                                size=9.4f,line=12f,color=todayMuted)
                            (if(compact)emptyList() else value.times).forEach { (name,time) ->
                                val upcoming=name==countdown?.first
                                Row(Modifier.fillMaxWidth(),
                                    verticalAlignment=Alignment.CenterVertically,
                                    horizontalArrangement=Arrangement.SpaceBetween) {
                                    AksaraText(name,size=10.4f,line=14f,
                                        weight=if(upcoming)650 else 450,
                                        color=if(upcoming)todayGold else AksaraColors.text)
                                    AksaraText(time,size=10.7f,line=14f,weight=600,
                                        color=if(upcoming)todayGold else todayMuted)
                                }
                            }
                            Row(verticalAlignment=Alignment.CenterVertically,
                                horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                                AksaraIcon("clock",Modifier.size(13.dp),todayGold)
                                AksaraText(countdown?.let {
                                    "Seterusnya: "+it.first+" · "+it.second+" lagi"
                                } ?: "Waktu seterusnya tidak tersedia",
                                    size=10.2f,line=14f,weight=600,color=todayGold)
                            }
                            if(!compact)prayerTimelineProgress(value,prayerNow)?.let { fraction ->
                                Box(Modifier.fillMaxWidth().height(3.dp)
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(Color(0x443D5470))) {
                                    Box(Modifier.fillMaxWidth(fraction).fillMaxHeight()
                                        .background(todayGold))
                                }
                            }
                        } else TodayPending(if(!permissionLocation && manualPrayerZone==null)
                            "Aktifkan lokasi atau pilih zon dalam butiran."
                            else "Waktu solat tidak tersedia.")
                    }
                }
                AksaraGlassSurface(Modifier.fillMaxWidth().weight(if(compact).17f else .18f)
                    .aksaraBouncyClick { detailWindow="crypto" },radius=19.dp,blur=12.dp) {
                    Column(Modifier.fillMaxSize().padding(horizontal=if(compact)9.dp else 14.dp,
                        vertical=if(compact)3.dp else 8.dp),
                        verticalArrangement=Arrangement.SpaceEvenly) {
                        AksaraText("Pasaran Kripto · USD",size=12.5f,line=16f,
                            weight=700,color=todayGold)
                        val coins=crypto?.value.orEmpty()
                        if(coins.isEmpty())TodayPending("Harga belum tersedia.")
                        else coins.take(if(compact)1 else 3).forEach { coin ->
                            Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) {
                                Row(Modifier.weight(.22f),
                                    verticalAlignment=Alignment.CenterVertically,
                                    horizontalArrangement=Arrangement.spacedBy(5.dp)) {
                                    AksaraText(todayCoinGlyph(coin.symbol),size=13f,
                                        line=16f,weight=700,color=todayGold)
                                    AksaraText(coin.symbol,size=10.5f,line=14f,weight=600)
                                }
                                AksaraText(money(coin.usd),Modifier.weight(.48f),
                                    size=11f,line=15f,weight=600)
                                AksaraText(String.format(Locale.US,"%+.2f%%",coin.change24h),
                                    Modifier.weight(.30f),size=10.4f,line=14f,
                                    color=if(coin.change24h>=0)Color(0xFF87D6AD)
                                        else Color(0xFFF1A5A1),
                                    weight=600)
                            }
                        }
                        if(!compact)AksaraText("CoinPaprika · "+updatedLabel(crypto?.updatedAt,
                            crypto?.fromCache==true,crypto?.freshness ?: TodayFreshness.UNAVAILABLE),
                            size=8.6f,line=11f,color=todayMuted)
                    }
                }
                AksaraGlassSurface(Modifier.fillMaxWidth().weight(if(compact).17f else .19f)
                    .aksaraBouncyClick { detailWindow="development" },radius=19.dp,blur=12.dp) {
                    Column(Modifier.fillMaxSize().padding(horizontal=if(compact)9.dp else 14.dp,
                        vertical=if(compact)3.dp else 8.dp),
                        verticalArrangement=Arrangement.SpaceEvenly) {
                        Row(Modifier.fillMaxWidth(),
                            verticalAlignment=Alignment.CenterVertically,
                            horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                            AksaraIcon("activity",Modifier.size(14.dp),todayGold)
                            AksaraText("Aktiviti Pembangunan · GitHub",
                                size=12.5f,line=16f,weight=700,color=todayGold)
                        }
                        if(github?.value!=null) {
                            val commit=github!!.value!!
                            if(!compact)AksaraText("Android · "+commit.sha.take(7)+" · "+
                                (localIsoTime(commit.date) ?: "masa tiada"),
                                size=9.7f,line=13f,color=todayMuted)
                            AksaraText(commit.message.take(90),
                                size=10.8f,line=14f,weight=600)
                            if(!compact)AksaraText(commit.pushedBy?.let { "Push oleh "+it.take(34) }
                                ?: commit.author?.let { "Commit oleh "+it.take(34) }
                                ?: "Penyumbang tidak tersedia",
                                size=9.3f,line=12f,color=todayMuted)
                            val ciColor=when(commit.ci) {
                                "Lulus" -> Color(0xFF87D6AD)
                                "Gagal" -> Color(0xFFF1A5A1)
                                "Sedang berjalan" -> todayGold
                                else -> todayMuted
                            }
                            val buildId=BuildConfig.SOURCE_COMMIT_SHA
                            val apkIdentity=if(buildId.isNotBlank()) "APK "+buildId.take(7)
                                else "APK "+BuildConfig.VERSION_NAME.take(17)
                            if(!compact)AksaraText(apkIdentity+" · CI Android: "+commit.ci,
                                size=9.5f,line=13f,color=ciColor)
                        } else TodayPending("Aktiviti GitHub belum tersedia.")
                    }
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
                    location=latestLocation,city=city,detailRepo=detailRepo,
                    onNavigate={ detailWindow=it },
                    onPrayerZoneSelected={ zone ->
                        val selected=zone.takeIf { it.isNotBlank() }
                        manualPrayerZone=selected
                        zonePrefs.edit().apply {
                            if(selected==null)remove("manual_zone")
                            else putString("manual_zone",selected)
                        }.apply()
                    }
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
                                AksaraText("AKSARA TODAY • KEBENARAN LOKASI",
                                    size=9.5f,color=todayGold)
                            }
                        }
                        AksaraText("Lokasi digunakan untuk cuaca, zon solat, peta dan panduan GPS. Kebenaran lain hanya akan diminta apabila fungsi tersebut dibuka.",
                            size=12.5f,line=19f)
                        AksaraText("Izin boleh ditolak. Jam, kripto dan GitHub masih berfungsi. Koordinat hanya dihantar kepada penyedia cuaca, solat dan peta apabila ciri lokasi digunakan.",
                            size=10.5f,line=17f,color=todayMuted)
                        Spacer(Modifier.weight(1f))
                        Row(Modifier.fillMaxWidth(),
                            horizontalArrangement=Arrangement.spacedBy(9.dp)) {
                            AksaraButton("Bukan sekarang",{showLocationDialog=false},
                                Modifier.weight(1f),height=42.dp,size=10.5f)
                            AksaraButton("Benarkan lokasi",{
                                showLocationDialog=false
                                todayPermissionPrompt.launch(arrayOf(
                                    Manifest.permission.ACCESS_COARSE_LOCATION,
                                    Manifest.permission.ACCESS_FINE_LOCATION
                                ))
                            },Modifier.weight(1f),height=42.dp,size=10.5f)
                        }
                    }
                }
            }
        }
    }
}
