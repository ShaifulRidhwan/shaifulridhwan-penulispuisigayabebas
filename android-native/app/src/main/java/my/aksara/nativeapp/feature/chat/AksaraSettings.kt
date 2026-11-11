package my.aksara.nativeapp.feature.chat

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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics

/** Every category has a distinct, present icon. Do not duplicate semantic identities. */
internal val SettingsCategoryIcons = mapOf(
    "Kecerdasan & Model" to "brain",
    "Chat & Lampiran" to "chat",
    "Voice & Audio" to "voice",
    "Memori & Privasi" to "shield",
    "Tools & Research" to "research"
)

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
    var expanded by rememberSaveable { mutableStateOf("") }
    var advancedPage by rememberSaveable { mutableStateOf(false) }
    var confirmErase by remember { mutableStateOf(false) }
    var notice by remember { mutableStateOf("") }
    var notes by remember(state.memoryNotes) { mutableStateOf(state.memoryNotes) }
    var style by rememberSaveable { mutableStateOf(
        preferences.getString("language_style","Bahasa Santai") ?: "Bahasa Santai") }
    var captions by rememberSaveable { mutableStateOf(preferences.getBoolean("captions_visible",true)) }
    var pushToTalk by rememberSaveable { mutableStateOf(preferences.getBoolean("push_to_talk",false)) }
    val tabs=listOf(
        Triple("Kecerdasan & Model","Auto-routing, Thinking, verifikasi dan penggunaan model",SettingsCategoryIcons.getValue("Kecerdasan & Model")),
        Triple("Chat & Lampiran","Konteks, fail, sejarah dan paparan jawapan",SettingsCategoryIcons.getValue("Chat & Lampiran")),
        Triple("Voice & Audio","Mikrofon, output, bahasa dan pemulihan sesi",SettingsCategoryIcons.getValue("Voice & Audio")),
        Triple("Memori & Privasi","Kawalan data peribadi dan penyimpanan",SettingsCategoryIcons.getValue("Memori & Privasi")),
        Triple("Tools & Research","Kebenaran alat dan penggunaan sumber",SettingsCategoryIcons.getValue("Tools & Research"))
    )

    AksaraGlassModal(onClose = onClose,
        preferredHeight = if(expanded.isBlank() && !advancedPage) 535.dp else 665.dp) {
        Column(Modifier.fillMaxSize().padding(16.dp)) {
                Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically){
                    Column(Modifier.weight(1f)){
                        AksaraText("Settings",size=16f,weight=700,
                            family=AksaraTypography.heading)
                        AksaraText(if(advancedPage)"Di Sebalik Aksara · Technical Architecture" else "Kawalan aplikasi dan diagnostik",size=10f,color=AksaraColors.muted)
                    }
                    AksaraButton("×",onClose,Modifier.width(44.dp),height=44.dp,size=20f,radius=13.dp)
                }
                Spacer(Modifier.height(10.dp))
                // Keep the main Settings directory fully visible and immovable.
                // Scrolling is reserved for expanded controls and Advanced module detail pages.
                Column(Modifier.weight(1f).then(
                    if(expanded.isNotBlank() || advancedPage) Modifier.verticalScroll(rememberScrollState())
                    else Modifier
                ),
                    verticalArrangement=Arrangement.spacedBy(9.dp)) {
                    if(advancedPage) {
                        AksaraAdvancedSettings(state,onBack={advancedPage=false},onRefresh=onRefresh)
                    } else {
                        SettingsGroup("Advanced Settings",
                            "Di Sebalik Aksara · System Architecture, Capabilities & Runtime",
                            "brain",false,{expanded="";advancedPage=true}) {}
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
                                    if(state.modelRegistry.isEmpty())AksaraText("Model aktif belum dilaporkan.",size=10f,color=AksaraColors.muted)
                                    state.modelRegistry.forEach { info ->
                                        SettingsFact(info.provider+" · "+info.model,info.status)
                                    }
                                    Spacer(Modifier.height(7.dp))
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
                                    VoiceLanguageStyles.forEach { item ->
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
                                    SettingsLabel("Padam data Chat setempat")
                                    AksaraText("Padam sesi Chat, ringkasan, nota memori dan draf tersulit. Data Studio, model offline dan pilihan Voice tidak termasuk. Ini tidak memadam rekod yang telah diproses penyedia luar. Eksport dulu jika mahu salinan.",
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
                            }
                        }
                        }
                    }
                    if(notice.isNotBlank()) {
                        AksaraText(notice,size=11f,line=16f,color=AksaraColors.gold)
                    }
                    if(expanded.isNotBlank() || advancedPage) Spacer(Modifier.height(12.dp))
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
    AksaraGlassSurface(Modifier.fillMaxWidth(),radius=14.dp,blur=4.dp,
        border=AksaraModalStyle.border) {
        Column(Modifier.fillMaxWidth().padding(9.dp)) {
            Row(Modifier.fillMaxWidth().clickable(onClick=toggle).padding(vertical=4.dp),
                horizontalArrangement=Arrangement.spacedBy(9.dp),verticalAlignment=Alignment.CenterVertically) {
                AksaraIcon(icon,Modifier.size(20.dp).semantics { contentDescription = "Ikon " + name },AksaraColors.gold)
                Column(Modifier.weight(1f)) {
                    AksaraText(name,size=13f,weight=650)
                    Spacer(Modifier.height(4.dp))
                    AksaraText(description,size=10.5f,color=AksaraColors.muted)
                }
                AksaraText("›",size=19f,color=AksaraColors.gold)
            }
            if(open) {
                Spacer(Modifier.height(10.dp))
                content()
                Spacer(Modifier.height(8.dp))
            }
        }
    }
}
