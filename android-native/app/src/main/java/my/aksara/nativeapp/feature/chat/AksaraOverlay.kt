package my.aksara.nativeapp.feature.chat

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.*
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.*
import my.aksara.nativeapp.core.design.*
import dev.chrisbanes.haze.*
import kotlinx.coroutines.launch
import my.aksara.engine.runtime.RuntimeClient
import my.aksara.nativeapp.feature.voice.VoiceContent
import my.aksara.nativeapp.feature.voice.VoiceScreen
import my.aksara.engine.voice.VoiceState
import my.aksara.nativeapp.feature.studio.StudioContent
import my.aksara.nativeapp.feature.library.LibraryContent
import my.aksara.nativeapp.feature.library.NovelContent
import my.aksara.nativeapp.feature.tools.*

@Composable fun AksaraOverlay(kind:String,state:ChatState,onClose:()->Unit,onNavigate:(String)->Unit,onRefresh:()->Unit,
    onMode:(String)->Unit,onRestore:()->Unit,onClear:()->Unit,onPickAttachment:()->Unit,onAsk:(String)->Unit) {
    if(kind=="voice"){VoiceContent(onClose,state.mode,onMode);return}
    if(kind=="voice-fixture"){VoiceScreen(VoiceState(phase="preview"),onClose,preview=true);return}
    val margins=aksaraDeviceMargins()
    val haze=LocalBackdrop.current
    val modalBackdrop=remember{HazeState()}
    var notice by remember(kind) {mutableStateOf<String?>(null)}
    val scroll=rememberScrollState()
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val h=maxHeight
        val density=LocalDensity.current
        val measurer=rememberTextMeasurer()
        val modeOptions=listOf(Triple("Cahaya","Gaya Aksara asal. Santai, jelas dan responsif.","sun"),Triple("Gelap","Falsafah moden. Mendalam, kritis dan sinis.","moon"))
        val modeTextWidth=with(density){(maxWidth-156.dp).roundToPx().coerceAtLeast(1)}
        val modeHeights=modeOptions.map{(_,description,_)->
            val lines=measurer.measure(AnnotatedString(description),AksaraTypography.style(10.5f,15.75f),constraints=Constraints(maxWidth=modeTextWidth)).lineCount
            maxOf(73.dp,(24f+18.2f+4f+15.75f*lines).dp)
        }
        val attachmentSummary="Pilih bahan untuk analisis atau buka kod dalam Workspace. Fail kekal dalam tab ini sehingga dihantar."
        val attachmentLines=measurer.measure(AnnotatedString(attachmentSummary),AksaraTypography.style(12f,18.6f),constraints=Constraints(maxWidth=with(density){(maxWidth-114.dp).roundToPx().coerceAtLeast(1)})).lineCount
        Box(Modifier.fillMaxSize().hazeSource(modalBackdrop).hazeEffect(haze,HazeStyle(tints=emptyList(), backgroundColor=Color(0xff070911),blurRadius=14.dp,noiseFactor=0f)).background(Color(2,6,13,64)).clickable(onClick=onClose))
        val height=when(kind){"connection"->425.766.dp;"code"->minOf(740.dp,h-28.dp);"terminal"->minOf(650.dp,h*.82f);"portal"->589.594.dp;"thinking"->273.594.dp+modeHeights.fold(0.dp){total,item->total+item};"attachments"->593.547.dp+(18.59375f*(attachmentLines-3)).dp;"voice-permission"->280.594.dp;"studio"->minOf(730.dp,h-32.dp);"library"->minOf(710.dp,h-32.dp);"novel"->minOf(750.dp,h-32.dp);"knowledge"->minOf(550.dp,h-36.dp);"metrics"->minOf(640.dp,h-36.dp);"security"->minOf(540.dp,h-36.dp);"engines"->minOf(520.dp,h-36.dp);else->minOf(650.dp,h-60.dp)}
        val side=when(kind){"terminal","portal"->14.dp;"voice-permission"->15.dp;else->17.dp}+4.dp
        CompositionLocalProvider(LocalBackdrop provides modalBackdrop) {
        AksaraGlassSurface(Modifier.align(Alignment.Center).padding(horizontal=side).fillMaxWidth().heightIn(max=h-maxOf(28.dp,margins.top+margins.bottom+16.dp)).height(height).clickable(enabled=false){},
            radius=if(kind=="voice-permission")24.dp else 19.dp,blur=if(kind=="voice-permission")27.dp else 4.dp,
            brush=if(kind=="voice-permission")Brush.linearGradient(listOf(Color(29,39,53,97),Color(10,17,30,77),Color(25,38,54,102))) else DialogGradient,border=Color(244,217,176,94)) {
            Column(Modifier.fillMaxSize().padding(if(kind=="voice-permission")18.dp else if(kind=="terminal")15.dp else 16.dp).then(if(kind=="code")Modifier else Modifier.verticalScroll(scroll))) {
                if(kind=="voice-permission") {
                    Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(13.dp)) {
                        AksaraGlassSurface(Modifier.size(44.dp),radius=999.dp) { AksaraIcon("mic",Modifier.align(Alignment.Center).size(22.dp)) }
                        Column { AksaraText("Aktifkan mikrofon",size=17f,line=22.1f,weight=600,family=AksaraTypography.heading);AksaraText("AKSARA VOICE CHAT",size=10f,tracking=1.2f,color=AksaraColors.muted) }
                    }
                    Spacer(Modifier.height(17.dp))
                    AksaraText("Aksara perlukan izin mikrofon untuk mendengar kau. Audio hanya dihantar ke Gemini Live apabila sesi suara aktif.",size=13f,line=21.45f,weight=500)
                    Spacer(Modifier.height(17.dp))
                    AksaraText("Android meminta kebenaran mikrofon selepas kau tekan Aktifkan Mikrofon.",size=11f,line=18.15f,color=AksaraColors.muted)
                    Spacer(Modifier.weight(1f));Spacer(Modifier.height(22.dp))
                    Row(horizontalArrangement=Arrangement.spacedBy(10.dp)) {
                        AksaraButton("Batal",onClose,Modifier.weight(.37f))
                        AksaraButton("Aktifkan Mikrofon",{onNavigate("voice")},Modifier.weight(.63f))
                    }
                } else {
                    val title=when(kind){"connection"->"Connection · Provider Health";"code"->"Code Engine · Runtime Health";"terminal"->"AKSARA Terminal";"portal"->"Ciri & Fungsi";"thinking"->"Thinking Mode";"attachments"->"Tambah lampiran";"sessions"->"Sesi & Sejarah";"knowledge"->"Pusat Pengetahuan & Rujukan";"studio"->"Studio Antara";"library"->"Perpustakaan AKSARA";"novel"->"Baca Novel";"security"->"Security Lab";"metrics"->"Prestasi A.I."; "engines"->"Native Engines";else->kind}
                    Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.Top,horizontalArrangement=Arrangement.spacedBy(12.dp)) {
                        Column(Modifier.weight(1f)) {
                            AksaraText(title,size=16f,line=20.8f,weight=700,tracking=.4f)
                            val subtitle=when(kind){"connection"->"Empat penyedia AI teks termasuk empat sambungan Gemini. Status Sedia tidak bermaksud sambungan telah disahkan.";"code"->"Lima runtime untuk menjalankan kod termasuk C++20. Pratonton HTML/CSS diasingkan dalam sandbox. Runtime lain hanya disahkan selepas kod berjaya dijalankan.";"terminal"->"Terminal native dalam proses berasingan. Shell Android, bukan shell server.";"thinking"->"Pilih cara Aksara A.I. berfikir dan menjawab.";"attachments"->"Pilih bahan untuk analisis atau buka kod dalam Workspace. Fail kekal dalam tab ini sehingga dihantar.";else->""}
                            if(subtitle.isNotEmpty()){Spacer(Modifier.height(8.dp));AksaraText(subtitle,size=if(kind=="code")11.5f else 12f,line=18.6f,color=Color(0xffc4bfba))}
                        }
                        AksaraButton("×",onClose,Modifier.width(36.dp),size=22f,height=37.dp,radius=10.dp)
                    }
                    when(kind) {
                        "connection" -> {
                            Spacer(Modifier.height(10.dp));AksaraText("${state.providers.count{it.second=="online"}}/4 Connected · "+if(state.providers.isEmpty())"Not checked yet" else "Checked",size=9.5f,line=13.3f,color=AksaraColors.muted)
                            Spacer(Modifier.height(10.dp))
                            val providers=listOf("gemini" to "Google Gemini","groq" to "Groq","workers_ai" to "Cloudflare Workers AI","openrouter" to "OpenRouter")
                            providers.forEach { (id,name) ->
                                var expanded by remember {mutableStateOf(false)}
                                MenuRow(name,state.providers.find{it.first==id}?.second?:"Unverified",height=43.dp) {expanded=!expanded}
                                if(expanded) AksaraText(if(id=="gemini")"Gemini 1 / 2 / 3 / 4 · status setiap slot belum dipaparkan" else "Status dilaporkan oleh backend. Sedia bukan bukti ujian inferens.",Modifier.padding(8.dp),size=10f,color=AksaraColors.muted)
                                Spacer(Modifier.height(8.dp))
                            }
                            Spacer(Modifier.weight(1f));AksaraButton("Refresh Status",onRefresh,Modifier.fillMaxWidth(),height=49.dp)
                        }
                        "code" -> CodeEngineContent(onNavigate)
                        "terminal" -> TerminalContent()
                        "studio" -> StudioContent()
                        "library" -> LibraryContent(onNavigate)
                        "novel" -> NovelContent()
                        "knowledge" -> KnowledgeContent(onAsk)
                        "metrics" -> MetricsContent(state,onRefresh)
                        "security" -> SecurityContent()
                        "engines" -> AdvancedEnginesContent()
                        "portal" -> {
                            Spacer(Modifier.height(29.dp))
                            listOf(Triple("Studio · Jana Imej","FLUX · Cloudflare Workers AI","studio"),Triple("Novel · Perpustakaan AKSARA","Prosa, klasik dan sastera falsafah","library"),Triple("Security Lab","Audit laman · Kod · Dependency","security"),Triple("Prestasi A.I","Respons, provider dan kesihatan storan","metrics"),Triple("Sesi & Sejarah","Perbualan, carian dan arkib JSON","sessions"),Triple("Pengetahuan & Rujukan","Karya · Wikipedia · URL · pengiraan","knowledge"),Triple("Game · Linux · SD-Turbo","Inventori enjin Android dan status integrasi","engines")).forEach { (name,desc,route) ->
                                FeatureRow(name,desc,if(route=="security")"shield" else "book") {onNavigate(route)};Spacer(Modifier.height(9.dp))
                            }
                            Spacer(Modifier.height(7.dp));MenuRow("Privasi & Tetapan","›",height=57.594.dp){onNavigate("privacy")}
                        }
                        "thinking" -> {
                            Spacer(Modifier.height(14.dp))
                            Box(Modifier.fillMaxWidth().height(157.609.dp).clip(RoundedCornerShape(12.dp)).background(Color(5,10,18,66)).border(1.dp,Color(225,207,179,48),RoundedCornerShape(12.dp))){
                                Column(Modifier.padding(11.dp),verticalArrangement=Arrangement.spacedBy(7.dp)){
                                    AksaraText("STATUS MOD",size=11f,line=14.3f,weight=650,color=Color(0xffe4d2b2),tracking=.22f,family=AksaraTypography.heading)
                                    listOf("Mod dipilih" to if(state.mode=="gelap")"Gelap" else "Cahaya","Permintaan semasa" to if(state.busy)"Generating Response" else "Tiada permintaan aktif","Permintaan terakhir" to if(state.messages.isEmpty())"Belum ada dalam tab ini" else if(state.messages.last().incomplete)"Belum lengkap" else "Selesai").forEach{(label,value)->
                                        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){AksaraText(label,size=10.5f,line=14.7f,color=Color(0xffd0c2b2));AksaraText(value,size=10.5f,line=14.7f,weight=600)}
                                    }
                                    AksaraText("Cahaya/Gelap mengubah pendekatan jawapan. Tahap penaakulan model ditentukan secara adaptif oleh sistem; paparan ini bukan bukti tahap tersebut.",size=10.5f,line=15.75f,color=Color(0xffbab4ab))
                                }
                            }
                            Spacer(Modifier.height(12.dp))
                            modeOptions.forEachIndexed{index,(name,description,icon)->
                                val selected=state.mode==name.lowercase()
                                AksaraGlassSurface(Modifier.fillMaxWidth().height(modeHeights[index]).clickable{onMode(name.lowercase());onClose()},radius=13.dp,border=if(selected)Color(239,203,145,190) else AksaraColors.border){
                                    Row(Modifier.fillMaxSize().padding(horizontal=12.dp),verticalAlignment=Alignment.CenterVertically){
                                        AksaraIcon(icon,Modifier.size(25.dp),if(index==0)AksaraColors.gold else Color(0xffadc7e5))
                                        Spacer(Modifier.width(13.dp))
                                        Column(Modifier.weight(1f)){AksaraText(name,size=14f,line=18.2f,weight=650);Spacer(Modifier.height(4.dp));AksaraText(description,size=10.5f,line=15.75f,color=Color(0xffc2b8aa))}
                                        Spacer(Modifier.width(10.dp))
                                        Box(Modifier.width(18.dp).height(21.dp),contentAlignment=Alignment.Center){if(selected)AksaraText("✓",size=16f,line=21f,weight=500,color=AksaraColors.gold)}
                                    }
                                }
                                if(index==0)Spacer(Modifier.height(10.dp))
                            }
                        }
                        "attachments" -> {
                            Spacer(Modifier.height(16.dp))
                            listOf("Foto & Kamera" to "JPG, PNG, WebP, GIF · 64 MB","Video" to "MP4, WebM · 128 MB","Dokumen" to "PDF, DOCX, TXT, MD, CSV, JSON","Audio" to "MP3, M4A, WAV, OGG, WebM","Kod" to "HTML, CSS, JS, TS, Python, SQL, C++").forEach { (name,desc) -> FeatureRow(name,desc,"attach"){onPickAttachment();onClose()};Spacer(Modifier.height(8.dp)) }
                            AksaraText("Dokumen teks sehingga 100 KB. Imej, PDF, audio dan video inline sehingga 3.6 MB; format serta had backend tetap terpakai.",size=10f,color=AksaraColors.muted)
                        }
                        "sessions" -> {
                            Spacer(Modifier.height(20.dp));AksaraText("${state.archive.size} mesej tersimpan setempat dan disulitkan.",size=12f)
                            Spacer(Modifier.height(16.dp));AksaraButton("Buka sesi tersimpan",{onRestore();onClose()},Modifier.fillMaxWidth())
                            Spacer(Modifier.height(12.dp));AksaraButton("Kosongkan paparan",{onClear();onClose()},Modifier.fillMaxWidth())
                        }
                        "voice" -> VoiceContent(onClose)
                        else -> {
                            Spacer(Modifier.height(20.dp));AksaraText(when(kind){"privacy"->"Sesi disulitkan menggunakan Android Keystore. Memori pilihan tidak dihantar. Audio tidak disimpan. Tiada API key penyedia di dalam APK.";"metrics"->"Status provider datang daripada backend. Ukuran RAM dan startup terdapat dalam laporan QA CI, bukan angka anggaran.";else->"Integrasi native $kind belum lengkap. Ciri ini belum boleh dianggap berfungsi atau lulus parity."},size=13f)
                        }
                    }
                    if(notice!=null){Spacer(Modifier.height(10.dp));AksaraText(notice!!,size=11f,color=Color(0xffe7a08e))}
                }
            }
        }
        }
    }
}
@Composable private fun MenuRow(name:String,status:String,height:Dp=49.dp,onClick:()->Unit) {
    AksaraGlassSurface(Modifier.fillMaxWidth().height(height).clickable(onClick=onClick),radius=13.dp) {
        Row(Modifier.fillMaxSize().padding(horizontal=12.dp),verticalAlignment=Alignment.CenterVertically) {AksaraText(name,Modifier.weight(1f),size=12f,weight=600);AksaraText(status,size=10f,line=14f,color=AksaraColors.muted)}
    }
}
@Composable private fun FeatureRow(name:String,desc:String,icon:String,height:Dp=62.dp,onClick:()->Unit) {
    AksaraGlassSurface(Modifier.fillMaxWidth().height(height).clickable(onClick=onClick),radius=14.dp) {
        Row(Modifier.fillMaxSize().padding(horizontal=11.dp),horizontalArrangement=Arrangement.spacedBy(12.dp),verticalAlignment=Alignment.CenterVertically) {
            AksaraIcon(icon,Modifier.size(20.dp));Column(Modifier.weight(1f)){AksaraText(name,size=12.5f,line=16.25f,weight=600);Spacer(Modifier.height(3.dp));AksaraText(desc,size=10.5f,line=15.75f,color=AksaraColors.muted)};AksaraText("›",size=19f,color=AksaraColors.gold)
        }
    }
}
@Composable private fun TerminalContent() {
    var code by rememberSaveableCompat {mutableStateOf("console.log('Aksara native');")}
    var command by remember {mutableStateOf("")};var output by remember {mutableStateOf("Belum diuji")}
    val context=LocalContext.current;val scope=rememberCoroutineScope()
    val runtime=remember {RuntimeClient(context)}
    var activeJob by remember {mutableStateOf<kotlinx.coroutines.Job?>(null)}
    var language by remember {mutableStateOf("javascript")}
    DisposableEffect(Unit){onDispose{activeJob?.cancel()}}
    fun run(lang:String,text:String){if(activeJob?.isActive==true)return;output="Menjalankan $lang…";activeJob=scope.launch{try{output=runtime.execute(lang,text)}catch(e:Exception){output=e.message?:"Runtime gagal."}}}
    Spacer(Modifier.height(14.dp));AksaraText("Code Intelligence",size=13f,weight=600)
    Spacer(Modifier.height(8.dp));Row(horizontalArrangement=Arrangement.spacedBy(6.dp)){listOf("javascript","sql","shell").forEach {lang-> AksaraButton(lang,{language=lang},Modifier.weight(1f),size=10f,height=32.dp)}}
    Spacer(Modifier.height(12.dp));AksaraGlassSurface(Modifier.fillMaxWidth().height(160.dp)) {
        BasicTextField(code,{code=it},Modifier.fillMaxSize().padding(12.dp),textStyle=AksaraTypography.style(12f,18f).copy(fontFamily=androidx.compose.ui.text.font.FontFamily.Monospace))
    }
    Spacer(Modifier.height(10.dp));Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
        AksaraButton("▶ Run",{run(language,code)},Modifier.weight(1f))
        AksaraButton("■ Stop",{activeJob?.cancel();output="Proses dihentikan."},Modifier.weight(1f))
    }
    Spacer(Modifier.height(16.dp));AksaraText("TERMINAL",size=12f,weight=600)
    AksaraText(output,Modifier.fillMaxWidth().height(100.dp).verticalScroll(rememberScrollState()).padding(vertical=10.dp),size=11f,color=AksaraColors.muted)
    AksaraGlassSurface(Modifier.fillMaxWidth().height(44.dp)) {BasicTextField(command,{command=it},Modifier.fillMaxWidth().padding(10.dp),textStyle=AksaraTypography.style(12f))}
    Spacer(Modifier.height(8.dp));AksaraButton("Enter",{run("shell",command)},Modifier.fillMaxWidth())
}
@Composable private fun <T> rememberSaveableCompat(calculation:()->T):T = remember(calculation=calculation)
