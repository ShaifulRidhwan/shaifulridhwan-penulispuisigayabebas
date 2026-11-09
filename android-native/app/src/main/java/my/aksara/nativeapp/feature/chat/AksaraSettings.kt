package my.aksara.nativeapp.feature.chat

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import my.aksara.nativeapp.core.design.*
import my.aksara.nativeapp.feature.voice.VoiceLanguageStyles

/** P3 + P4 user-facing settings. Controls here are wired to real storage/backend metadata. */
@Composable
internal fun AksaraSettings(
    state:ChatState,
    composerDraft:String,
    onClose:()->Unit,
    onRefresh:()->Unit,
    onMode:(String)->Unit,
    onMemory:(Boolean,String)->Unit,
    onExport:()->Unit,
    onImport:()->Unit,
    onSaveDraft:suspend(String)->Boolean,
    onRemoveDraft:suspend(String)->Boolean,
    onUseDraft:(String)->Unit,
    onErase:suspend()->Boolean,
    onVoice:()->Unit
) {
    val context=LocalContext.current
    val scope=rememberCoroutineScope()
    val preferences=remember(context){context.getSharedPreferences("aksara_voice",android.content.Context.MODE_PRIVATE)}
    var expanded by rememberSaveable { mutableStateOf("Voice & Audio") }
    var confirmErase by remember { mutableStateOf(false) }
    var notice by remember { mutableStateOf("") }
    var notes by remember(state.memoryNotes) { mutableStateOf(state.memoryNotes) }
    var style by rememberSaveable { mutableStateOf(
        preferences.getString("language_style","Bahasa Santai") ?: "Bahasa Santai") }
    var captions by rememberSaveable { mutableStateOf(preferences.getBoolean("captions_visible",true)) }
    var pushToTalk by rememberSaveable { mutableStateOf(preferences.getBoolean("push_to_talk",false)) }
    val tabs=listOf(
        Triple("Kecerdasan & Model","Auto-routing, Thinking, verifikasi dan penggunaan model","brain"),
        Triple("Chat & Lampiran","Konteks, fail, sejarah dan paparan jawapan","chat"),
        Triple("Voice & Audio","Mikrofon, output, bahasa dan pemulihan sesi","voice"),
        Triple("Memori & Privasi","Kawalan data peribadi dan penyimpanan","shield"),
        Triple("Tools & Research","Kebenaran alat dan penggunaan sumber","code"),
        Triple("Sistem & Diagnostik","Kesihatan penyedia, prestasi dan ralat","network")
    )

    Box(Modifier.fillMaxSize().background(Color(0,0,0,175)),contentAlignment=Alignment.Center) {
        AksaraGlassSurface(
            Modifier.fillMaxWidth().fillMaxHeight(.94f).padding(horizontal=10.dp,vertical=5.dp),
            radius=23.dp,blur=18.dp,border=Color(244,217,176,95)
        ) {
            Column(Modifier.fillMaxSize().padding(horizontal=13.dp,vertical=14.dp)) {
                Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically){
                    Column(Modifier.weight(1f)){
                        AksaraText("Tetapan Aksara A.I.",size=17f,weight=700,
                            family=AksaraTypography.heading)
                        AksaraText("Kawalan Android · P3 + P4",size=10f,color=AksaraColors.muted)
                    }
                    AksaraButton("×",onClose,Modifier.width(38.dp),height=36.dp,size=20f)
                }
                Spacer(Modifier.height(10.dp))
                Column(Modifier.weight(1f).verticalScroll(rememberScrollState()),
                    verticalArrangement=Arrangement.spacedBy(9.dp)) {
                    tabs.forEach { (name,description,icon) ->
                        SettingsGroup(name,description,icon,expanded==name,{expanded=if(expanded==name)"" else name}) {
                            when(name) {
                                "Kecerdasan & Model" -> {
                                    SettingsLabel("Mod Thinking")
                                    Row(horizontalArrangement=Arrangement.spacedBy(7.dp)) {
                                        AksaraButton("Cahaya",{onMode("cahaya")},
                                            Modifier.weight(1f),height=35.dp,size=11f,
                                            contentColor=if(state.mode=="cahaya")AksaraColors.gold else AksaraColors.text)
                                        AksaraButton("Gelap",{onMode("gelap")},
                                            Modifier.weight(1f),height=35.dp,size=11f,
                                            contentColor=if(state.mode=="gelap")AksaraColors.gold else AksaraColors.text)
                                    }
                                    Spacer(Modifier.height(10.dp))
                                    SettingsLabel("Model Capability Registry")
                                    AksaraText("Berdasarkan manifest konfigurasi backend, bukan jaminan model berjaya menjawab.",
                                        size=10f,color=AksaraColors.muted)
                                    Spacer(Modifier.height(5.dp))
                                    if(state.capabilities.isEmpty())AksaraText("Belum ada manifest. Tekan Semak semula.",size=10.5f)
                                    state.capabilities.take(18).forEach {
                                        SettingsFact(it.provider+" · "+it.name,
                                            if(it.configured)"Dikonfigurasi" else "Dimatikan")
                                    }
                                    Spacer(Modifier.height(8.dp))
                                    SettingsLabel("Task Planner · pratonton sahaja")
                                    val lastRequest=state.messages.lastOrNull{it.role=="user"}?.text.orEmpty()
                                    val plan=P3Intelligence.previewPlan(lastRequest)
                                    if(plan.isEmpty())AksaraText("Tiada permintaan berbilang langkah untuk dipratonton.",
                                        size=10.5f,color=AksaraColors.muted)
                                    else plan.forEachIndexed { index,step ->
                                        AksaraText((index+1).toString()+". "+step.label,
                                            size=11f,line=16f)
                                    }
                                    AksaraText("Langkah ini tidak dijalankan secara automatik. Planner, alat dan verifikasi sebenar berada pada backend Web.",
                                        size=10f,color=AksaraColors.muted)
                                    Spacer(Modifier.height(8.dp))
                                    SettingsLabel("Pengesahan jawapan terkini")
                                    AksaraText(P3Intelligence.reviewLabel(state.lastReviewApplied,state.lastEvidenceLevel),
                                        size=10.5f,line=15f)
                                    Spacer(Modifier.height(8.dp))
                                    SettingsLabel("Peta kaitan topik · setempat")
                                    val links=P3Intelligence.topicLinks(state.archive+state.messages)
                                    if(links.isEmpty())AksaraText("Tiada kaitan topik eksplisit dikesan.",
                                        size=10f,color=AksaraColors.muted)
                                    links.take(6).forEach { edge ->
                                        SettingsFact(edge.first+" + "+edge.second,
                                            edge.mentions.toString()+" sebutan bersama")
                                    }
                                    AksaraText("Hanya mengira sebutan bersama dalam mesej pengguna. Bukan pengetahuan yang terbukti.",
                                        size=9.5f,color=AksaraColors.muted)
                                }
                                "Chat & Lampiran" -> {
                                    SettingsFact("Sesi tersulit",state.sessionStarts.size.toString())
                                    SettingsFact("Mesej arkib",state.archive.size.toString())
                                    SettingsFact("Status ringkasan konteks",state.summaryStatus)
                                    Spacer(Modifier.height(7.dp))
                                    Row(horizontalArrangement=Arrangement.spacedBy(7.dp)){
                                        AksaraButton("Eksport JSON",onExport,Modifier.weight(1f),
                                            height=36.dp,size=10f,enabled=state.loaded&&!state.busy)
                                        AksaraButton("Import JSON",onImport,Modifier.weight(1f),
                                            height=36.dp,size=10f,enabled=state.loaded&&!state.busy)
                                    }
                                    AksaraText("JSON eksport ialah teks biasa. Lampiran asal dan memori tidak termasuk.",
                                        size=10f,color=AksaraColors.muted)
                                    Spacer(Modifier.height(10.dp))
                                    SettingsLabel("Draf offline · disulitkan")
                                    AksaraText("Draf tidak dihantar automatik selepas internet pulih. Kau perlu semak dan tekan Hantar sendiri.",
                                        size=10f,color=AksaraColors.muted)
                                    Spacer(Modifier.height(5.dp))
                                    AksaraButton("Simpan teks kotak Chat",{
                                        scope.launch {
                                            if(onSaveDraft(composerDraft))notice="Draf disulitkan pada peranti."
                                            else notice="Teks kosong, request aktif, atau simpanan tidak berjaya."
                                        }
                                    },Modifier.fillMaxWidth(),height=36.dp,size=10.5f,
                                        enabled=composerDraft.isNotBlank()&&!state.busy)
                                    state.pendingDrafts.reversed().take(20).forEach { item ->
                                        Spacer(Modifier.height(6.dp))
                                        AksaraGlassSurface(Modifier.fillMaxWidth(),radius=12.dp){
                                            Column(Modifier.fillMaxWidth().padding(10.dp)){
                                                AksaraText(item.text.take(130),size=10.5f,line=16f)
                                                Spacer(Modifier.height(6.dp))
                                                Row(horizontalArrangement=Arrangement.spacedBy(6.dp)){
                                                    AksaraButton("Guna draf",{onUseDraft(item.text)},
                                                        Modifier.weight(1f),height=31.dp,size=9.5f)
                                                    AksaraButton("Padam",{
                                                        scope.launch {
                                                            if(!onRemoveDraft(item.id))notice="Gagal memadam draf."
                                                        }
                                                    },Modifier.weight(1f),height=31.dp,size=9.5f)
                                                }
                                            }
                                        }
                                    }
                                }
                                "Voice & Audio" -> {
                                    SettingsLabel("Peranti komunikasi")
                                    AksaraText("Pilih Bluetooth, USB, wired, speaker atau earpiece daripada senarai sebenar semasa Voice aktif.",
                                        size=10.5f,color=AksaraColors.muted)
                                    Spacer(Modifier.height(5.dp))
                                    AksaraButton("Buka Voice & pilih peranti",onVoice,
                                        Modifier.fillMaxWidth(),height=37.dp,size=10.5f)
                                    Spacer(Modifier.height(9.dp))
                                    SettingsLabel("Gaya bahasa")
                                    listOf("Bahasa Santai","Loghat Utara","Loghat Kelantan",
                                        "Loghat Terengganu","Loghat Sabah","Loghat Sarawak").forEach { item ->
                                        AksaraButton((if(style==item)"✓  " else "")+item,{
                                            style=item
                                            preferences.edit().putString("language_style",item).apply()
                                        },Modifier.fillMaxWidth(),height=32.dp,size=10.5f)
                                        Spacer(Modifier.height(4.dp))
                                    }
                                    Spacer(Modifier.height(7.dp))
                                    AksaraButton(if(captions)"✓ Kapsyen Live: ON" else "Kapsyen Live: OFF",{
                                        captions=!captions
                                        preferences.edit().putBoolean("captions_visible",captions).apply()
                                    },Modifier.fillMaxWidth(),height=35.dp,size=10.5f)
                                    Spacer(Modifier.height(7.dp))
                                    AksaraButton(if(pushToTalk)"✓ Push-to-Talk: ON" else "Hands-free: ON",{
                                        pushToTalk=!pushToTalk
                                        preferences.edit().putBoolean("push_to_talk",pushToTalk).apply()
                                    },Modifier.fillMaxWidth(),height=35.dp,size=10.5f)
                                    AksaraText("Tetapan ini digunakan apabila sesi Voice seterusnya bermula. Auto-reconnect dan pemulihan Bahasa Melayu kekal di enjin Live.",
                                        size=10f,color=AksaraColors.muted)
                                }
                                "Memori & Privasi" -> {
                                    SettingsFact("Memori peribadi",if(state.memoryEnabled)"Aktif" else "OFF")
                                    SettingsFact("Storan sesi","Android Keystore · AES-GCM")
                                    Spacer(Modifier.height(8.dp))
                                    AksaraGlassSurface(Modifier.fillMaxWidth().height(110.dp),radius=13.dp) {
                                        BasicTextField(notes,{notes=it.take(8000)},
                                            Modifier.fillMaxSize().padding(10.dp),
                                            textStyle=AksaraTypography.style(12f,17f),
                                            cursorBrush=SolidColor(AksaraColors.gold))
                                    }
                                    Spacer(Modifier.height(6.dp))
                                    AksaraButton(if(state.memoryEnabled)"Matikan memori" else "Aktifkan memori",{
                                        onMemory(!state.memoryEnabled,notes)
                                    },Modifier.fillMaxWidth(),height=36.dp,size=10.5f)
                                    Spacer(Modifier.height(6.dp))
                                    AksaraButton("Simpan nota",{onMemory(state.memoryEnabled,notes)},
                                        Modifier.fillMaxWidth(),height=34.dp,size=10f)
                                    Spacer(Modifier.height(6.dp))
                                    AksaraButton("Kosongkan nota memori",{
                                        notes="";onMemory(false,"")
                                    },Modifier.fillMaxWidth(),height=34.dp,size=10f)
                                    Spacer(Modifier.height(12.dp))
                                    SettingsLabel("Padam semua data setempat")
                                    AksaraText("Padam sesi, ringkasan, nota dan draf dari storan aplikasi ini. Tidak memadam rekod yang mungkin telah diproses penyedia luar. Eksport dahulu jika mahu salinan.",
                                        size=10f,line=15f,color=AksaraColors.muted)
                                    Spacer(Modifier.height(7.dp))
                                    if(!confirmErase)AksaraButton("Semak sebelum padam",{
                                        confirmErase=true
                                    },Modifier.fillMaxWidth(),height=37.dp,size=10.5f,
                                        enabled=!state.busy&&state.loaded)
                                    else {
                                        AksaraText("Tindakan ini tidak boleh dibuat asal. Sahkan pilihan kau:",
                                            size=11f,color=Color(0xffffb39e))
                                        Spacer(Modifier.height(7.dp))
                                        Row(horizontalArrangement=Arrangement.spacedBy(6.dp)){
                                            AksaraButton("Batal",{confirmErase=false},Modifier.weight(1f),height=38.dp)
                                            AksaraButton("Padam data",{
                                                scope.launch {
                                                    val success=onErase()
                                                    notice=if(success)"Data setempat sudah dipadam." else "Tidak berjaya memadam semua data. Semak ralat."
                                                    confirmErase=false
                                                }
                                            },Modifier.weight(1f),height=38.dp)
                                        }
                                    }
                                }
                                "Tools & Research" -> {
                                    AksaraText("Tool Executor, Research Workflow, Answer Verifier dan pertukaran model dikendalikan backend Netlify. Aplikasi hanya menunjukkan metadata alat yang benar-benar dilaporkan.",
                                        size=10.5f,line=16f,color=AksaraColors.muted)
                                    Spacer(Modifier.height(8.dp))
                                    SettingsFact("Alat pada jawapan terkini",
                                        state.lastToolsUsed.take(7).joinToString().ifBlank{"Tidak dilaporkan"})
                                    SettingsFact("Status kajian",state.lastResearchStatus.ifBlank{"Tidak dilaporkan"})
                                    SettingsFact("Bukti",state.lastEvidenceLevel)
                                    Spacer(Modifier.height(9.dp))
                                    AksaraText("Kebenaran: lampiran hanya dihantar selepas pilihan fail dan tindakan Hantar. Eksport, import dan padam memerlukan tindakan pengguna. Tiada alat Android untuk mengubah fail/sistem secara senyap.",
                                        size=10f,line=15f,color=AksaraColors.muted)
                                    Spacer(Modifier.height(7.dp))
                                    AksaraButton("Semak status alat backend",onRefresh,
                                        Modifier.fillMaxWidth(),height=36.dp,size=10f)
                                }
                                "Sistem & Diagnostik" -> {
                                    val runtime=Runtime.getRuntime()
                                    val appMemory=(runtime.totalMemory()-runtime.freeMemory())/1048576L
                                    val battery=remember{context.getSystemService(BatteryManager::class.java)}
                                    val power=remember{context.getSystemService(PowerManager::class.java)}
                                    SettingsFact("RAM heap digunakan",appMemory.toString()+" MB")
                                    SettingsFact("Bateri",battery.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY).toString()+"%")
                                    SettingsFact("Penjimatan kuasa",if(power.isPowerSaveMode)"Aktif" else "OFF")
                                    SettingsFact("Respons berjaya (sesi aplikasi)",state.completedRequests.toString())
                                    SettingsFact("Ralat request (sesi aplikasi)",state.failedRequests.toString())
                                    SettingsFact("Penyedia disahkan Online",state.providers.count{it.second=="online"}.toString())
                                    state.providers.forEach{ (name,status)->SettingsFact(name,status)}
                                    Spacer(Modifier.height(8.dp))
                                    SettingsLabel("Permission Manager")
                                    val micGranted=context.checkSelfPermission(Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED
                                    val bluetoothGranted=Build.VERSION.SDK_INT<Build.VERSION_CODES.S ||
                                        context.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)==PackageManager.PERMISSION_GRANTED
                                    SettingsFact("Mikrofon",if(micGranted)"Dibenarkan" else "Belum dibenarkan")
                                    SettingsFact("Bluetooth",if(bluetoothGranted)"Dibenarkan / tidak perlu" else "Belum dibenarkan")
                                    AksaraButton("Buka kebenaran Android",{
                                        context.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                                            .setData(Uri.parse("package:"+context.packageName)))
                                    },Modifier.fillMaxWidth(),height=36.dp,size=10.5f)
                                    Spacer(Modifier.height(8.dp))
                                    AksaraText("Log ringkas hanya bilangan dan status, bukan teks prompt. Ujian model sebenar, bateri, haba dan Bluetooth fizikal perlu QA pada peranti.",
                                        size=10f,color=AksaraColors.muted)
                                    AksaraButton("Refresh Provider Health",onRefresh,
                                        Modifier.fillMaxWidth(),height=36.dp,size=10f)
                                }
                            }
                        }
                    }
                    if(notice.isNotBlank()) {
                        AksaraText(notice,size=11f,line=16f,color=AksaraColors.gold)
                    }
                    Spacer(Modifier.height(12.dp))
                }
            }
        }
    }
}

@Composable
private fun SettingsLabel(text:String) =
    AksaraText(text,size=12f,weight=600,color=AksaraColors.gold)

@Composable
private fun SettingsFact(name:String,value:String) {
    Row(Modifier.fillMaxWidth().padding(vertical=3.dp),
        horizontalArrangement=Arrangement.spacedBy(8.dp),
        verticalAlignment=Alignment.Top) {
        AksaraText(name,Modifier.weight(1f),size=10f,line=14f,color=AksaraColors.muted)
        AksaraText(value.take(120),Modifier.weight(1f),size=10f,line=14f)
    }
}

@Composable
private fun SettingsGroup(name:String,description:String,icon:String,open:Boolean,
    toggle:()->Unit,content:@Composable ()->Unit
) {
    AksaraGlassSurface(Modifier.fillMaxWidth(),radius=17.dp,blur=10.dp,
        border=Color(244,217,176,58)) {
        Column(Modifier.fillMaxWidth().padding(11.dp)) {
            Row(Modifier.fillMaxWidth().clickable(onClick=toggle).padding(vertical=5.dp),
                horizontalArrangement=Arrangement.spacedBy(9.dp),verticalAlignment=Alignment.CenterVertically) {
                AksaraIcon(icon,Modifier.size(19.dp),AksaraColors.gold)
                Column(Modifier.weight(1f)) {
                    AksaraText(name,size=13f,weight=650)
                    Spacer(Modifier.height(4.dp))
                    AksaraText(description,size=10f,color=AksaraColors.muted)
                }
                AksaraText(if(open)"⌃" else "⌄",size=19f,color=AksaraColors.gold)
            }
            if(open) {
                Spacer(Modifier.height(10.dp))
                content()
                Spacer(Modifier.height(8.dp))
            }
        }
    }
}
