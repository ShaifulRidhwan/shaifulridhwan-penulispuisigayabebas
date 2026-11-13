package my.aksara.nativeapp.feature.today

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.provider.CalendarContract
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import my.aksara.nativeapp.core.design.*
import my.aksara.nativeapp.BuildConfig
import my.aksara.nativeapp.feature.chat.AksaraGlassModal
import my.aksara.nativeapp.feature.chat.AksaraModalStyle
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.YearMonth
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.random.Random
import android.location.Location

private val gold=Color(0xFFE5C388)
private val muted=Color(0xFFD2DCEB)
private val ms=Locale("ms","MY")
private val kl=ZoneId.of("Asia/Kuala_Lumpur")

@Composable private fun WindowLine(title:String,value:String) {
    Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,
        verticalAlignment=Alignment.Top) {
        AksaraText(title,Modifier.weight(1f),size=11f,color=muted)
        AksaraText(value,Modifier.weight(1f),size=11.5f,weight=600)
    }
}
@Composable private fun DetailNote(message:String) {
    AksaraText(message,size=10.5f,line=16f,color=muted)
}
@Composable private fun GlassSection(title:String,content:@Composable ColumnScope.()->Unit) {
    AksaraGlassSurface(Modifier.fillMaxWidth(),radius=16.dp,blur=8.dp,
        border=AksaraModalStyle.border) {
        Column(Modifier.fillMaxWidth().padding(12.dp),
            verticalArrangement=Arrangement.spacedBy(8.dp)) {
            AksaraText(title,size=12.5f,weight=700,color=gold)
            content()
        }
    }
}
private fun readableDate(iso:String):String=runCatching {
    Instant.parse(iso).atZone(kl)
        .format(DateTimeFormatter.ofPattern("dd MMM yyyy • HH:mm",ms))
}.getOrElse { iso.take(19) }
private fun formatNumber(num:Double):String=String.format(Locale.US,"%.1f",num)
private fun shortWeatherTime(s:String)=s.takeLast(5)
private data class AgendaEntry(val name:String,val begin:Long)

private suspend fun agendaForMonth(context:Context,month:YearMonth):List<AgendaEntry> =
    withContext(Dispatchers.IO) {
        if(ContextCompat.checkSelfPermission(context,Manifest.permission.READ_CALENDAR)!=
            PackageManager.PERMISSION_GRANTED)return@withContext emptyList()
        val from=month.atDay(1).atStartOfDay(kl).toInstant().toEpochMilli()
        val until=month.plusMonths(1).atDay(1).atStartOfDay(kl).toInstant().toEpochMilli()
        runCatching {
            val list=mutableListOf<AgendaEntry>()
            CalendarContract.Instances.query(context.contentResolver,
                arrayOf(CalendarContract.Instances.TITLE,CalendarContract.Instances.BEGIN),
                from,until)?.use { cursor ->
                val title=cursor.getColumnIndexOrThrow(CalendarContract.Instances.TITLE)
                val begin=cursor.getColumnIndexOrThrow(CalendarContract.Instances.BEGIN)
                while(cursor.moveToNext() && list.size<100) {
                    val name=cursor.getString(title).orEmpty().trim()
                    if(name.isNotBlank())list+=AgendaEntry(name.take(90),cursor.getLong(begin))
                }
            }
            list
        }.getOrDefault(emptyList())
    }

/** Show only one detail at a time; network requests are launched in the selected window. */
@Composable internal fun TodayDetailWindow(
    kind:String,onClose:()->Unit,clock:java.time.ZonedDateTime,
    weather:TodayFeed<TodayWeather>?,prayer:TodayFeed<TodayPrayer>?,
    coins:TodayFeed<List<TodayCoin>>?,github:TodayFeed<TodayCommit>?,
    location:Location?,city:String?,detailRepo:TodayDetailRepository,
    onNavigate:(String)->Unit={}
) {
    var forecast by remember(kind,location?.latitude,location?.longitude) {
        mutableStateOf<TodayFeed<TodayForecast>?>(null)
    }
    var monthly by remember(kind,prayer?.value?.zone) {
        mutableStateOf<TodayFeed<List<TodayPrayerDate>>?>(null)
    }
    var dev by remember(kind) { mutableStateOf<TodayDevelopment?>(null) }
    val marketContext=LocalContext.current
    val marketRepo=remember(marketContext) { TodayMarketQuotes(marketContext) }
    var market by remember(kind) { mutableStateOf<TodayMarketResult?>(null) }
    var btcTrend by remember(kind) { mutableStateOf<TodayFeed<List<Double>>?>(null) }
    LaunchedEffect(kind,location?.latitude,location?.longitude) {
        if(kind=="weather" && location!=null)
            forecast=detailRepo.forecast(location.latitude,location.longitude)
    }
    LaunchedEffect(kind,prayer?.value?.zone) {
        val zone=prayer?.value?.zone
        if(kind=="prayer" && !zone.isNullOrBlank())monthly=detailRepo.prayerMonth(zone)
    }
    LaunchedEffect(kind) {
        if(kind=="development")dev=detailRepo.development()
        if(kind=="crypto") {
            launch { market=marketRepo.quotes() }
            launch { btcTrend=detailRepo.btcHistory() }
        }
    }
    val title=when(kind) {
        "clock"->"Masa & Kalendar"
        "weather"->"Cuaca & Ramalan"
        "map"->"AKSARA MAP"
        "prayer"->"Waktu Solat & Tazkirah"
        "crypto"->"Pasaran Kripto & Syariah"
        "development"->"Aktiviti Pembangunan"
        else->"AKSARA TODAY"
    }
    AksaraGlassModal(onClose=onClose,preferredHeight=if(kind=="map")840.dp else 720.dp) {
        Column(Modifier.fillMaxSize().padding(16.dp),
            verticalArrangement=Arrangement.spacedBy(12.dp)) {
            Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    AksaraText(title,size=16f,weight=700,color=gold)
                    AksaraText("AKSARA TODAY • Butiran",size=9.5f,color=muted)
                }
                AksaraButton("×",onClose,Modifier.width(40.dp),height=40.dp,size=19f)
            }
            if(kind=="map") {
                TodayFullMap(location,city,Modifier.weight(1f))
            } else {
                Column(Modifier.fillMaxWidth().weight(1f).verticalScroll(rememberScrollState()),
                    verticalArrangement=Arrangement.spacedBy(10.dp)) {
                    when(kind) {
                        "clock" -> ClockCalendarDetail(clock,prayer?.value?.hijri,location)
                        "weather" -> WeatherDetail(weather,forecast,city,location!=null,
                            onOpenMap={ onNavigate("map") })
                        "prayer" -> PrayerDetail(prayer,monthly)
                        "crypto" -> CryptoDetail(coins,market,btcTrend)
                        "development" -> DevelopmentDetail(github,dev)
                    }
                }
            }
        }
    }
}

@Composable private fun ClockCalendarDetail(clock:java.time.ZonedDateTime,hijri:String?,location:Location?) {
    val context=LocalContext.current
    var month by remember { mutableStateOf(YearMonth.from(clock)) }
    var selected by remember { mutableStateOf(clock.toLocalDate()) }
    var hasCalendar by remember { mutableStateOf(
        ContextCompat.checkSelfPermission(context,Manifest.permission.READ_CALENDAR)==
            PackageManager.PERMISSION_GRANTED
    ) }
    var showRationale by remember { mutableStateOf(false) }
    val holidaysRepo=remember(context) { TodayHolidayRepository(context) }
    var stateCode by remember { mutableStateOf<String?>(null) }
    var holidays by remember(month.year,stateCode) {
        mutableStateOf<TodayHolidayFeed?>(null)
    }
    LaunchedEffect(location?.latitude,location?.longitude) {
        if(stateCode==null)stateCode=holidaysRepo.stateOf(context,location)
    }
    LaunchedEffect(month.year,stateCode) {
        val state=stateCode
        if(state!=null)holidays=holidaysRepo.fetch(month.year,state)
    }
    var agenda by remember(month,hasCalendar) { mutableStateOf<List<AgendaEntry>>(emptyList()) }
    val permission=rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        hasCalendar=it
    }
    LaunchedEffect(month,hasCalendar) {
        if(hasCalendar)agenda=agendaForMonth(context,month)
    }
    GlassSection("Masa semasa") {
        AksaraText(clock.format(DateTimeFormatter.ofPattern("HH:mm:ss")),
            size=30f,weight=650)
        AksaraText(clock.format(DateTimeFormatter.ofPattern("EEEE, d MMMM yyyy",ms)),
            size=12f,color=muted)
        DetailNote("Waktu peranti • "+clock.zone.id)
        if(!hijri.isNullOrBlank())DetailNote("Hijrah (sumber jadual solat): "+hijri)
    }
    GlassSection("Kalendar bulanan") {
        Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically,
            horizontalArrangement=Arrangement.SpaceBetween) {
            AksaraButton("‹",{month=month.minusMonths(1);selected=month.atDay(1)},
                Modifier.width(42.dp),height=36.dp,size=18f)
            AksaraText(month.atDay(1).format(DateTimeFormatter.ofPattern("MMMM yyyy",ms)),
                size=13f,weight=650)
            AksaraButton("›",{month=month.plusMonths(1);selected=month.atDay(1)},
                Modifier.width(42.dp),height=36.dp,size=18f)
        }
        Row {
            listOf("Is","Se","Ra","Kh","Ju","Sa","Ah").forEach {
                AksaraText(it,Modifier.weight(1f),size=10f,color=muted)
            }
        }
        val pad=month.atDay(1).dayOfWeek.value-1
        val cells=List(pad) { 0 }+(1..month.lengthOfMonth()).toList()
        cells.chunked(7).forEach { week ->
            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(3.dp)) {
                (0 until 7).forEach { i ->
                    val day=week.getOrNull(i) ?: 0
                    val date=if(day>0)month.atDay(day) else null
                    val holiday=date?.let { d -> holidays?.entries?.any {it.date==d} }==true
                    val deviceEvent=date?.let { d -> agenda.any {
                        Instant.ofEpochMilli(it.begin).atZone(kl).toLocalDate()==d
                    } }==true
                    AksaraGlassSurface(Modifier.weight(1f).height(37.dp)
                        .clickable(enabled=date!=null) { if(date!=null)selected=date },
                        radius=10.dp,border=if(date==selected)gold else AksaraColors.border) {
                        if(day>0)AksaraText(day.toString(),Modifier.align(Alignment.Center),
                            size=11f,color=if(date==selected || holiday)gold
                                else if(deviceEvent)Color(0xFF91D8C2) else AksaraColors.text)
                    }
                }
            }
        }
        DetailNote("Dipilih: "+selected.format(DateTimeFormatter.ofPattern("d MMMM yyyy",ms)))
    }
    GlassSection("Cuti umum Malaysia • negeri") {
        DetailNote("Emas = cuti umum, hijau = agenda peranti. Tarikh cuti boleh berubah mengikut pengumuman kerajaan.")
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement=Arrangement.spacedBy(6.dp)) {
            MalaysiaHolidayStates.all.forEach { (code,name) ->
                AksaraButton(if(stateCode==code)"✓ "+name else name,{
                    stateCode=code
                },height=33.dp,size=9f)
            }
        }
        val state=stateCode
        when {
            state==null -> DetailNote("Pilih negeri untuk memaparkan cuti umum.")
            holidays==null -> DetailNote("Memuatkan cuti "+(MalaysiaHolidayStates.all[state] ?: state)+"…")
            holidays!!.entries.isEmpty() -> DetailNote("Tiada data cuti yang diterbitkan untuk tahun dan negeri ini.")
            else -> {
                val onDay=holidays!!.entries.filter { it.date==selected }
                if(onDay.isNotEmpty()) {
                    onDay.forEach { item ->
                        AksaraText(item.name+" • "+selected.format(
                            DateTimeFormatter.ofPattern("d MMMM yyyy",ms)),
                            size=11f,weight=650,color=gold)
                        if(item.tentative)DetailNote("Tarikh tertakluk pada perubahan.")
                    }
                } else DetailNote("Tiada cuti umum pada tarikh dipilih.")
                val inMonth=holidays!!.entries.filter { YearMonth.from(it.date)==month }
                inMonth.take(20).forEach { item ->
                    WindowLine(item.date.format(DateTimeFormatter.ofPattern("d MMM",ms)),
                        item.name+(if(item.tentative)" (tentatif)" else ""))
                }
            }
        }
        DetailNote("Sumber: Malaysia Holiday API, rekod disemak daripada dokumen JPM. "+
            (if(holidays?.cached==true)"Data cache/luar talian. " else "")+
            "Sahkan pengumuman rasmi sebelum membuat urusan penting.")
    }
    GlassSection("Agenda peranti") {
        if(!hasCalendar) {
            DetailNote("Aksara hanya membaca agenda jika kau benarkan. Ia tidak mengubah acara atau menyegerak ke pelayan.")
            AksaraButton("Benarkan akses kalendar",{showRationale=true},
                Modifier.fillMaxWidth(),height=36.dp,size=10.5f)
        } else {
            val items=agenda.filter { Instant.ofEpochMilli(it.begin).atZone(kl).toLocalDate()==selected }
            if(items.isEmpty())DetailNote("Tiada acara untuk tarikh ini.")
            items.forEach { item ->
                WindowLine(Instant.ofEpochMilli(item.begin).atZone(kl)
                    .format(DateTimeFormatter.ofPattern("HH:mm")),item.name)
            }
        }
    }
    if(showRationale) {
        Dialog(onDismissRequest={showRationale=false}) {
            AksaraGlassSurface(Modifier.fillMaxWidth(),radius=22.dp,
                border=AksaraModalStyle.border) {
                Column(Modifier.fillMaxWidth().padding(18.dp),
                    verticalArrangement=Arrangement.spacedBy(12.dp)) {
                    AksaraText("Kebenaran Kalendar",size=16f,weight=700,color=gold)
                    DetailNote("Aksara ingin membaca acara kalendar peranti untuk dipaparkan pada tarikh yang kau pilih. Tiada acara akan dimuat naik atau diubah.")
                    Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                        AksaraButton("Batal",{showRationale=false},Modifier.weight(1f))
                        AksaraButton("Benarkan",{
                            showRationale=false
                            permission.launch(Manifest.permission.READ_CALENDAR)
                        },Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

/** Actual Open-Meteo temperature samples, never a synthetic activity sparkline. */
@Composable private fun HourlyTemperatureChart(hours:List<TodayForecastHour>) {
    val values=hours.take(12)
    if(values.size<2)return
    val low=values.minOf { it.celsius }
    val high=values.maxOf { it.celsius }
    val span=(high-low).coerceAtLeast(1.0)
    AksaraText("Graf suhu "+values.size+" jam terdekat",size=10.5f,color=muted)
    Canvas(Modifier.fillMaxWidth().height(58.dp)) {
        val chart=Path()
        values.forEachIndexed { index,hour ->
            val x=size.width*index/(values.size-1)
            val y=(size.height-8.dp.toPx())*(1f-((hour.celsius-low)/span).toFloat())+4.dp.toPx()
            if(index==0) chart.moveTo(x,y) else chart.lineTo(x,y)
        }
        drawPath(chart,color=gold,style=Stroke(width=2.dp.toPx(),cap=StrokeCap.Round))
    }
    Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween) {
        AksaraText(values.first().time.takeLast(5),size=9f,color=muted)
        AksaraText(String.format(Locale.US,"%.1f–%.1f°C",low,high),size=9f,color=gold)
        AksaraText(values.last().time.takeLast(5),size=9f,color=muted)
    }
}

@Composable private fun WeatherDetail(
    current:TodayFeed<TodayWeather>?,forecast:TodayFeed<TodayForecast>?,
    city:String?,hasLocation:Boolean,onOpenMap:()->Unit
) {
    GlassSection("Cuaca setempat") {
        AksaraText(city ?: "Nama kawasan tidak tersedia",size=13f,weight=650)
        if(current?.value!=null) {
            AksaraText(formatNumber(current.value.celsius)+"°C",size=29f,weight=650,color=gold)
            WindowLine("Angin",formatNumber(current.value.windKmh)+" km/j")
            current.value.rainChance?.let { WindowLine("Potensi hujan harian",it.toString()+"%") }
            current.value.rainNext3Hours?.let { WindowLine("Potensi hujan 3 jam",it.toString()+"%") }
            current.value.temperatureTrend3Hours?.let {
                WindowLine("Perubahan suhu 3 jam",String.format(Locale.US,"%+.1f°C",it))
            }
        } else DetailNote(if(!hasLocation)"Lokasi belum dibenarkan." else "Bacaan semasa belum tersedia.")
        DetailNote("Sumber: Open-Meteo. Ramalan, bukan amaran rasmi METMalaysia.")
        if(hasLocation) {
            AksaraButton("Buka peta & navigasi",onOpenMap,
                Modifier.fillMaxWidth(),icon="location",height=38.dp,size=11f)
        }
    }
    val data=forecast?.value
    if(data==null) {
        GlassSection("Ramalan") {
            DetailNote(if(!hasLocation)"Benarkan lokasi di dashboard untuk mendapatkan ramalan."
                else if(forecast==null)"Memuatkan ramalan sebenar…" else "Ramalan tidak tersedia. Cuba semula kemudian.")
        }
        return
    }
    GlassSection("Ramalan setiap jam") {
        val now=LocalDateTime.now(kl).toString().take(16)
        val hours=data.hours.filter { it.time.take(16)>=now }.take(18)
            .ifEmpty { data.hours.take(12) }
        HourlyTemperatureChart(hours)
        hours.forEach { hour ->
            WindowLine(hour.time.replace("T"," • "),
                formatNumber(hour.celsius)+"°C • "+hour.rain+"% hujan")
            DetailNote("Terasa "+formatNumber(hour.feels)+"°C • Kelembapan "+hour.humidity+"%")
        }
    }
    GlassSection("Ramalan 7 hari") {
        data.days.forEach { item ->
            WindowLine(item.date,
                formatNumber(item.low)+"–"+formatNumber(item.high)+"°C • "+item.rain+"% hujan")
        }
    }
    if(forecast.fromCache)DetailNote("Paparan data cache terakhir; sumber mungkin tidak dapat dihubungi.")
}

private val reminders=listOf(
    "Periksa niat sebelum memulakan tugas. Perkara kecil juga bernilai apabila dibuat dengan amanah.",
    "Luangkan beberapa minit untuk menilai cara kita melayani orang lain hari ini.",
    "Jangan biarkan kesibukan menenggelamkan rasa syukur atas perkara yang sudah ada.",
    "Waktu yang berlalu tak kembali. Pilih satu kebaikan yang boleh dilakukan hari ini.",
    "Berhenti seketika daripada gangguan, kemudian sambung tanggungjawab dengan lebih teliti.",
    "Teguran yang lembut lebih mudah menjadi ruang untuk seseorang belajar dan berubah."
)
@Composable private fun PrayerDetail(
    prayer:TodayFeed<TodayPrayer>?,month:TodayFeed<List<TodayPrayerDate>>?
) {
    val data=prayer?.value
    GlassSection("Jadual waktu solat hari ini") {
        if(data==null)DetailNote("Waktu solat tidak tersedia. Benarkan lokasi dan semak sumber JAKIM.")
        else {
            DetailNote("Zon "+data.zone+" • Hijrah "+data.hijri)
            data.times.forEach { (name,time)->WindowLine(name,time) }
            DetailNote("Sumber: jadual JAKIM melalui e-Solat.")
        }
    }
    var verseIndex by remember { mutableIntStateOf(LocalDate.now(kl).dayOfYear%reminders.size) }
    GlassSection("Tazkirah ringkas") {
        AksaraText(reminders[verseIndex],size=12f,line=19f)
        DetailNote("Renungan editorial Aksara. Bukan ayat al-Quran, hadis atau fatwa.")
        AksaraButton("Renungan lain",{
            verseIndex=(verseIndex+1+Random.nextInt(reminders.size-1))%reminders.size
        },Modifier.fillMaxWidth(),height=35.dp,size=10f)
    }
    var allDays by remember { mutableStateOf(false) }
    GlassSection("Takwim solat bulanan") {
        val entries=month?.value
        if(entries.isNullOrEmpty()) DetailNote(if(data==null)"Zon belum diketahui."
            else if(month==null)"Mendapatkan jadual bulanan…" else "Jadual bulanan belum tersedia daripada sumber.")
        else {
            (if(allDays)entries else entries.take(7)).forEach { entry ->
                AksaraText(entry.date+" • "+entry.hijri,size=10.5f,color=gold)
                AksaraText(entry.times.joinToString("   ") { it.first+": "+it.second },
                    size=9.5f,line=15f)
            }
            if(entries.size>7)AksaraButton(if(allDays)"Ringkaskan" else "Lihat semua "+entries.size+" hari",
                {allDays=!allDays},Modifier.fillMaxWidth(),height=34.dp,size=10f)
        }
    }
}

/** Only genuine BTC/USD historical samples may be plotted. */
@Composable private fun MarketPriceChart(prices:List<Double>) {
    if(prices.size<2)return
    val low=prices.minOrNull() ?: return
    val high=prices.maxOrNull() ?: return
    val span=(high-low).coerceAtLeast(0.000001)
    Canvas(Modifier.fillMaxWidth().height(58.dp)) {
        val chart=Path()
        prices.forEachIndexed { index,price ->
            val x=size.width*index/(prices.size-1)
            val y=(size.height-8.dp.toPx())*(1f-((price-low)/span).toFloat())+4.dp.toPx()
            if(index==0)chart.moveTo(x,y) else chart.lineTo(x,y)
        }
        drawPath(chart,color=gold,style=Stroke(width=2.dp.toPx(),cap=StrokeCap.Round))
    }
    Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween) {
        AksaraText(String.format(Locale.US,"USD %.0f",low),size=9f,color=muted)
        AksaraText("BTC/USD · 24 jam",size=9f,color=gold)
        AksaraText(String.format(Locale.US,"USD %.0f",high),size=9f,color=muted)
    }
}

@Composable private fun CryptoDetail(
    coins:TodayFeed<List<TodayCoin>>?,market:TodayMarketResult?,
    trend:TodayFeed<List<Double>>?
) {
    var search by remember { mutableStateOf("") }
    var onlySc by remember { mutableStateOf(true) }
    GlassSection("Pasaran & semakan Syariah") {
        DetailNote("Sumber Syariah: Suruhanjaya Sekuriti Malaysia, sc.com.my/digital-assets. Disemak "+TodayShariahReference.checkedOn+". Status tertakluk pada skop dan perubahan keputusan SAC.")
        AksaraGlassSurface(Modifier.fillMaxWidth().height(42.dp),radius=12.dp) {
            BasicTextField(search,{search=it.take(60)},
                Modifier.fillMaxSize().padding(12.dp),
                singleLine=true,
                textStyle=AksaraTypography.style(12f,17f),
                cursorBrush=SolidColor(gold),
                decorationBox={inner->Box {
                    if(search.isBlank())AksaraText("Cari nama atau simbol",size=11f,color=muted)
                    inner()
                }})
        }
        AksaraButton(if(onlySc)"✓ Hanya disahkan SC" else "Semua aset dalam senarai",
            {onlySc=!onlySc},Modifier.fillMaxWidth(),height=36.dp,size=10.5f)
    }
    GlassSection("Graf BTC 24 jam") {
        val prices=trend?.value
        if(prices==null)DetailNote(if(trend==null)"Memuatkan sejarah harga CoinGecko…"
            else "Sejarah harga tidak tersedia. Graf tidak direka secara sintetik.")
        else {
            MarketPriceChart(prices)
            DetailNote((if(trend.fromCache)"Data cache • " else "Data CoinGecko • ")+
                "Pergerakan BTC, bukan gambaran keseluruhan pasaran.")
        }
    }
    val known=TodayShariahReference.listed+TodayShariahReference.unverified
    // SC status and public market prices are separate independently sourced records.
    val extras=coins?.value.orEmpty().filter { coin -> known.none{it.symbol==coin.symbol} }
        .map { TodayShariahCoin(it.symbol,it.symbol,"") }
    val all=(known+extras).filter {
        (it.symbol.contains(search,true)||it.name.contains(search,true)) &&
            (!onlySc || TodayShariahReference.status(it.symbol).startsWith("Patuh"))
    }
    GlassSection("Aset digital ("+all.size+")") {
        if(all.isEmpty())DetailNote("Tiada aset sepadan dengan carian.")
        all.forEach { asset ->
            val quote=market?.quotes?.get(asset.symbol)
            val fallback=coins?.value?.firstOrNull { it.symbol==asset.symbol }
            val usd=quote?.usd ?: fallback?.usd
            val change=quote?.change24h ?: fallback?.change24h
            Column(verticalArrangement=Arrangement.spacedBy(3.dp)) {
                Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween) {
                    AksaraText(asset.name+" ("+asset.symbol+")",Modifier.weight(1f),
                        size=11.5f,weight=650)
                    AksaraText(usd?.let{String.format(Locale.US,
                        if(it<0.01)"$%.6f" else if(it<1)"$%.4f" else "$%.2f",it)}
                        ?: "Harga tiada",size=10f,color=muted)
                }
                DetailNote(TodayShariahReference.status(asset.symbol)+
                    (if(asset.sacDate.isNotBlank())" • SAC "+asset.sacDate else ""))
                if(change!=null) DetailNote("24 jam: "+String.format(Locale.US,"%+.2f%%",change))
                if(asset.symbol=="MATIC")DetailNote("Token MATIC lama telah beralih kepada POL. Status Syariah POL perlu semakan berasingan; harga POL tidak dipaparkan sebagai MATIC.")
            }
            Spacer(Modifier.height(6.dp))
        }
    }
    coins?.updatedAt?.let { timestamp ->
        DetailNote("BTC/ETH/SOL · "+(if(coins.fromCache)"data cache • " else "data diterima • ")+
            runCatching { Instant.ofEpochMilli(timestamp).atZone(kl)
                .format(DateTimeFormatter.ofPattern("dd MMM HH:mm",ms)) }.getOrDefault("masa tidak diketahui"))
    }
    DetailNote("Harga: CoinGecko (berkumpulan), fallback BTC/ETH/SOL: CoinPaprika. "+
        (if(market?.cached==true)"Paparan data cache; " else "")+
        "Harga/24j mungkin lewat atau tiada. Bukan nasihat pelaburan atau fatwa. Status aset tidak bermakna semua platform atau produk leverage patuh Syariah.")
}

@Composable private fun DevelopmentDetail(
    current:TodayFeed<TodayCommit>?,development:TodayDevelopment?
) {
    GlassSection("APK dipasang pada peranti") {
        WindowLine("Versi",BuildConfig.VERSION_NAME.take(50))
        val knownSha=BuildConfig.SOURCE_COMMIT_SHA
        WindowLine("SHA sumber",if(knownSha.isBlank())"Tidak dilaporkan" else knownSha.take(10))
        if(knownSha.isNotBlank() && current?.value!=null) {
            DetailNote(if(knownSha.equals(current.value.sha,ignoreCase=true))
                "SHA APK sama dengan commit branch pembangunan terkini."
                else "SHA APK berbeza daripada commit terkini; build pratonton dan branch mungkin berlainan.")
        } else DetailNote("Tiada inferens versi terkini dibuat tanpa SHA sumber APK.")
    }
    GlassSection("Commit Android terbaru") {
        if(current?.value==null)DetailNote("Belum dapat mengesahkan commit terkini.")
        else {
            AksaraText(current.value.message,size=12f,weight=650)
            WindowLine("SHA",current.value.sha.take(10))
            WindowLine("CI (SHA sama)",current.value.ci)
            DetailNote("Penulis: "+(current.value.author ?: "Tidak tersedia"))
        }
    }
    if(development==null) {
        GlassSection("Sejarah pembangunan") { DetailNote("Memuatkan sejarah GitHub…") }
        return
    }
    GlassSection("Android • branch pembangunan") {
        if(development.android.isEmpty())DetailNote("Sejarah commit tidak tersedia.")
        development.android.forEach { rev ->
            AksaraText(rev.message,size=11.5f,weight=600)
            DetailNote(rev.sha.take(8)+" • "+rev.author+" • "+readableDate(rev.date))
            Spacer(Modifier.height(5.dp))
        }
    }
    GlassSection("Bilik Antara • branch main") {
        DetailNote("Ini sejarah commit branch main, bukan bukti web sudah di-deploy.")
        if(development.web.isEmpty())DetailNote("Sejarah branch main tidak tersedia.")
        development.web.forEach { rev ->
            AksaraText(rev.message,size=11.5f,weight=600)
            DetailNote(rev.sha.take(8)+" • "+readableDate(rev.date))
            Spacer(Modifier.height(5.dp))
        }
    }
    GlassSection("GitHub Releases & APK") {
        if(development.releases.isEmpty())DetailNote("Senarai releases tidak tersedia.")
        development.releases.forEach { release ->
            AksaraText(release.title,size=11.5f,weight=650)
            DetailNote(release.tag+" • "+readableDate(release.date)+
                (if(release.prerelease)" • Pratonton" else " • Release"))
            DetailNote(if(release.apkPublished)"Aset .apk diterbitkan"
                else "Tiada fail .apk dalam release ini")
            Spacer(Modifier.height(5.dp))
        }
        DetailNote("Commit, CI, prerelease, release dan APK ialah status berlainan. Tiada APK direka atau ditandakan berjaya tanpa aset sebenar.")
    }
}
