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
import androidx.compose.ui.text.input.PasswordVisualTransformation
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
import dev.chrisbanes.haze.HazeState

private data class AgentMissionReport(
    val status:String, val engine:String, val provider:String, val model:String,
    val answer:String, val steps:List<String>,val sources:List<String>,val elapsedMs:Long
)

/** Remote model frameworks stay on Netlify. Android ships no JS runtime or model weights. */
private class AgentMissionClient {
    @Volatile private var active:HttpURLConnection?=null
    fun stop(){ active?.disconnect() }
    suspend fun execute(mission:String,mode:String,ownerKey:String):AgentMissionReport=withContext(Dispatchers.IO) {
        val endpoint=BuildConfig.AGENT_API_ORIGIN.trimEnd('/')+"/.netlify/functions/aksara-agentic"
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
            // Owner token is entered at runtime, NEVER bundled or persisted.
            connection.setRequestProperty("Authorization","Bearer "+ownerKey)
            val payload=JSONObject().put("mission",mission).put("mode",mode).put("consent",true)
                .toString().toByteArray(Charsets.UTF_8)
            connection.outputStream.use { it.write(payload) }
            val status=connection.responseCode
            val stream=if(status in 200..299)connection.inputStream else connection.errorStream
            val raw=stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText().take(38000) }
                ?: error("Backend Response: payload kosong.")
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
                json.optString("response","Execution Result tidak tersedia."),
                values("steps"){ row ->
                    (if(row.optBoolean("ok",false))"✓ " else "× ")+
                        row.optString("tool","tool")+" · "+row.optString("reason","completed")
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
    val localBackdrop=remember { HazeState() }
    val client=remember { AgentMissionClient() }
    var mission by rememberSaveable { mutableStateOf("") }
    var mode by rememberSaveable { mutableStateOf("balanced") }
    var consent by rememberSaveable { mutableStateOf(false) }
    // Deliberately NOT rememberSaveable: never place credentials in Android saved state.
    var ownerKey by remember { mutableStateOf("") }
    var pending by remember { mutableStateOf(false) }
    var notice by remember { mutableStateOf("Runtime IDLE · Tiada request aktif.") }
    var outcome by remember { mutableStateOf<AgentMissionReport?>(null) }
    var job by remember { mutableStateOf<Job?>(null) }
    fun halt(){
        client.stop()
        job?.cancel()
        pending=false
        notice="Client Abort dihantar. Server task mungkin aktif sehingga timeout; write access kekal disekat."
    }
    DisposableEffect(Unit) { onDispose { client.stop();job?.cancel() } }
    Dialog(onDismissRequest={halt();onClose()}) {
      CompositionLocalProvider(LocalBackdrop provides localBackdrop) {
        AksaraGlassSurface(Modifier.fillMaxWidth(),radius=22.dp,blur=18.dp) {
            Column(
                Modifier.fillMaxWidth().heightIn(max=610.dp).verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement=Arrangement.spacedBy(11.dp)
            ) {
                AksaraText("AKSARA AGENTIC CORE",size=16f,weight=700,color=AksaraColors.gold)
                AksaraText("Runtime Gateway · Vercel AI SDK / DeepAgents.js",
                    size=10.5f,line=16f,color=AksaraColors.muted)
                AksaraText("Mission Specification",size=11f,weight=650)
                AksaraGlassSurface(Modifier.fillMaxWidth().heightIn(min=95.dp),radius=15.dp) {
                    Box(Modifier.fillMaxWidth().padding(12.dp)) {
                        if(mission.isBlank())AksaraText(
                            "Contoh: Invoke calculate untuk 7*6. Sertakan execution trace dan verified result.",
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
                AksaraText("Execution Profile",size=11f,weight=650)
                Row(horizontalArrangement=Arrangement.spacedBy(6.dp)){
                    AksaraButton(if(mode=="light")"✓ Light" else "Light",
                        {mode="light"},Modifier.weight(1f),size=10f,height=34.dp,radius=12.dp)
                    AksaraButton(if(mode=="balanced")"✓ Balanced" else "Balanced",
                        {mode="balanced"},Modifier.weight(1f),size=10f,height=34.dp,radius=12.dp)
                    AksaraButton(if(mode=="deep")"✓ Deep" else "Deep",
                        {mode="deep"},Modifier.weight(1f),size=10f,height=34.dp,radius=12.dp)
                }
                AksaraText(
                    if(mode=="deep")"DeepAgents.js · max 9 model steps / 14 tool calls."
                    else if(mode=="light")"ToolLoopAgent · max 3 model steps / 4 tool calls."
                    else "ToolLoopAgent · max 6 model steps / 8 tool calls.",
                    size=10f,line=15f,color=AksaraColors.muted)
                AksaraText("Owner Authorization · Bearer Token",size=11f,weight=650)
                AksaraGlassSurface(Modifier.fillMaxWidth().height(48.dp),radius=13.dp) {
                    BasicTextField(
                        value=ownerKey,onValueChange={if(it.length<=256)ownerKey=it},
                        modifier=Modifier.fillMaxWidth().padding(horizontal=12.dp,vertical=13.dp),
                        textStyle=AksaraTypography.style(13f,20f),
                        cursorBrush=SolidColor(AksaraColors.gold),
                        visualTransformation=PasswordVisualTransformation(),
                        singleLine=true,enabled=!pending
                    )
                }
                AksaraText("Ephemeral credential · tidak dibundel dalam APK atau disimpan pada peranti.",
                    size=9.5f,line=15f,color=AksaraColors.muted)
                AksaraText(
                    (if(consent)"☑ " else "☐ ")+
                      "Benarkan model invocation ke free-tier provider yang dikonfigurasi.",
                    Modifier.fillMaxWidth().clickable(enabled=!pending){consent=!consent},
                    size=10.5f,line=17f,color=AksaraColors.gold)
                AksaraText(
                    "Execution Policy: read-only tools · shell/root blocked · private data isolated. " +
                    "Memory disabled · GitHub write prohibited.",
                    size=9.5f,line=16f,color=AksaraColors.muted)
                Row(horizontalArrangement=Arrangement.spacedBy(7.dp)){
                    AksaraButton(if(pending)"Abort" else "Close",
                        {if(pending)halt() else onClose()},
                        Modifier.weight(1f),height=38.dp,size=11f)
                    AksaraButton("Execute",{
                        if(!pending && consent && mission.trim().length>=10 && ownerKey.length>=40){
                            focus.clearFocus()
                            outcome=null
                            pending=true
                            notice="Runtime EXECUTING · Request dihantar ke Netlify Gateway..."
                            job=scope.launch {
                                try {
                                    outcome=client.execute(mission.trim(),mode,ownerKey)
                                    notice="Runtime Status: "+(outcome?.status?:"unknown")
                                }catch(_:CancellationException){
                                    notice="Client request cancelled."
                                }catch(error:Exception){
                                    notice="Runtime Error: "+(error.message?:"Backend unreachable")
                                }finally { pending=false;job=null }
                            }
                        }
                    },Modifier.weight(1f),height=38.dp,size=11f)
                }
                AksaraText(notice,size=11f,line=17f,
                    color=if(notice.startsWith("Runtime Error"))Color(0xffe7a08e) else AksaraColors.gold)
                outcome?.let { report ->
                    AksaraText("Engine: "+report.engine+" · Provider: "+report.provider+" / "+report.model,
                        size=10f,line=16f,color=AksaraColors.muted)
                    AksaraText("Execution Result",size=11f,weight=650)
                    AksaraText(report.answer,size=12f,line=19f)
                    if(report.steps.isNotEmpty()){
                        AksaraText("Verified Tool Invocation Trace",size=11f,weight=650)
                        report.steps.forEach { AksaraText(it,size=10f,line=16f) }
                    }
                    if(report.sources.isNotEmpty()){
                        AksaraText("Source References",size=11f,weight=650)
                        report.sources.forEach { AksaraText(it,size=10f,line=16f,color=AksaraColors.muted) }
                    }
                    AksaraText("Latency: "+report.elapsedMs+" ms · Final Status: "+report.status,
                        size=9.5f,line=15f,color=AksaraColors.muted)
                }
            }
        }
      }
    }
}