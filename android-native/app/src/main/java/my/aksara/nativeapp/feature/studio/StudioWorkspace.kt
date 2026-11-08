package my.aksara.nativeapp.feature.studio

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.graphics.Bitmap
import android.os.SystemClock
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import my.aksara.nativeapp.core.design.*
import java.security.SecureRandom
import java.util.Locale

private data class StudioPreview(
    val bitmap: Bitmap,
    val engine: StudioEngine,
    val model: String,
    val prompt: String,
    val elapsed: Long,
    val ratio: String,
    val quality: String,
    val seed: Long?,
    val style: String
)

private fun newStudioSeed(): Long = SecureRandom().nextInt(Int.MAX_VALUE).toLong()

@Composable
private fun StudioSectionHeader(title: String, note: String) {
    AksaraText(title, size=14f, weight=650, family=AksaraTypography.heading)
    AksaraText(note, size=11f, color=AksaraColors.muted)
    Spacer(Modifier.height(8.dp))
}

@Composable
private fun StudioInput(value: String, onValueChange: (String) -> Unit, hint: String, height: androidx.compose.ui.unit.Dp) {
    AksaraGlassSurface(Modifier.fillMaxWidth().height(height), radius=17.dp, blur=7.dp,
        border=Color(177,190,213,67)) {
        BasicTextField(value, onValueChange,
            modifier=Modifier.fillMaxSize().padding(12.dp).semantics { contentDescription=hint },
            textStyle=AksaraTypography.style(13f, 19f),
            cursorBrush=SolidColor(AksaraColors.gold),
            decorationBox={ inner ->
                Box {
                    if(value.isEmpty()) AksaraText(hint, size=12f, color=AksaraColors.muted)
                    inner()
                }
            })
    }
}

@Composable
private fun StudioViewer(bitmap: Bitmap, onClose: () -> Unit) {
    Dialog(onDismissRequest=onClose, properties=DialogProperties(usePlatformDefaultWidth=false)) {
        var zoom by remember { mutableFloatStateOf(1f) }
        var shift by remember { mutableStateOf(Offset.Zero) }
        Column(Modifier.fillMaxSize().background(Color(0xF60B101C)).padding(15.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement=Arrangement.End) {
                AksaraButton("Tutup", onClose, Modifier.width(90.dp), icon="close", height=38.dp)
            }
            Box(Modifier.fillMaxWidth().weight(1f).pointerInput(Unit) {
                detectTransformGestures { _, pan, factor, _ ->
                    zoom=(zoom * factor).coerceIn(1f, 5f)
                    shift=if(zoom>1f)shift+pan else Offset.Zero
                }
            }, contentAlignment=Alignment.Center) {
                Image(bitmap.asImageBitmap(), "Paparan imej penuh", Modifier.fillMaxSize()
                    .graphicsLayer(scaleX=zoom,scaleY=zoom,translationX=shift.x,translationY=shift.y),
                    contentScale=ContentScale.Fit)
            }
            AksaraText("Cubit untuk zum · seret untuk bergerak", Modifier.fillMaxWidth(),
                size=11f,color=AksaraColors.muted)
        }
    }
}

@Composable
private fun StudioConfirm(title: String, onConfirm: () -> Unit, onCancel: () -> Unit) {
    Dialog(onDismissRequest=onCancel) {
        AksaraGlassSurface(Modifier.fillMaxWidth(),radius=24.dp,blur=14.dp,
            border=Color(218,192,149,95),brush=DialogGradient) {
            Column(Modifier.fillMaxWidth().padding(18.dp), verticalArrangement=Arrangement.spacedBy(12.dp)) {
                AksaraText(title,size=14f,weight=600)
                Row(horizontalArrangement=Arrangement.spacedBy(10.dp)) {
                    AksaraButton("Batal",onCancel,Modifier.weight(1f))
                    AksaraButton("Sahkan",onConfirm,Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun StudioIdeas(onPick:(String)->Unit,onClose:()->Unit) {
    val ideas=listOf(
        "A cinematic mountain valley at sunrise, low mist and a winding river, natural colors",
        "A modern literary desk in soft afternoon light, open notebook and quiet atmosphere",
        "A futuristic library with intricate architecture and subtle blue lighting",
        "A photorealistic tropical forest after rain, dramatic cloud cover"
    )
    Dialog(onDismissRequest=onClose) {
        AksaraGlassSurface(Modifier.fillMaxWidth(),radius=22.dp,blur=15.dp,
            brush=DialogGradient,border=Color(218,192,149,95)) {
            Column(Modifier.fillMaxWidth().padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
                AksaraText("Idea Prompt",size=15f,weight=650)
                AksaraText("Pilih cadangan. Semua boleh diedit selepas dipilih.",size=11f,color=AksaraColors.muted)
                ideas.forEachIndexed { index,idea ->
                    AksaraButton((index+1).toString()+". "+idea.take(33)+"…",
                        {onPick(idea)},Modifier.fillMaxWidth(),size=10.5f,height=47.dp)
                }
                AksaraButton("Tutup",onClose,Modifier.fillMaxWidth(),height=37.dp)
            }
        }
    }
}

@Composable
fun StudioContent() {
    val context=LocalContext.current
    val scope=rememberCoroutineScope()
    val prefs=remember(context){context.getSharedPreferences("aksara-studio-v2",Context.MODE_PRIVATE)}
    val historyStore=remember(context){StudioHistoryStore(context)}
    val models=remember(context){LocalModelManager(context)}
    val localRuntime=remember{LocalSDTurboEngine()}
    var page by rememberSaveable{mutableStateOf(StudioPage.GENERATE.name)}
    var engineName by rememberSaveable{mutableStateOf(StudioEngine.CLOUD.name)}
    val engine=StudioEngine.valueOf(engineName)
    var prompt by rememberSaveable{mutableStateOf("")}
    var model by rememberSaveable{mutableStateOf(prefs.getString("model","klein") ?: "klein")}
    var ratio by rememberSaveable{mutableStateOf(prefs.getString("ratio","1:1") ?: "1:1")}
    var quality by rememberSaveable{mutableStateOf(prefs.getString("quality","balanced") ?: "balanced")}
    var style by rememberSaveable{mutableStateOf("none")}
    var seedDraft by rememberSaveable{mutableStateOf("")}
    var preview by remember{mutableStateOf<StudioPreview?>(null)}
    var records by remember{mutableStateOf<List<StudioRecord>>(emptyList())}
    var message by remember{mutableStateOf("Tulis arahan dan pilih enjin untuk menjana imej.")}
    var job by remember{mutableStateOf<Job?>(null)}
    var runningEngine by remember{mutableStateOf<StudioEngine?>(null)}
    var downloadJob by remember{mutableStateOf<Job?>(null)}
    var downloaded by remember{mutableLongStateOf(0L)}
    var downloadState by remember{mutableStateOf("")}
    var enhancedDraft by remember{mutableStateOf<String?>(null)}
    var enhancementJob by remember{mutableStateOf<Job?>(null)}
    var showIdeas by remember{mutableStateOf(false)}
    var showAdvanced by rememberSaveable{mutableStateOf(false)}
    var requirementsVisible by remember{mutableStateOf(false)}
    var showViewer by remember{mutableStateOf(false)}
    var confirmDelete by remember{mutableStateOf<String?>(null)}
    var confirmClear by remember{mutableStateOf(false)}
    var confirmRemoveModel by remember{mutableStateOf(false)}
    var localVerified by remember{mutableStateOf(false)}
    val currentRecord=remember{mutableStateOf<StudioRecord?>(null)}

    LaunchedEffect(Unit) {
        try { records=historyStore.list() }
        catch(e:Exception) { message="Sejarah gagal dibaca: "+(e.message ?: "ralat storan") }
    }
    DisposableEffect(Unit){onDispose{job?.cancel();downloadJob?.cancel();enhancementJob?.cancel()}}

    fun generate(variation:Boolean=false,replay:StudioPreview?=null) {
        if(job?.isActive==true) return
        val selectedEngine=replay?.engine ?: engine
        val clean=try { StudioRules.prompt(replay?.prompt ?: prompt) } catch(e:Exception) { message=e.message.orEmpty();return }
        val selectedModel=if(replay?.engine==StudioEngine.CLOUD) {
            when {
                replay.model.contains("Klein",ignoreCase=true)->"klein"
                replay.model.contains("Schnell",ignoreCase=true)->"schnell"
                replay.model.contains("OVH",ignoreCase=true)->"ovh"
                else->{message="Model Cloud dalam sejarah tidak dikenali.";return}
            }
        } else model
        val selectedRatio=if(selectedEngine==StudioEngine.LOCAL || selectedModel!="klein")"1:1" else (replay?.ratio?:ratio)
        val selectedQuality=replay?.quality ?: quality
        val selectedStyle=replay?.style ?: style
        val selectedSeed=try {
            if(variation) newStudioSeed()
            else if(replay!=null)replay.seed
            else if(selectedEngine==StudioEngine.LOCAL || selectedModel=="klein") StudioRules.seed(seedDraft)
            else null
        } catch(e:Exception){message=e.message.orEmpty();return}
        if(selectedEngine==StudioEngine.CLOUD) {
            try{StudioRules.cloud(selectedModel,selectedRatio,selectedQuality,selectedSeed)}
            catch(e:Exception){message=e.message.orEmpty();return}
        } else {
            if(!localRuntime.available()) {message="APK ini tidak mempunyai enjin JNI SD-Turbo. Gunakan binaan Native SD-Turbo.";return}
            if(models.modelPath()==null) { message="Model belum dipasang dan disahkan.";return }
            val warning=models.deviceWarning()
            if(warning!=null){message=warning;return}
        }
        job=scope.launch {
            runningEngine=selectedEngine
            val began=SystemClock.elapsedRealtime()
            message=if(selectedEngine==StudioEngine.CLOUD)"Menghubungi Studio Cloud…" else "SD-Turbo sedang menjana secara tempatan…"
            try {
                val effectiveSeed=if(selectedEngine==StudioEngine.LOCAL)selectedSeed?:newStudioSeed() else selectedSeed
                val generated=if(selectedEngine==StudioEngine.CLOUD)
                    StudioGateway.generate(clean,selectedModel,selectedStyle,selectedQuality,selectedRatio,effectiveSeed)
                else {
                    val path=models.modelPath() ?: error("Model belum dipasang.")
                    check(models.verify()) { "Fail model rosak atau integriti SHA-256 gagal." }
                    val bitmap=localRuntime.generate(path,clean,effectiveSeed!!)
                    StudioGateway.Result(bitmap,"SD-Turbo",0L,bitmap.width,bitmap.height)
                }
                val elapsed=SystemClock.elapsedRealtime()-began
                val result=StudioPreview(generated.bitmap,selectedEngine,generated.model,clean,
                    elapsed,selectedRatio,selectedQuality,effectiveSeed,selectedStyle)
                preview=result
                page=StudioPage.GENERATE.name
                try {
                    currentRecord.value=historyStore.save(result.bitmap,selectedEngine.name,result.model,
                        clean,elapsed,effectiveSeed,selectedRatio,selectedQuality,selectedStyle)
                    records=historyStore.list()
                    message="Imej siap dan disimpan dalam sejarah Studio."
                } catch(e:Exception) {
                    message="Imej siap, tetapi sejarah tidak dapat disimpan: "+(e.message?:"storan gagal")
                }
            } catch(_:CancellationException) { message="Permintaan dihentikan. Prompt dan hasil terdahulu dikekalkan." }
            catch(e:Exception) { message=e.message ?: "Gagal menjana imej. Hasil terdahulu dikekalkan." }
            finally { runningEngine=null }
        }
    }

    val importer=rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if(uri!=null) downloadJob=scope.launch {
            downloadState="Mengimport dan mengesahkan model…"
            try{
                models.import(uri){done,_->downloaded=done}
                localVerified=false
                downloadState="Model sah dipasang. Sahkan runtime sebelum menjana."
            }catch(e:Exception){downloadState=e.message ?: "Import gagal."}
        }
    }
    fun refreshHistory(){scope.launch{records=historyStore.list()}}
    fun openRecord(record:StudioRecord){
        scope.launch {
            val bitmap=historyStore.bitmap(record)
            if(bitmap==null){message="Imej sejarah tidak dapat dibaca.";return@launch}
            preview=StudioPreview(bitmap,StudioEngine.valueOf(record.engine),record.model,
                record.prompt,record.durationMs,record.ratio,record.quality,record.seed,record.style)
            currentRecord.value=record
            showViewer=true
        }
    }
    fun copyPrompt(value:String){
        val cb=context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        cb.setPrimaryClip(ClipData.newPlainText("Studio Antara prompt",value))
        message="Prompt disalin."
    }

    Spacer(Modifier.height(8.dp))
    Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            AksaraText("STUDIO ANTARA  V2",size=13f,weight=700,tracking=.5f,
                family=AksaraTypography.heading)
            AksaraText("Satu studio · dua enjin",size=10.5f,color=AksaraColors.muted)
        }
        AksaraText("NATIVE",size=10f,color=AksaraColors.gold)
    }
    Spacer(Modifier.height(12.dp))
    Row(horizontalArrangement=Arrangement.spacedBy(5.dp)) {
        listOf(StudioPage.GENERATE to "Jana Imej",StudioPage.GALLERY to "Galeri",
            StudioPage.HISTORY to "Sejarah",StudioPage.SETTINGS to "Tetapan").forEach { (id,title) ->
            AksaraButton((if(page==id.name)"• " else "")+title,{page=id.name},
                Modifier.weight(1f),size=9.5f,height=37.dp,radius=12.dp,
                contentColor=if(page==id.name)AksaraColors.gold else AksaraColors.text)
        }
    }
    Spacer(Modifier.height(14.dp))

    if(page==StudioPage.GENERATE.name) {
        StudioSectionHeader("Enjin Penjanaan","Cloud untuk jana online · Local untuk jana pada peranti")
        Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
            AksaraButton((if(engine==StudioEngine.CLOUD)"✓ " else "")+"Cloud Engine",
                {engineName=StudioEngine.CLOUD.name},Modifier.weight(1f),size=11f,
                contentColor=if(engine==StudioEngine.CLOUD)AksaraColors.gold else AksaraColors.text)
            AksaraButton((if(engine==StudioEngine.LOCAL)"✓ " else "")+"Local · SD-Turbo",
                {engineName=StudioEngine.LOCAL.name},Modifier.weight(1f),size=10.5f,
                contentColor=if(engine==StudioEngine.LOCAL)AksaraColors.gold else AksaraColors.text)
        }
        Spacer(Modifier.height(12.dp))
        if(engine==StudioEngine.LOCAL) {
            StudioSectionHeader("SD-Turbo · Local Engine",
                if(!localRuntime.available())"Runtime Local tidak dipakejkan dalam APK ini" else if(models.modelPath()!=null)"Model dipasang · ujian inferens diperlukan" else "SD-Turbo belum dipasang")
            if(!localRuntime.available()) {
                AksaraText("Enjin Local tidak tersedia dalam APK ini. Versi Cloud masih boleh digunakan; untuk Local, gunakan APK Native SD-Turbo.",size=11f,color=AksaraColors.muted)
            } else if(models.modelPath()==null) {
                AksaraText("Model GGUF Q4 · "+String.format(Locale.US,"%.2f",SDTurboSpec.sizeBytes/1e9)+" GB",
                    size=11f,color=AksaraColors.muted)
                Spacer(Modifier.height(5.dp))
                AksaraText("Sumber: samoudi/sd-turbo-gguf · Stability AI Community License. Sila semak syarat lesen sebelum muat turun.",
                    size=10f,color=AksaraColors.muted)
                Spacer(Modifier.height(7.dp))
                Row(horizontalArrangement=Arrangement.spacedBy(6.dp)){
                    AksaraButton("Pasang model",{
                        if(downloadJob?.isActive!=true) downloadJob=scope.launch {
                            downloadState="Sedang memuat turun…"
                            try {models.download {done,_->downloaded=done};downloadState="Model disahkan dan dipasang."}
                            catch(_:CancellationException){downloadState="Muat turun dihentikan. Fail separa boleh disambung."}
                            catch(e:Exception){downloadState=e.message ?: "Muat turun gagal."}
                        }
                    },Modifier.weight(1f),size=10f,height=39.dp,enabled=downloadJob?.isActive!=true)
                    AksaraButton("Import model",{importer.launch(arrayOf("application/octet-stream","*/*"))},
                        Modifier.weight(1f),size=10f,height=39.dp,enabled=downloadJob?.isActive!=true)
                }
                Spacer(Modifier.height(6.dp))
                if(downloadJob?.isActive==true) AksaraButton("Henti muat turun",
                    {downloadJob?.cancel()},Modifier.fillMaxWidth(),size=10.5f,height=37.dp)
                if(downloaded>0) AksaraText("Diterima "+String.format(Locale.US,"%.1f",downloaded/1e6)+
                    " / "+String.format(Locale.US,"%.1f",SDTurboSpec.sizeBytes/1e6)+" MB",
                    size=10.5f,color=AksaraColors.muted)
                if(downloadState.isNotEmpty())AksaraText(downloadState,size=10.5f,color=AksaraColors.muted)
            } else {
                AksaraText("Runtime: "+if(localRuntime.available())"JNI tersedia (belum diuji)" else "JNI tidak dipakejkan",
                    size=10.5f,color=AksaraColors.muted)
                Row(horizontalArrangement=Arrangement.spacedBy(6.dp)){
                    AksaraButton("Sahkan model",{
                        scope.launch{message=if(models.verify()){localVerified=true;"SHA-256 model sah."}
                        else {localVerified=false;"Fail model tidak sah."}}
                    },Modifier.weight(1f),size=10f,height=38.dp)
                    AksaraButton("Buang model",{confirmRemoveModel=true},Modifier.weight(1f),size=10f,height=38.dp)
                }
                if(localVerified)AksaraText("Integriti disahkan. Inference masih memerlukan ujian sebenar.",
                    size=10f,color=AksaraColors.muted)
            }
            AksaraButton("Lihat keperluan peranti",{requirementsVisible=!requirementsVisible},
                Modifier.fillMaxWidth(),size=10.5f,height=36.dp)
            if(requirementsVisible) {
                AksaraText("arm64-v8a · 512×512 · 1 langkah · CPU. "+(models.deviceWarning()?:
                    "Semakan asas perkakasan lulus.")+" Model tidak dimasukkan dalam APK.",
                    size=11f,color=AksaraColors.muted)
            }
            Spacer(Modifier.height(12.dp))
        } else if(showAdvanced) {
            StudioSectionHeader("Model Cloud","Model pilihan untuk penjanaan Cloud")
            Row(horizontalArrangement=Arrangement.spacedBy(5.dp)) {
                listOf("klein" to "Klein","schnell" to "Schnell","ovh" to "OVH Beta").forEach{(id,label)->
                    AksaraButton((if(model==id)"✓ " else "")+label,{
                        model=id;if(id!="klein")ratio="1:1";prefs.edit().putString("model",id).apply()
                    },Modifier.weight(1f),size=10.5f,height=37.dp)
                }
            }
            Spacer(Modifier.height(12.dp))
        }
        StudioSectionHeader("Prompt","Terangkan imej yang kau mahu. Draf tidak terpadam apabila bertukar enjin.")
        StudioInput(prompt,{if(it.length<=StudioRules.MAX_PROMPT)prompt=it},
            "Apa yang kau nak lihat?",124.dp)
        Spacer(Modifier.height(5.dp))
        AksaraText(prompt.length.toString()+" / 1200",Modifier.fillMaxWidth(),size=10f,
            color=AksaraColors.muted)
        Spacer(Modifier.height(7.dp))
        Row(horizontalArrangement=Arrangement.spacedBy(6.dp)) {
            AksaraButton(if(engine==StudioEngine.LOCAL)"Perkemas Offline" else "Perkemas A.I.",{
                if(enhancementJob?.isActive!=true) enhancementJob=scope.launch {
                    try {
                        enhancedDraft=if(engine==StudioEngine.LOCAL) StudioRules.lightEnhance(StudioRules.prompt(prompt))
                            else StudioGateway.enhance(prompt)
                        message=if(engine==StudioEngine.LOCAL)"Draf diperkemas tanpa internet." else "Draf A.I. tersedia. Semak dahulu."
                    }
                    catch(e:Exception){message=if(engine==StudioEngine.LOCAL)(e.message ?: "Prompt tempatan tidak sah.") else "Perkemas A.I. memerlukan sambungan: "+(e.message ?: "tidak tersedia")}
                }
            },Modifier.weight(1f),size=10f,height=38.dp,enabled=enhancementJob?.isActive!=true)
            AksaraButton("Idea Prompt",{showIdeas=true},Modifier.weight(1f),size=10f,height=38.dp)
        }
        if(enhancedDraft!=null) {
            Spacer(Modifier.height(8.dp))
            StudioSectionHeader("Semak draf","Boleh edit sebelum menggantikan prompt.")
            StudioInput(enhancedDraft.orEmpty(),{if(it.length<=1200)enhancedDraft=it},
                "Draf perkemas",118.dp)
            Spacer(Modifier.height(6.dp))
            Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                AksaraButton("Batal",{enhancedDraft=null},Modifier.weight(1f),height=38.dp)
                AksaraButton("Guna draf",{
                    try{prompt=StudioRules.prompt(enhancedDraft.orEmpty());enhancedDraft=null}
                    catch(e:Exception){message=e.message.orEmpty()}
                },Modifier.weight(1f),height=38.dp)
            }
        }
        Spacer(Modifier.height(12.dp))
        AksaraButton(if(showAdvanced)"Sembunyi Tetapan Lanjutan" else "Tetapan Lanjutan",
            {showAdvanced=!showAdvanced},Modifier.fillMaxWidth(),size=10.5f,height=36.dp)
        Spacer(Modifier.height(9.dp))
        if(engine==StudioEngine.CLOUD) {
            StudioSectionHeader("Nisbah",if(model=="klein")"Nisbah natif FLUX.2 Klein" else "Model ini hanya menyokong 1:1")
            Row(horizontalArrangement=Arrangement.spacedBy(4.dp)){
                StudioRules.cloudRatios.sortedBy{listOf("1:1","4:5","9:16","16:9","3:2").indexOf(it)}.forEach {r ->
                    AksaraButton((if(ratio==r)"✓ " else "")+r,{
                        ratio=r;prefs.edit().putString("ratio",r).apply()
                    },Modifier.weight(1f),height=35.dp,size=9.5f,enabled=model=="klein"||r=="1:1")
                }
            }
            Spacer(Modifier.height(10.dp))
            if(showAdvanced) {
            StudioSectionHeader("Kualiti","Tahap penjanaan yang disokong pelayan")
            Row(horizontalArrangement=Arrangement.spacedBy(5.dp)){
                listOf("fast" to "Pantas","balanced" to "Seimbang","detail" to "Terperinci").forEach{(id,label)->
                    AksaraButton((if(quality==id)"✓ " else "")+label,{
                        quality=id;prefs.edit().putString("quality",id).apply()
                    },Modifier.weight(1f),height=36.dp,size=10f)
                }
            }
            Spacer(Modifier.height(10.dp))
            StudioSectionHeader("Gaya","Pilihan visual tanpa preset Cahaya/Gelap utama")
            StudioRules.presets.chunked(3).forEach {row ->
                Row(horizontalArrangement=Arrangement.spacedBy(5.dp)) {
                    row.forEach{(id,label)->AksaraButton((if(style==id)"✓ " else "")+label,
                        {style=id},Modifier.weight(1f),size=9.5f,height=34.dp)}
                    repeat(3-row.size){Spacer(Modifier.weight(1f))}
                }
                Spacer(Modifier.height(5.dp))
            }
            }
        } else {
            StudioSectionHeader("Tetapan Local","512×512 · 1 langkah · CFG natif 1.0 (tanpa guidance)")
        }
        Spacer(Modifier.height(8.dp))
        if(showAdvanced && (engine==StudioEngine.LOCAL || model=="klein")) {
            StudioSectionHeader("Seed","Kosongkan untuk rawak, atau masukkan 0–2147483647")
            StudioInput(seedDraft,{if(it.length<=10 && it.all(Char::isDigit))seedDraft=it},
                "Seed automatik",46.dp)
            Spacer(Modifier.height(6.dp))
            AksaraButton("Rawakkan seed",{seedDraft=newStudioSeed().toString()},
                Modifier.fillMaxWidth(),size=10f,height=34.dp)
        }
        Spacer(Modifier.height(12.dp))
        AksaraButton(if(job?.isActive==true)"Sedang menjana…" else "Jana Imej",
            {generate()},Modifier.fillMaxWidth(),height=47.dp,size=13f,
            enabled=job?.isActive!=true && prompt.trim().length>=4)
        if(job?.isActive==true) {
            Spacer(Modifier.height(6.dp))
            if(runningEngine==StudioEngine.CLOUD)
                AksaraButton("Henti permintaan", {job?.cancel()},Modifier.fillMaxWidth(),height=37.dp,size=11f)
            else AksaraButton("Henti Local", {
                localRuntime.cancel()
                job?.cancel()
                message="Pembatalan SD-Turbo telah diminta kepada native runtime."
            },Modifier.fillMaxWidth(),height=37.dp,size=11f)
        }
        Spacer(Modifier.height(10.dp))
        AksaraText(message,size=11f,color=AksaraColors.muted)
        Spacer(Modifier.height(14.dp))
        StudioSectionHeader("Pratonton","Hasil sebenar, tiada imej contoh yang dianggap berjaya.")
        preview?.let{ item ->
            AksaraGlassSurface(Modifier.fillMaxWidth().height(270.dp),radius=19.dp,blur=5.dp) {
                Image(item.bitmap.asImageBitmap(),"Imej sebenar daripada "+item.model,
                    Modifier.fillMaxSize().padding(4.dp), contentScale=ContentScale.Fit)
            }
            Spacer(Modifier.height(8.dp))
            AksaraText(item.engine.name+" · "+item.model+" · "+item.bitmap.width+"×"+
                item.bitmap.height+" · "+String.format(Locale.US,"%.1f",item.elapsed/1000.0)+" saat"+
                (if(item.seed!=null)" · seed "+item.seed else ""),size=10f,color=AksaraColors.muted)
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                AksaraButton("Simpan",{
                    scope.launch {
                        try{message="Dieksport: "+StudioGateway.save(context,item.bitmap)}
                        catch(e:Exception){message=e.message ?: "Gagal mengeksport."}
                    }
                },Modifier.weight(1f),size=10f,height=37.dp)
                AksaraButton("Lihat penuh",{showViewer=true},Modifier.weight(1f),size=10f,height=37.dp)
                AksaraButton("Salin prompt",{copyPrompt(item.prompt)},Modifier.weight(1f),size=9.5f,height=37.dp)
            }
            Spacer(Modifier.height(6.dp))
            Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){
                AksaraButton("Jana semula",{generate(replay=item)},Modifier.weight(1f),height=37.dp,
                    enabled=job?.isActive!=true)
                AksaraButton("Variasi seed",{generate(variation=true,replay=item)},Modifier.weight(1f),height=37.dp,
                    enabled=job?.isActive!=true && (item.engine==StudioEngine.LOCAL || item.model.contains("Klein",ignoreCase=true)))
            }
        } ?: AksaraGlassSurface(Modifier.fillMaxWidth().height(110.dp),radius=19.dp,blur=5.dp) {
            AksaraText("Hasil imej akan muncul di sini.",Modifier.align(Alignment.Center),
                size=12f,color=AksaraColors.muted)
        }
    } else if(page==StudioPage.GALLERY.name || page==StudioPage.HISTORY.name) {
        val gallery=page==StudioPage.GALLERY.name
        StudioSectionHeader(if(gallery)"Galeri Studio" else "Sejarah penjanaan",
            "Cloud dan Local disimpan bersama. Imej eksport Android tidak terjejas.")
        if(records.isEmpty()) AksaraText("Belum ada imej dalam sejarah Studio.",
            size=12f,color=AksaraColors.muted)
        if(gallery) records.chunked(2).forEach { items ->
            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(9.dp)){
                items.forEach { record ->
                    AksaraGlassSurface(Modifier.weight(1f),radius=15.dp,blur=6.dp) {
                        Column(Modifier.fillMaxWidth().padding(8.dp)) {
                            val thumb by produceState<Bitmap?>(null,record.id) {value=historyStore.thumbnail(record)}
                            if(thumb!=null)Image(thumb!!.asImageBitmap(),"Galeri "+record.model,
                                Modifier.fillMaxWidth().height(114.dp),contentScale=ContentScale.Crop)
                            else Spacer(Modifier.fillMaxWidth().height(114.dp))
                            Spacer(Modifier.height(5.dp))
                            AksaraText(record.engine+" · "+record.model,size=10f,color=AksaraColors.gold)
                            AksaraButton("Buka",{openRecord(record)},Modifier.fillMaxWidth(),height=32.dp,size=10f)
                            Spacer(Modifier.height(4.dp))
                            AksaraButton("Padam",{confirmDelete=record.id},Modifier.fillMaxWidth(),height=31.dp,size=10f)
                        }
                    }
                }
                if(items.size==1)Spacer(Modifier.weight(1f))
            }
            Spacer(Modifier.height(9.dp))
        } else records.forEach{record ->
            AksaraGlassSurface(Modifier.fillMaxWidth(),radius=16.dp,blur=6.dp) {
                Column(Modifier.padding(11.dp)) {
                    AksaraText(record.engine+" · "+record.model+" · "+
                        java.text.SimpleDateFormat("dd/MM/yyyy HH:mm",Locale.getDefault()).format(java.util.Date(record.createdAt)),
                        size=10.5f,color=AksaraColors.gold)
                    AksaraText(record.prompt.take(160),size=11f)
                    AksaraText(record.width.toString()+"×"+record.height+" · "+
                        record.durationMs+" ms",size=10f,color=AksaraColors.muted)
                    Spacer(Modifier.height(5.dp))
                    Row(horizontalArrangement=Arrangement.spacedBy(5.dp)) {
                        AksaraButton("Buka",{openRecord(record)},Modifier.weight(1f),size=10f,height=33.dp)
                        AksaraButton("Guna prompt",{
                            prompt=record.prompt;engineName=record.engine
                            if(record.model in StudioRules.cloudModels)model=record.model
                            seedDraft=record.seed?.toString().orEmpty();style=record.style;ratio=record.ratio;quality=record.quality;page=StudioPage.GENERATE.name
                        },Modifier.weight(1f),size=9f,height=33.dp)
                        AksaraButton("Padam",{confirmDelete=record.id},Modifier.weight(1f),size=10f,height=33.dp)
                    }
                }
            }
            Spacer(Modifier.height(8.dp))
        }
        Spacer(Modifier.height(10.dp))
        Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){
            AksaraButton("Muat semula",{refreshHistory()},Modifier.weight(1f),height=38.dp)
            AksaraButton("Kosongkan sejarah",{confirmClear=true},Modifier.weight(1f),height=38.dp,enabled=records.isNotEmpty())
        }
    } else {
        StudioSectionHeader("Tetapan Studio","Pilihan disimpan dan terpakai dalam satu Studio Native.")
        AksaraText("Cloud: "+model+" · "+quality+" · "+ratio,size=11f,color=AksaraColors.muted)
        Spacer(Modifier.height(6.dp))
        AksaraText("Model Local: "+if(models.modelPath()!=null)"Pakej sah dipasang" else "Belum dipasang",
            size=11f,color=AksaraColors.muted)
        AksaraText("Peranti: "+android.os.Build.SUPPORTED_ABIS.joinToString()+". "+(models.deviceWarning()?:"Semakan asas RAM lulus."),
            size=10.5f,color=AksaraColors.muted)
        AksaraText("Storan tersedia: "+String.format(Locale.US,"%.2f",models.availableBytes()/1e9)+" GB",
            size=10.5f,color=AksaraColors.muted)
        AksaraText("Backend Cloud: Netlify Production. Local: tanpa remote inference.",
            size=10.5f,color=AksaraColors.muted)
        Spacer(Modifier.height(12.dp))
        AksaraButton("Semak status Model Local",{engineName=StudioEngine.LOCAL.name;
            page=StudioPage.GENERATE.name;requirementsVisible=true},
            Modifier.fillMaxWidth(),height=40.dp)
        Spacer(Modifier.height(8.dp))
        AksaraButton("Kosongkan sejarah Studio",{confirmClear=true},Modifier.fillMaxWidth(),height=40.dp,
            enabled=records.isNotEmpty())
        Spacer(Modifier.height(8.dp))
        AksaraText("SD-Turbo eksperimen. Lesen, keserasian, termal dan inferens offline perlu disahkan pada peranti sebenar sebelum dilabel siap.",
            size=10.5f,color=AksaraColors.muted)
    }

    if(showIdeas) StudioIdeas({idea->
        prompt=idea
        showIdeas=false
        page=StudioPage.GENERATE.name
        message="Idea prompt dipilih. Edit sebelum menjana."
    },{showIdeas=false})
    if(confirmDelete!=null)StudioConfirm("Padam imej ini daripada sejarah Studio?",{
        val id=confirmDelete!!
        confirmDelete=null
        scope.launch{historyStore.delete(id);records=historyStore.list();message="Rekod dipadam."}
    },{confirmDelete=null})
    if(confirmClear)StudioConfirm("Kosongkan sejarah Studio? Imej yang dieksport kekal.",{
        confirmClear=false
        scope.launch{historyStore.clear();records=emptyList();message="Sejarah dikosongkan."}
    },{confirmClear=false})
    if(confirmRemoveModel)StudioConfirm("Buang hanya model SD-Turbo dalam storan aplikasi?",{
        confirmRemoveModel=false
        scope.launch{models.remove();localVerified=false;message="Model tempatan dibuang. Sejarah dikekalkan."}
    },{confirmRemoveModel=false})
    if(showViewer)preview?.let{StudioViewer(it.bitmap){showViewer=false}}
    Spacer(Modifier.height(14.dp))
}
