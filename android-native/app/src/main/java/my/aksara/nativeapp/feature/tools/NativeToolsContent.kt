package my.aksara.nativeapp.feature.tools

import android.app.ActivityManager
import android.content.Context
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import my.aksara.engine.runtime.RuntimeClient
import my.aksara.nativeapp.core.design.*
import my.aksara.nativeapp.feature.chat.ChatState
import okhttp3.OkHttpClient
import okhttp3.Request
import java.net.InetAddress
import java.net.URI
import java.util.concurrent.TimeUnit

@Composable private fun NativeInput(value:String,onValue:(String)->Unit,hint:String,max:Int=300) {
    AksaraGlassSurface(Modifier.fillMaxWidth().height(49.dp),radius=13.dp){
        BasicTextField(value,{if(it.length<=max)onValue(it)},Modifier.fillMaxSize().padding(12.dp),
            singleLine=true,textStyle=AksaraTypography.style(12f,18f),cursorBrush=SolidColor(AksaraColors.gold),
            decorationBox={inner->Box{if(value.isBlank())AksaraText(hint,size=12f,color=AksaraColors.muted);inner()}})
    }
}

@Composable fun KnowledgeContent(onAsk:(String)->Unit) {
    val context=LocalContext.current
    val scope=rememberCoroutineScope()
    val runtime=remember{RuntimeClient(context)}
    var tab by rememberSaveable{mutableStateOf("wiki")}
    var topic by rememberSaveable{mutableStateOf("")}
    var result by remember{mutableStateOf("")}
    Spacer(Modifier.height(13.dp))
    AksaraText("Pusat Pengetahuan & Rujukan",size=13f,weight=650)
    AksaraText("Karya asal ada dalam Perpustakaan offline. Rujukan awam dihantar kepada Aksara melalui chat.",size=11f,color=AksaraColors.muted)
    Spacer(Modifier.height(10.dp))
    Row(horizontalArrangement=Arrangement.spacedBy(5.dp)){
        listOf("wiki" to "Wikipedia","url" to "URL","calc" to "Kira").forEach{(id,name)->
            AksaraButton((if(tab==id)"✓ " else "")+name,{tab=id;result=""},Modifier.weight(1f),size=10f,height=38.dp)
        }
    }
    Spacer(Modifier.height(12.dp))
    NativeInput(topic,{topic=it},when(tab){"wiki"->"Contoh: relativiti khas";"url"->"https://example.com/artikel";else->"(12+8)*3"},1600)
    Spacer(Modifier.height(10.dp))
    if(tab=="calc") {
        AksaraButton("Kira dalam sandbox",{
            val expr=topic.trim()
            if(expr.isBlank()||expr.length>85||!expr.matches(Regex("[0-9+*\\-/().\\s]+"))){
                result="Ungkapan hanya boleh mengandungi nombor, +, -, *, / dan kurungan."
            }else scope.launch {
                try{result=runtime.execute("javascript",expr)}
                catch(e:Exception){result=e.message?:"Pengiraan gagal."}
            }
        },Modifier.fillMaxWidth())
    } else {
        AksaraButton("Hantar kepada Aksara A.I.",{
            val q=topic.trim()
            if(tab=="wiki"&&q.length>=2)onAsk("Cari rujukan Wikipedia tentang "+q+". Nyatakan sumber dan batas bukti.")
            else if(tab=="url"){
                val uri=runCatching{URI(q)}.getOrNull()
                if(uri?.scheme=="https"&&uri.host!=null&&uri.userInfo==null&&uri.port in listOf(-1,443)
                    &&!uri.host!!.equals("localhost",true)){
                    onAsk("Baca halaman awam ini: "+q+". Nyatakan dengan jelas sama ada URL berjaya dibaca atau hanya petikan carian.")
                }else result="Masukkan URL HTTPS awam yang sah."
            } else result="Masukkan topik yang ingin dicari."
        },Modifier.fillMaxWidth())
    }
    if(result.isNotBlank()){Spacer(Modifier.height(10.dp));AksaraText(result,size=12f,line=18f)}
}

@Composable fun MetricsContent(state:ChatState,onRefresh:()->Unit) {
    val context=LocalContext.current
    var total by remember{mutableLongStateOf(0)}
    var available by remember{mutableLongStateOf(0)}
    var pss by remember{mutableLongStateOf(0)}
    var sampled by remember{mutableStateOf(false)}
    fun refresh() {
        val manager=context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val mem=ActivityManager.MemoryInfo()
        manager.getMemoryInfo(mem)
        total=mem.totalMem/1048576L
        available=mem.availMem/1048576L
        pss=android.os.Debug.getPss()/1024L
        sampled=true
    }
    LaunchedEffect(Unit){refresh()}
    Spacer(Modifier.height(13.dp))
    AksaraText("Diagnostik Android · Bacaan tempatan",size=13f,weight=650)
    AksaraText("Nilai ini diambil daripada telefon semasa panel dibuka, bukan anggaran CI.",size=11f,color=AksaraColors.muted)
    Spacer(Modifier.height(10.dp))
    listOf(
        "RAM peranti" to if(sampled)total.toString()+" MiB" else "Memuatkan",
        "RAM tersedia" to if(sampled)available.toString()+" MiB" else "Memuatkan",
        "PSS proses Aksara" to if(sampled)pss.toString()+" MiB" else "Memuatkan",
        "Mesej sesi aktif" to state.messages.size.toString(),
        "Mesej arkib tersulit" to state.archive.size.toString(),
        "Status permintaan" to if(state.busy)"Sedang menjawab" else "Tiada permintaan aktif"
    ).forEach{(name,value)->AksaraGlassSurface(Modifier.fillMaxWidth().height(43.dp),radius=12.dp){
        Row(Modifier.fillMaxSize().padding(horizontal=12.dp),verticalAlignment=Alignment.CenterVertically){
            AksaraText(name,Modifier.weight(1f),size=11.5f)
            AksaraText(value,size=11f,color=AksaraColors.gold)
        }
    };Spacer(Modifier.height(7.dp))}
    AksaraText("Penyedia backend",size=12f,weight=600)
    state.providers.forEach{(id,status)->AksaraText(id+" · "+status,size=11f,color=AksaraColors.muted)}
    Spacer(Modifier.height(10.dp))
    AksaraButton("Segarkan metrik dan provider", {refresh();onRefresh()},Modifier.fillMaxWidth())
}

private object HeaderAudit {
    private val client=OkHttpClient.Builder().followRedirects(false).followSslRedirects(false)
        .connectTimeout(10,TimeUnit.SECONDS).readTimeout(12,TimeUnit.SECONDS).build()
    suspend fun inspect(text:String):String=withContext(Dispatchers.IO) {
        val uri=try{URI(text.trim())}catch(_:Exception){throw IllegalArgumentException("URL tidak sah.")}
        require(uri.scheme.equals("https",true)&&uri.host!=null&&uri.userInfo==null&&uri.port in listOf(-1,443)){
            "Audit hanya menerima URL HTTPS awam pada port 443."
        }
        val host=uri.host!!
        require(host.length<=190&&!host.equals("localhost",true)&&!host.endsWith(".local",true)){
            "Host tempatan tidak dibenarkan."
        }
        require(InetAddress.getAllByName(host).all{addr->
            !addr.isAnyLocalAddress&&!addr.isLoopbackAddress&&!addr.isSiteLocalAddress&&!addr.isLinkLocalAddress&&!addr.isMulticastAddress
        }) {"URL mesti menghala ke alamat awam."}
        client.newCall(Request.Builder().url(uri.toString()).head().build()).execute().use{res->
            val headers=listOf("Strict-Transport-Security","Content-Security-Policy","X-Content-Type-Options","Referrer-Policy","X-Frame-Options")
            buildString {
                appendLine("HTTP "+res.code+" · "+host)
                headers.forEach{header->appendLine(header+": "+(res.header(header)?.take(160)?:"Tidak dihantar"))}
                appendLine("Semakan pasif HEAD sahaja. Ketiadaan header bukan bukti eksploit.")
            }
        }
    }
}

@Composable fun SecurityContent(){
    val scope=rememberCoroutineScope()
    var url by rememberSaveable{mutableStateOf("")}
    var report by remember{mutableStateOf("Belum ada ujian.")}
    var checking by remember{mutableStateOf(false)}
    Spacer(Modifier.height(14.dp))
    AksaraText("Security Lab · Audit pasif",size=13f,weight=650)
    AksaraText("Semak header keselamatan HTTPS milik sendiri atau yang kau dibenarkan menguji. Tiada brute force, port scan atau eksploit dihantar.",size=11f,color=AksaraColors.muted)
    Spacer(Modifier.height(10.dp))
    NativeInput(url,{url=it},"https://domain-yang-dibenarkan.example",1200)
    Spacer(Modifier.height(9.dp))
    AksaraButton(if(checking)"Menyemak…" else "Audit header HTTPS",{
        if(!checking){scope.launch{
            checking=true
            try{report=HeaderAudit.inspect(url)}
            catch(e:Exception){report=e.message?:"Audit gagal."}
            finally{checking=false}
        }}
    },Modifier.fillMaxWidth(),enabled=!checking&&url.startsWith("https://"))
    Spacer(Modifier.height(12.dp))
    AksaraGlassSurface(Modifier.fillMaxWidth(),radius=13.dp){
        AksaraText(report,Modifier.fillMaxWidth().padding(12.dp),size=11f,line=18f)
    }
}

@Composable fun RuntimeHealthContent(onNavigate:(String)->Unit){
    val context=LocalContext.current
    val scope=rememberCoroutineScope()
    val runtime=remember{RuntimeClient(context)}
    var checking by remember{mutableStateOf(false)}
    var results by remember{mutableStateOf(mapOf<String,String>())}
    Spacer(Modifier.height(12.dp))
    AksaraText("Semakan runtime native",size=13f,weight=650)
    AksaraText("Hanya hasil proses berasingan yang benar-benar dijalankan boleh dilabel LULUS.",size=10.5f,color=AksaraColors.muted)
    Spacer(Modifier.height(9.dp))
    listOf("javascript" to "JavaScript (Rhino)","sql" to "SQL (SQLite bundled)","shell" to "Android shell (sandbox)").forEach{(id,label)->
        AksaraGlassSurface(Modifier.fillMaxWidth().height(49.dp),radius=12.dp){
            Row(Modifier.fillMaxSize().padding(horizontal=12.dp),verticalAlignment=Alignment.CenterVertically){
                AksaraText(label,Modifier.weight(1f),size=11.5f)
                AksaraText(results[id]?:"Belum diuji",size=10f,color=if(results[id]=="LULUS")Color(0xff96dbb5) else AksaraColors.muted)
            }
        }
        Spacer(Modifier.height(6.dp))
    }
    AksaraButton(if(checking)"Menguji…" else "Uji tiga runtime sebenar",{
        if(!checking)scope.launch{
            checking=true
            val tests=listOf(Triple("javascript","1+1","2"),Triple("sql","SELECT 1+1 AS result","2"),Triple("shell","printf AKSARA","AKSARA"))
            for((lang,code,expected) in tests) {
                try{
                    val value=runtime.execute(lang,code)
                    results=results+(lang to if(value.contains(expected))"LULUS" else "GAGAL")
                }catch(e:Exception){results=results+(lang to "GAGAL")}
            }
            checking=false
        }
    },Modifier.fillMaxWidth(),enabled=!checking)
    Spacer(Modifier.height(10.dp))
    AksaraButton("Buka Code Workspace / Terminal",{onNavigate("terminal")},Modifier.fillMaxWidth())
    Spacer(Modifier.height(13.dp))
    AksaraText("Belum tersedia: Python/Pyodide, TypeScript, C++20, HTML/CSS preview native, Linux userland dan SD-Turbo. Paparan ini tidak menyamar sebagai compiler yang belum dipasang.",size=11f,line=17f,color=AksaraColors.muted)
}

@Composable fun AdvancedEnginesContent(){
    Spacer(Modifier.height(12.dp))
    AksaraText("Enjin lanjutan Android",size=13f,weight=650)
    listOf(
        "Linux userland / Termux-style" to "Belum dipasang. Shell Android sandbox sedia ada boleh digunakan dalam Terminal.",
        "Game Aksara 3D" to "Filament 3D sudah digunakan untuk avatar Voice. Game dengan rig dan input belum disatukan.",
        "SD-Turbo offline" to "Model diffusion belum dibundel atau diuji dengan GPU telefon.",
        "Studio FLUX Cloud" to "Boleh dicapai melalui Studio native."
    ).forEach{(name,description)->
        Spacer(Modifier.height(9.dp))
        AksaraGlassSurface(Modifier.fillMaxWidth(),radius=13.dp){
            Column(Modifier.fillMaxWidth().padding(12.dp)){
                AksaraText(name,size=12f,weight=600)
                Spacer(Modifier.height(4.dp))
                AksaraText(description,size=11f,line=17f,color=AksaraColors.muted)
            }
        }
    }
}
