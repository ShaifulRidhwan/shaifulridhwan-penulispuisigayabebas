package my.aksara.nativeapp.feature.chat

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import my.aksara.nativeapp.core.design.*

/**
 * Settings V2: a source-grounded reference catalogue, never a hidden switch panel.
 * Source availability is NOT equivalent to runtime health. Keep shared glass tokens.
 */
internal data class AksaraTechModule(
    val id: String, val group: String, val title: String, val subtitle: String,
    val description: String, val flow: List<String>, val sources: List<String>,
    val caveat: String
)
internal object AksaraTechRegistry {
    const val SYSTEM = "System Architecture"
    const val CAPABILITIES = "Capabilities & Integrations"
    const val DIAGNOSTICS = "Diagnostics & Runtime"
    val groups = listOf(
        Triple(SYSTEM, "brain", "Context, reasoning, routing dan recovery"),
        Triple(CAPABILITIES, "network", "Chat, Voice, Studio, Tools dan Memory"),
        Triple(DIAGNOSTICS, "activity", "Android, prestasi dan sambungan backend")
    )
    // Each reference is relative to android-native/app/src/main/java/my/aksara/nativeapp.
    val modules = listOf(
        AksaraTechModule("context", SYSTEM, "Context & Session Pipeline", "Request-local context",
            "Penyediaan konteks menggabungkan sejarah dan maklumat relevan sebelum request.",
            listOf("Input pengguna", "Session & context", "Backend request", "Respons"),
            listOf("feature/chat/ContextPolicy.kt", "feature/chat/SessionTimeline.kt", "feature/chat/ChatViewModel.kt"),
            "Pemilihan topik bukan vector embedding. Tiada memori berterusan tanpa persetujuan."),
        AksaraTechModule("router", SYSTEM, "Multi-AI Orchestration", "Provider routing & provenance",
            "Android menghantar request ke Web Brain dan membaca metadata model serta penyedia yang dilaporkan.",
            listOf("Chat request", "Backend orchestration", "Provider result", "Metadata display"),
            listOf("core/network/ChatApi.kt", "feature/chat/ProviderIdentity.kt"),
            "Status konfigurasi bukan bukti provider online. Polisi fallback sebenar milik backend."),
        AksaraTechModule("thinking", SYSTEM, "Thinking & Verification", "CAHAYA / GELAP, evidence dan review",
            "Pilihan mod serta metadata verifikasi dibaca daripada hasil request, bukan diandaikan.",
            listOf("Thinking mode", "Model & tools", "Evidence metadata", "Paparan jawapan"),
            listOf("feature/chat/AksaraSettings.kt", "feature/chat/P3Intelligence.kt", "core/network/EvidenceIntegrity.kt"),
            "Planner setempat hanyalah pratonton. Semakan jawapan bukan jaminan kebenaran."),
        AksaraTechModule("recovery", SYSTEM, "Reliability & Recovery", "Streaming, cancellation, transport errors",
            "Klien membezakan kegagalan rangkaian, respons dan pembatalan aliran.",
            listOf("Request", "Transport / stream", "Error classification", "User feedback"),
            listOf("core/network/BackendRoutes.kt", "core/network/ChatApi.kt"),
            "Retry tidak boleh menggandakan request yang sudah menjalankan inferens."),
        AksaraTechModule("chat", CAPABILITIES, "Conversational Engine", "NDJSON, Markdown, attachments",
            "Chat Compose memaparkan aliran teks, sumber penyedia, lampiran dan tindakan perbualan.",
            listOf("Input & lampiran", "NDJSON stream", "Message state", "Compose rendering"),
            listOf("feature/chat/AksaraScreen.kt", "feature/chat/AttachmentSendPolicy.kt", "core/network/ChatApi.kt"),
            "Pengguna mesti menekan Hantar sebelum lampiran diproses."),
        AksaraTechModule("voice", CAPABILITIES, "Voice Architecture", "Gemini Live & audio device routing",
            "Sesi Live menggunakan token backend dan laluan audio Android yang tersedia.",
            listOf("Microphone consent", "Live session", "Duplex audio", "Recovery"),
            listOf("feature/voice/VoiceScreen.kt", "feature/voice/VoiceContent.kt", "core/network/BackendRoutes.kt"),
            "Bluetooth, volum dan reconnect memerlukan QA pada peranti fizikal."),
        AksaraTechModule("studio", CAPABILITIES, "Studio Antara", "Cloud image generation",
            "Studio menggunakan endpoint backend untuk jana imej dan penambahbaikan prompt.",
            listOf("Prompt", "Studio backend", "Image provider", "Preview"),
            listOf("feature/studio/", "core/network/BackendRoutes.kt"),
            "Tidak membuktikan SD-Turbo on-device. Kuota dan provider mungkin berubah."),
        AksaraTechModule("research", CAPABILITIES, "Tools & Research", "Tools, URL dan evidence",
            "Maklumat tool dan tahap bukti dipaparkan apabila backend melaporkannya.",
            listOf("Question", "Backend tool policy", "Sources", "Answer metadata"),
            listOf("core/network/ChatApi.kt", "core/network/EvidenceIntegrity.kt"),
            "Metadata tool bukan bukti sumber sahih atau tool semestinya tersedia."),
        AksaraTechModule("memory", CAPABILITIES, "Memory & Privacy", "Consent, encrypted drafts, sessions",
            "Sesi, draf tersulit dan pilihan memori dikawal dalam aplikasi.",
            listOf("User consent", "Local storage", "Restore", "Optional export"),
            listOf("feature/chat/AksaraSettings.kt", "feature/chat/ChatViewModel.kt", "core/storage/"),
            "Eksport JSON ialah teks biasa. Memori tidak patut diaktifkan tanpa persetujuan."),
        AksaraTechModule("compose", DIAGNOSTICS, "Android UI Runtime", "Kotlin, Compose, Haze",
            "Komponen menggunakan token Liquid Glass, typography dan animasi bersama.",
            listOf("Compose state", "Glass tokens", "Haze rendering", "Navigation"),
            listOf("core/design/AksaraDesign.kt", "core/design/AksaraMotion.kt", "feature/chat/AksaraGlassModal.kt"),
            "Prestasi dan visual parity memerlukan ujian fizikal."),
        AksaraTechModule("network", DIAGNOSTICS, "Network & Provider Health", "Netlify and provider snapshots",
            "Konfigurasi laluan backend, status penyedia dan counter request.",
            listOf("API origin", "Transport", "Health snapshot", "User diagnostic"),
            listOf("core/network/BackendRoutes.kt", "feature/chat/ProviderHealthContent.kt"),
            "Status mungkin stale dan tidak menjamin request seterusnya berjaya."),
        AksaraTechModule("metrics", DIAGNOSTICS, "Performance & Diagnostics", "Heap, battery, request counts",
            "Paparan proses Android, status rangkaian dan metrik aplikasi setempat.",
            listOf("Runtime", "Metrics snapshot", "UI report"),
            listOf("feature/chat/AksaraSettings.kt", "feature/tools/NativeToolsContent.kt"),
            "Heap bukan jumlah RAM. Ujian thermal, bateri dan Bluetooth perlu peranti sebenar.")
    )
}

@Composable internal fun AksaraAdvancedSettings(state: ChatState, onBack: () -> Unit, onRefresh: () -> Unit) {
    var group by rememberSaveable { mutableStateOf("") }
    var moduleId by rememberSaveable { mutableStateOf("") }
    val selected = AksaraTechRegistry.modules.firstOrNull { it.id == moduleId }
    BackHandler {
        when {
            selected != null -> moduleId = ""
            group.isNotBlank() -> group = ""
            else -> onBack()
        }
    }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        AksaraButton("‹  " + when {
            selected != null -> selected.group
            group.isNotBlank() -> "Advanced Settings"
            else -> "Settings"
        }, {
            when {
                selected != null -> moduleId = ""
                group.isNotBlank() -> group = ""
                else -> onBack()
            }
        }, Modifier.fillMaxWidth(), height = 35.dp, size = 11f)

        when {
            selected != null -> {
                AksaraText(selected.title, size=16f, weight=700, family=AksaraTypography.heading)
                AksaraText(selected.subtitle, size=10.5f, color=AksaraColors.gold)
                AksaraText(selected.description, size=11f, line=17f)
                AdvancedHeading("Architecture Flow")
                selected.flow.forEachIndexed { i, step ->
                    AksaraGlassSurface(Modifier.fillMaxWidth(), radius=12.dp,
                        border=AksaraModalStyle.border) {
                        AksaraText((i+1).toString()+". "+step,
                            Modifier.padding(horizontal=12.dp,vertical=8.dp),size=11f,weight=600)
                    }
                }
                AdvancedHeading("Implementation References")
                selected.sources.forEach { AksaraText(it,size=10f,line=15f,color=AksaraColors.muted) }
                AdvancedHeading("Verification")
                AksaraText("Source identified · Runtime not guaranteed",
                    size=10.5f,color=AksaraColors.gold)
                AksaraText(selected.caveat,size=10.5f,line=16f,color=AksaraColors.muted)
            }
            group.isNotBlank() -> {
                AksaraText(group,size=16f,weight=700,family=AksaraTypography.heading)
                AksaraText("Klik modul untuk penerangan mendalam, aliran dan rujukan implementasi.",
                    size=10.5f,line=16f,color=AksaraColors.muted)
                AksaraTechRegistry.modules.filter{it.group==group}.forEach { module ->
                    AdvancedCard("brain",module.title,module.subtitle){moduleId=module.id}
                }
                if(group==AksaraTechRegistry.DIAGNOSTICS) {
                    AdvancedHeading("Current Runtime Snapshot")
                    AdvancedFact("Context",state.summaryStatus)
                    AdvancedFact("Completed",state.completedRequests.toString())
                    AdvancedFact("Errors",state.failedRequests.toString())
                    state.providers.forEach { (provider,status) -> AdvancedFact(provider,status) }
                    AksaraText("Snapshot terakhir, bukan pemeriksaan live untuk setiap model.",
                        size=10f,line=15f,color=AksaraColors.muted)
                    AksaraButton("Refresh Provider Health",onRefresh,Modifier.fillMaxWidth(),
                        height=35.dp,size=10.5f)
                }
            }
            else -> {
                AksaraText("Advanced Settings",size=16f,weight=700,
                    family=AksaraTypography.heading)
                AksaraText("Di Sebalik Aksara",size=11f,color=AksaraColors.gold)
                AksaraText("Katalog komponen sebenar, bukan timbunan suis. Kehadiran kod tidak bermakna fungsi sudah diuji live.",
                    size=10.5f,line=16f,color=AksaraColors.muted)
                AksaraTechRegistry.groups.forEach { (name,icon,detail) ->
                    AdvancedCard(icon,name,detail){group=name}
                }
                AksaraText("Tiada API key, prompt rahsia atau data peribadi didedahkan.",
                    size=10f,line=15f,color=AksaraColors.muted)
            }
        }
    }
}

@Composable private fun AdvancedHeading(label:String){
    Spacer(Modifier.height(2.dp))
    AksaraText(label,size=12f,weight=600,color=AksaraColors.gold)
}
@Composable private fun AdvancedFact(label:String,value:String){
    Row(Modifier.fillMaxWidth(), horizontalArrangement=Arrangement.spacedBy(8.dp)){
        AksaraText(label,Modifier.weight(1f),size=10f,color=AksaraColors.muted)
        AksaraText(value.take(100),Modifier.weight(1f),size=10f)
    }
}
@Composable private fun AdvancedCard(icon:String,title:String,description:String,open:()->Unit){
    AksaraGlassSurface(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).clickable(onClick=open),
        radius=14.dp,blur=4.dp,border=AksaraModalStyle.border){
        Row(Modifier.fillMaxWidth().padding(12.dp),verticalAlignment=Alignment.CenterVertically,
            horizontalArrangement=Arrangement.spacedBy(10.dp)){
            AksaraIcon(icon,Modifier.size(20.dp),AksaraColors.gold)
            Column(Modifier.weight(1f)){
                AksaraText(title,size=12.5f,weight=650)
                Spacer(Modifier.height(3.dp))
                AksaraText(description,size=10f,line=15f,color=AksaraColors.muted)
            }
            AksaraText("›",size=19f,color=AksaraColors.gold)
        }
    }
}
