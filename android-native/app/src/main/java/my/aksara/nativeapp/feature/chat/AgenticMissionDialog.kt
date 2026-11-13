package my.aksara.nativeapp.feature.chat

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import my.aksara.nativeapp.BuildConfig
import my.aksara.nativeapp.core.design.*
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

private data class AgentMissionReport(
    val status:String, val engine:String, val provider:String, val model:String,
    val answer:String, val steps:List<String>,val sources:List<String>,val elapsedMs:Long
)

/** Remote model frameworks stay on Netlify. Android ships no JS runtime or model weights. */
private class AgentMissionClient {
    @Volatile private var active:HttpURLConnection?=null
    fun stop(){ active?.disconnect() }
    suspend fun execute(mission:String,mode:String):AgentMissionReport=withContext(Dispatchers.IO) {
        val endpoint=BuildConfig.API_ORIGIN.trimEnd('/')+"/.netlify/functions/aksara-agentic"
        val connection=(URL(endpoint).openConnection() as HttpURLConnection)
        active=connection
        try {
            connection.requestMethod="POST"
            connection.connectTimeout=12000
            connection.readTimeout=57000
            connection.doOutput=true
            connection.setRequestProperty("Content-Type","application/json; charset=utf-8")
            connection.setRequestProperty("Accept","application/json")
            connection.setRequestProperty("X-Aksara-Client","android-native")
            val payload=JSONObject().put("mission",mission).put("mode",mode).put("consent",true)
                .toString().toByteArray(Charsets.UTF_8)
            connection.outputStream.use { it.write(payload) }
            val status=connection.responseCode
            val stream=if(status in 200..299)connection.inputStream else connection.errorStream
            val raw=stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText().take(38000) }
                ?: error("Tiada respons daripada backend.")
            val json=JSONObject(raw)
            if(status !in 200..299)error(json.optString("error","Backend HTTP $status"))
            fun values(key:String,formatter:(JSONObject)->String):List<String> {
                val rows=json.optJSONArray(key)?:return emptyList()
                return (0 until rows.length()).mapNotNull { n ->
                    rows.optJSONObject(n)?.let(formatter)?.takeIf { it.isNotBlank() }
                }
            }
            AgentMissionReport(
                json.optString("status","unknown"),
                json.optString("engine","unknown"),
                json.optString("provider","unknown"),
                json.optString("model","unknown"),
                json.optString("response","Tiada jawapan."),
                values("steps"){ row ->
                    (if(row.optBoolean("ok",false))"✓ " else "× ")+
                        row.optString("tool","tool")+" · "+row.optString("reason","selesai")
                },
                values("sources"){ row ->
                    row.optString("title","Sumber")+" · "+row.optString("url","")
                },
                json.optLong("elapsedMs",0L)
            )
        } finally {
            connection.disconnect()
            active=null
        }
    }
}

@Composable
internal fun AgenticMissionDialog(onClose:()->Unit){
    val scope=rememberCoroutineScope()
    val focus=LocalFocusManager.current
    val client=remember { AgentMissionClient() }
    var mission by rememberSaveable { mutableStateOf("") }
    var mode by rememberSaveable { mutableStateOf("balanced") }
    var consent by rememberSaveable { mutableStateOf(false) }
    var pending by remember { mutableStateOf(false) }
    var notice by remember { mutableStateOf("Tiada misi berjalan.") }
    var outcome by remember { mutableStateOf<AgentMissionReport?>(null) }
    var job by remember { mutableStateOf<Job?>(null) }
    fun halt(){
        client.stop()
        job?.cancel()
        pending=false
        notice="Misi dihentikan. Tiada tindakan tulis dilaksanakan."
    }
    DisposableEffect(Unit) { onDispose { client.stop();job?.cancel() } }
    Dialog(onDismissRequest={halt();onClose()}) {
        AksaraGlassSurface(Modifier.fillMaxWidth(),radius=22.dp,blur=18.dp) {
            Column(
                Modifier.fillMaxWidth().heightIn(max=610.dp).verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement=Arrangement.spacedBy(11.dp)
            ) {
                AksaraText("AKSARA AGENTIC CORE",size=16f,weight=700,color=AksaraColors.gold)
                AksaraText("Misi Android · Vercel AI SDK + DeepAgents.js",
                    size=10.5f,line=16f,color=AksaraColors.muted)
                AksaraText("Arahan misi",size=11f,weight=650)
                AksaraGlassSurface(Modifier.fillMaxWidth().heightIn(min=95.dp),radius=15.dp) {
                    Box(Modifier.fillMaxWidth().padding(12.dp)) {
                        if(mission.isBlank())AksaraText(
                            "Contoh: Semak framework AI percuma dan jelaskan pilihan terbaik beserta sumber.",
                            size=12f,line=18f,color=AksaraColors.muted)
                        BasicTextField(
                            value=mission,onValueChange={if(it.length<=3000)mission=it},
                            modifier=Modifier.fillMaxWidth().heightIn(min=72.dp),
                            textStyle=AksaraTypography.style(13f,21f),
                            cursorBrush=SolidColor(AksaraColors.gold),
                            enabled=!pending
                        )
                    }
                }
                AksaraText("Tahap pelaksanaan",size=11f,weight=650)
                Row(horizontalArrangement=Arrangement.spacedBy(6.dp)){
                    AksaraButton(if(mode=="light")"✓ Light" else "Light",
                        {mode="light"},Modifier.weight(1f),size=10f,height=34.dp,radius=12.dp)
                    AksaraButton(if(mode=="balanced")"✓ Balanced" else "Balanced",
                        {mode="balanced"},Modifier.weight(1f),size=10f,height=34.dp,radius=12.dp)
                    AksaraButton(if(mode=="deep")"✓ Deep" else "Deep",
                        {mode="deep"},Modifier.weight(1f),size=10f,height=34.dp,radius=12.dp)
                }
                AksaraText(
                    if(mode=="deep")"Deep: perancangan dan sub-agent dengan had ketat."
                    else if(mode=="light")"Light: carian ringkas dan jawapan pantas."
                    else "Balanced: agent loop untuk misi berbilang langkah.",
                    size=10f,line=15f,color=AksaraColors.muted)
                AksaraText(
                    (if(consent)"☑ " else "☐ ")+
                      "Aku benarkan misi ini dihantar ke provider AI percuma yang tersedia.",
                    Modifier.fillMaxWidth().clickable(enabled=!pending){consent=!consent},
                    size=10.5f,line=17f,color=AksaraColors.gold)
                AksaraText(
                    "Read-only: tiada akses shell, root, fail peribadi, Novel/Perpustakaan atau GitHub write. " +
                    "Tiada memori pengguna disimpan oleh endpoint.",
                    size=9.5f,line=16f,color=AksaraColors.muted)
                Row(horizontalArrangement=Arrangement.spacedBy(7.dp)){
                    AksaraButton(if(pending)"Henti" else "Tutup",
                        {if(pending)halt() else onClose()},
                        Modifier.weight(1f),height=38.dp,size=11f)
                    AksaraButton("Laksana",{
                        if(!pending && consent && mission.trim().length>=10){
                            focus.clearFocus()
                            outcome=null
                            pending=true
                            notice="Agent menjalankan misi. Tunggu keputusan sebenar..."
                            job=scope.launch {
                                try {
                                    outcome=client.execute(mission.trim(),mode)
                                    notice="Misi tamat: "+(outcome?.status?:"unknown")
                                }catch(_:CancellationException){
                                    notice="Misi dibatalkan."
                                }catch(error:Exception){
                                    notice="Gagal: "+(error.message?:"Backend unreachable")
                                }finally { pending=false;job=null }
                            }
                        }
                    },Modifier.weight(1f),height=38.dp,size=11f)
                }
                AksaraText(notice,size=11f,line=17f,
                    color=if(notice.startsWith("Gagal"))Color(0xffe7a08e) else AksaraColors.gold)
                outcome?.let { report ->
                    AksaraText(report.engine+" · "+report.provider+" / "+report.model,
                        size=10f,line=16f,color=AksaraColors.muted)
                    AksaraText(report.answer,size=12f,line=19f)
                    if(report.steps.isNotEmpty()){
                        AksaraText("Jejak tindakan yang benar-benar dilaksanakan",size=11f,weight=650)
                        report.steps.forEach { AksaraText(it,size=10f,line=16f) }
                    }
                    if(report.sources.isNotEmpty()){
                        AksaraText("Sumber",size=11f,weight=650)
                        report.sources.forEach { AksaraText(it,size=10f,line=16f,color=AksaraColors.muted) }
                    }
                    AksaraText("Masa: "+report.elapsedMs+" ms. Status: "+report.status,
                        size=9.5f,line=15f,color=AksaraColors.muted)
                }
            }
        }
    }
}