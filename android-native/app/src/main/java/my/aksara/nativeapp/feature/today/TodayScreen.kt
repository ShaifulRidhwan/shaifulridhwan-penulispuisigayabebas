package my.aksara.nativeapp.feature.today

import android.Manifest
import android.content.Context
import android.content.Intent
import android.location.Geocoder
import android.location.Location
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.CalendarContract
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.hazeSource
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import my.aksara.nativeapp.core.design.*
import my.aksara.nativeapp.feature.chat.ChatWallpaper
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
internal data class TodayAgendaItem(val title:String,val start:Long)
private fun hasCalendarPermission(context:Context)=
    ContextCompat.checkSelfPermission(context,Manifest.permission.READ_CALENDAR)==PackageManager.PERMISSION_GRANTED

private fun readTodayAgenda(context:Context):List<TodayAgendaItem> {
    if(!hasCalendarPermission(context)) return emptyList()
    val now=System.currentTimeMillis()
    val end=now+7L*24L*60L*60L*1000L
    val columns=arrayOf(CalendarContract.Instances.TITLE,CalendarContract.Instances.BEGIN)
    return runCatching {
        val entries=mutableListOf<TodayAgendaItem>()
        CalendarContract.Instances.query(context.contentResolver,columns,now,end)?.use { cursor ->
            val titleIndex=cursor.getColumnIndexOrThrow(CalendarContract.Instances.TITLE)
            val timeIndex=cursor.getColumnIndexOrThrow(CalendarContract.Instances.BEGIN)
            while(cursor.moveToNext() && entries.size<3) {
                val title=cursor.getString(titleIndex).orEmpty().trim()
                if(title.isNotBlank())entries+=TodayAgendaItem(title.take(110),cursor.getLong(timeIndex))
            }
        }
        entries
    }.getOrDefault(emptyList())
}

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
    return next.first to (remaining/60L).toString().padStart(2,'0')+":"+
        (remaining%60L).toString().padStart(2,'0')
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

@Composable private fun TodayCard(title:String,content:@Composable ()->Unit) {
    AksaraGlassSurface(Modifier.fillMaxWidth(),radius=20.dp,blur=12.dp) {
        Column(Modifier.fillMaxWidth().padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
            AksaraText(title,size=14f,weight=700,color=todayGold)
            content()
        }
    }
}

@Composable private fun TodayPending(message:String) {
    AksaraText(message,size=11.5f,line=17f,color=todayMuted)
}
@Composable private fun TodayFreshness(feed:TodayFeed<*>?) {
    if(feed!=null) AksaraText(updatedLabel(feed.updatedAt,feed.fromCache),
        size=10.5f,color=todayMuted)
}

@Composable internal fun TodayScreen(active:Boolean,onBack:()->Unit) {
    BackHandler(enabled=active) { onBack() }
    val context=LocalContext.current
    val repo=remember(context) { TodayRepository(context) }
    var permissionLocation by remember { mutableStateOf(hasTodayLocationPermission(context)) }
    var permissionCalendar by remember { mutableStateOf(hasCalendarPermission(context)) }
    var epoch by remember { mutableIntStateOf(0) }
    var locating by remember { mutableStateOf(false) }
    var locationReady by remember { mutableStateOf(false) }
    var city by remember { mutableStateOf<String?>(null) }
    var weather by remember { mutableStateOf<TodayFeed<TodayWeather>?>(null) }
    var prayer by remember { mutableStateOf<TodayFeed<TodayPrayer>?>(null) }
    var crypto by remember { mutableStateOf<TodayFeed<List<TodayCoin>>?>(null) }
    var github by remember { mutableStateOf<TodayFeed<TodayCommit>?>(null) }
    var agenda by remember { mutableStateOf<List<TodayAgendaItem>>(emptyList()) }
    var clock by remember { mutableStateOf(ZonedDateTime.now()) }
    val locationPrompt=rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()) { granted -> permissionLocation=granted; epoch++ }
    val calendarPrompt=rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()) { granted -> permissionCalendar=granted; epoch++ }

    LaunchedEffect(active) {
        while(active) {
            clock=ZonedDateTime.now()
            delay(30_000L)
        }
    }
    LaunchedEffect(active,epoch,permissionCalendar) {
        if(active && permissionCalendar) agenda=withContext(Dispatchers.IO) { readTodayAgenda(context) }
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
            if(found!=null) {
                city=null
                launch { city=withContext(Dispatchers.IO) { resolveCity(context,found) } }
                weather=null
                prayer=null
                launch { weather=repo.weather(found,force=epoch>0) }
                launch { prayer=repo.prayer(found,force=epoch>0) }
            } else city=null
        }
    }
    val dateLabel=clock.format(DateTimeFormatter.ofPattern("EEEE, d MMMM yyyy",malay))
    val prayerNow=LocalTime.now(malaysiaZone)
    val countdown=nextPrayer(prayer?.value,prayerNow)
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
                    AksaraButton("Segar semula",{ epoch++ },height=40.dp,size=10f,radius=13.dp)
                }
                AksaraGlassSurface(Modifier.fillMaxWidth(),radius=20.dp,blur=12.dp) {
                    Column(Modifier.fillMaxWidth().padding(vertical=14.dp,horizontal=16.dp),
                        horizontalAlignment=Alignment.CenterHorizontally) {
                        AksaraText(clock.format(DateTimeFormatter.ofPattern("HH:mm")),
                            size=37f,weight=650)
                        AksaraText(dateLabel,size=11f,color=todayMuted)
                        Spacer(Modifier.height(12.dp))
                        Box(Modifier.fillMaxWidth().height(1.dp)
                            .background(Color.White.copy(alpha=0.17f)))
                        Spacer(Modifier.height(9.dp))
                        Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically,
                            horizontalArrangement=Arrangement.SpaceBetween) {
                            AksaraText("Agenda",size=12f,weight=700,color=todayGold)
                            if(permissionCalendar && agenda.isEmpty())
                                AksaraText("Tiada acara",size=11f,color=todayMuted)
                        }
                        if(!permissionCalendar) {
                            TodayPending("Benarkan akses untuk melihat agenda peranti.")
                            Spacer(Modifier.height(5.dp))
                            AksaraButton("Aktifkan agenda",
                                { calendarPrompt.launch(Manifest.permission.READ_CALENDAR) },
                                height=32.dp,size=10.5f)
                        } else if(agenda.isNotEmpty()) {
                            Spacer(Modifier.height(4.dp))
                            agenda.forEach { item ->
                                Row(Modifier.fillMaxWidth(),
                                    horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                                    AksaraText(Instant.ofEpochMilli(item.start)
                                        .atZone(ZoneId.systemDefault())
                                        .format(DateTimeFormatter.ofPattern("dd MMM HH:mm",malay)),
                                        size=10.5f,color=todayGold)
                                    AksaraText(item.title,Modifier.weight(1f),size=11f)
                                }
                            }
                        }
                    }
                }
                TodayCard("Cuaca & Lokasi") {
                    val value=weather?.value
                    when {
                        !permissionLocation -> {
                            TodayPending("Benarkan lokasi untuk suhu, ramalan hujan dan zon solat yang tepat.")
                            AksaraButton("Aktifkan lokasi",
                                { locationPrompt.launch(Manifest.permission.ACCESS_COARSE_LOCATION) },
                                height=38.dp,size=11f)
                        }
                        locating -> TodayPending("Mengesan lokasi peranti…")
                        !locationReady -> TodayPending("Lokasi belum tersedia. Semak GPS/rangkaian dan segar semula.")
                        value==null -> TodayPending("Cuaca belum tersedia. Semak sambungan internet.")
                        else -> {
                            AksaraText(String.format(Locale.US,"%.1f°C",value.celsius)+"  •  "+
                                todayCondition(value.code),size=20f,weight=650)
                            AksaraText((city ?: "Nama lokasi tidak tersedia")+" • Angin "+
                                String.format(Locale.US,"%.0f km/j",value.windKmh),size=11f,color=todayMuted)
                            AksaraText(value.rainChance?.let { "Potensi hujan hari ini: "+it+"%" }
                                ?: "Ramalan hujan tidak tersedia",size=11f,color=todayMuted)
                            AksaraText("Ramalan cuaca, bukan amaran rasmi METMalaysia.",
                                size=9.5f,color=todayMuted)
                            TodayFreshness(weather)
                        }
                    }
                }
                TodayCard("Waktu Solat & Hijrah") {
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
                            TodayFreshness(prayer)
                        }
                    }
                }
                TodayCard("Pasaran Kripto • USD") {
                    val coins=crypto?.value
                    if(coins.isNullOrEmpty())TodayPending("Harga kripto tidak tersedia. Cuba segar semula.")
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
                        TodayFreshness(crypto)
                    }
                }
                TodayCard("Aktiviti Pembangunan • GitHub") {
                    val commit=github?.value
                    if(commit==null)TodayPending("Aktiviti GitHub tidak tersedia. Cuba segar semula.")
                    else {
                        AksaraText("Android • rebuild/aksara-android-native-v1",
                            size=10.5f,color=todayMuted)
                        val actor=commit.pushedBy?.let {
                            if(it.equals("ShaifulRidhwan",ignoreCase=true))"Shaiful Ridhwan" else it
                        }
                        if(actor!=null) {
                            val count=commit.pushCount?.let { " • "+it+" commit" }.orEmpty()
                            AksaraText(actor+" • Push"+count,size=12f,weight=700)
                            commit.pushedAt?.let {
                                AksaraText("Push: "+(localIsoTime(it) ?: "masa tidak tersedia"),
                                    size=10.5f,color=todayMuted)
                            }
                        } else {
                            TodayPending("Push terkini belum dapat disahkan daripada aktiviti GitHub.")
                        }
                        val author=commit.author?.let {
                            if(it.equals("ShaifulRidhwan",ignoreCase=true))"Shaiful Ridhwan" else it
                        } ?: "Tidak tersedia"
                        AksaraText("Commit oleh "+author,size=10.5f,color=todayMuted)
                        AksaraText(commit.message,size=12f,weight=650,line=19f)
                        AksaraText(commit.sha.take(7)+" • "+(localIsoTime(commit.date) ?: "tarikh tidak tersedia"),
                            size=10.5f,color=todayGold)
                        AksaraText("CI: "+commit.ci,size=11f,
                            color=if(commit.ci=="Lulus")Color(0xFF9EE1B5) else todayMuted)
                        AksaraText("APK: pengesahan release berasingan diperlukan",
                            size=10f,color=todayMuted)
                        val url=commit.url.takeIf { it.startsWith(
                            "https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/commit/") }
                        if(url!=null) AksaraButton("Buka commit di GitHub",{
                            context.startActivity(Intent(Intent.ACTION_VIEW,Uri.parse(url)))
                        },height=38.dp,size=11f)
                        AksaraText("Sync GitHub • "+updatedLabel(github?.updatedAt,
                            github?.fromCache==true),size=10.5f,color=todayMuted)
                    }
                }
            }
        }
    }
}
