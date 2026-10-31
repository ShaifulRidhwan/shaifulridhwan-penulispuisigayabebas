package my.aksara.ai.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.text.DateFormat
import java.util.Date
import java.util.Locale

private val HubWhite = Color(0xFFF1F3FF)
private val HubIce = Color(0xFFAFC8FF)
private val HubMuted = Color(0xFFB6C2DE)
private val HubGlass = Color(0xAA202B48)

@Composable
fun AksaraProviderDialog(vm: AksaraViewModel, onDismiss: () -> Unit) {
    LaunchedEffect(Unit) { vm.refreshProviders() }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Multi A.I. · Sambungan", color = HubWhite, fontSize = 19.sp) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Gemini, Groq, OpenRouter, OrcaRouter. Ready bukan Connected.",
                    fontSize = 12.sp, color = HubMuted)
                if (vm.providerLoading) Text("Sedang menyemak penyedia…", color = HubIce)
                vm.providerError?.let {
                    Text(it, color = Color(0xFFFFCCD5), fontSize = 12.sp)
                }
                vm.providerSnapshot?.let { snapshot ->
                    snapshot.providers.forEach { provider ->
                        Column(
                            modifier = Modifier.fillMaxWidth()
                                .background(HubGlass, RoundedCornerShape(12.dp))
                                .border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(12.dp))
                                .padding(10.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(provider.id.replaceFirstChar { it.uppercase() },
                                    color = HubWhite, fontWeight = FontWeight.SemiBold)
                                val color = when(provider.status) {
                                    "online" -> Color(0xFF98E3C3)
                                    "ready" -> Color(0xFFFFDEA0)
                                    else -> Color(0xFFFFB8C4)
                                }
                                Text(provider.status.uppercase(), color = color, fontSize = 11.sp)
                            }
                            provider.model?.let { Text(it, color = HubMuted, fontSize = 11.sp) }
                            provider.latencyMs?.let {
                                Text("Pemeriksaan: " + it + " ms", color = HubMuted, fontSize = 11.sp)
                            }
                            provider.retryAfterSeconds?.takeIf { it > 0 }?.let {
                                Text("Cuba selepas " + it + "s", color = HubMuted, fontSize = 11.sp)
                            }
                        }
                    }
                    Text("Dikonfigurasi: " + snapshot.configuredCount +
                        " · Pilihan: " + snapshot.preferred.ifBlank { "Automatik" },
                        color = HubMuted, fontSize = 11.sp)
                }
            }
        },
        confirmButton = {
            TextButton(onClick = vm::refreshProviders, enabled = !vm.providerLoading) {
                Text("Semak semula", color = HubIce)
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Tutup") } },
        containerColor = Color(0xFF172037)
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AksaraFeatureHub(
    vm: AksaraViewModel,
    onDismiss: () -> Unit,
    onNavigate: (String) -> Unit,
    onSessions: () -> Unit,
    onProviders: () -> Unit
) {
    val context = LocalContext.current
    var page by remember { mutableStateOf("Ciri") }
    var confirmForget by remember { mutableStateOf(false) }
    var confirmClearMetrics by remember { mutableStateOf(false) }
    var notice by remember { mutableStateOf("") }
    val saveWorkspace = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("text/markdown")
    ) { uri ->
        if (uri != null) runCatching {
            context.contentResolver.openOutputStream(uri)?.use {
                it.write(vm.workspaceContent.toByteArray(Charsets.UTF_8))
            }
            notice = "Draf telah dieksport."
        }.onFailure { notice = "Gagal menyimpan draf." }
    }
    val exportSessions = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/json")
    ) { uri ->
        if (uri != null) runCatching {
            context.contentResolver.openOutputStream(uri)?.use {
                it.write(vm.exportSessions().toByteArray(Charsets.UTF_8))
            }
            notice = "Arkib sesi telah dieksport."
        }.onFailure { notice = "Gagal mengeksport arkib." }
    }
    val importSessions = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri != null) runCatching {
            val bytes = context.contentResolver.openInputStream(uri)?.use {
                val out = java.io.ByteArrayOutputStream()
                val buffer = ByteArray(4096)
                while (true) {
                    val n = it.read(buffer)
                    if (n < 0) break
                    if (out.size() + n > 2_000_000) error("Too large")
                    out.write(buffer, 0, n)
                }
                out.toByteArray()
            } ?: error("No data")
            vm.importSessions(bytes.toString(Charsets.UTF_8))
        }.onFailure { notice = "Import gagal atau fail terlalu besar." }
    }
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = Color(0xFF121A2D)
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
            Text("CIRI & FUNGSI", color = HubWhite, fontSize = 21.sp,
                fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
            Text("AKSARA Native · Bilik Antara", fontSize = 12.sp, color = HubMuted)
            Spacer(Modifier.height(8.dp))
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                listOf("Ciri", "Memori", "Prestasi", "Pengetahuan", "Ruang Kerja").forEach { label ->
                    FilterChip(
                        selected = page == label,
                        onClick = { page = label },
                        label = { Text(label, fontSize = 12.sp) }
                    )
                }
            }
            if (notice.isNotBlank()) Text(notice, color = HubIce, fontSize = 12.sp)
            vm.knowledgeMessage?.let {
                Text(it, color = HubMuted, fontSize = 12.sp)
            }
            LazyColumn(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(13.dp)
            ) {
                when (page) {
                    "Ciri" -> {
                        item {
                            HubSection("Studio · Jana Imej",
                                "Editor prompt native. Jana imej memerlukan API mudah alih yang selamat.") {
                                HubAction("Buka Studio") { onNavigate("Studio") }
                            }
                        }
                        item {
                            HubSection("Voice Chat",
                                "Perbualan suara Android. Gemini Live sebenar belum tersedia.") {
                                HubAction("Buka Voice") { onNavigate("Voice") }
                            }
                        }
                        item {
                            HubSection("Prestasi A.I.",
                                "Rekod kejayaan dan masa respons pada peranti ini sahaja.") {
                                HubAction("Lihat metrik") { page = "Prestasi" }
                            }
                        }
                        item {
                            HubSection("Sesi & Memori",
                                "Sejarah sesi, arkib, nota pilihan dan tetapan privasi.") {
                                HubAction("Urus sesi") { onSessions() }
                                Spacer(Modifier.height(7.dp))
                                HubAction("Tetapan memori") { page = "Memori" }
                            }
                        }
                        item {
                            HubSection("Multi A.I. Connected",
                                "Periksa status empat penyedia melalui backend sebenar.") {
                                HubAction("Semak sambungan") { onProviders() }
                            }
                        }
                    }
                    "Memori" -> {
                        item {
                            HubSection("Memori pilihan",
                                "Nota berasingan daripada sejarah chat. Hanya dihantar jika diaktifkan.") {
                                ToggleRow("Gunakan nota memori", vm.memoryEnabled, vm::changeMemoryEnabled)
                                OutlinedTextField(
                                    value = vm.memoryNote,
                                    onValueChange = vm::updateMemoryNote,
                                    modifier = Modifier.fillMaxWidth(),
                                    minLines = 3, maxLines = 8,
                                    label = { Text("Nota yang kau mahu Aksara ingat") },
                                    supportingText = {
                                        Text(vm.memoryNote.length.toString() + " / 8000",
                                            color = HubMuted)
                                    }
                                )
                                Text("Nota panjang dipilih mengikut perkaitan soalan (maksimum 2,800 aksara).",
                                    color = HubMuted, fontSize = 11.sp)
                                TextButton(onClick = { confirmForget = true }) {
                                    Text("Padam memori pilihan", color = Color(0xFFFFBBC8))
                                }
                            }
                        }
                        item {
                            HubSection("Privasi & penyedia sandaran",
                                "Kebenaran tidak diaktifkan secara automatik.") {
                                ToggleRow("Fallback boleh memproses nota & dokumen",
                                    vm.contextFallback, vm::changeContextFallback)
                                ToggleRow("Fallback boleh memproses imej",
                                    vm.mediaFallback, vm::changeMediaFallback)
                                ToggleRow("Simpan sesi pada peranti",
                                    vm.saveSession, vm::updateSessionSaving)
                                Text("Mematikan simpanan sesi memadam sejarah tersimpan. Nota memori diurus berasingan.",
                                    color = HubMuted, fontSize = 11.sp)
                            }
                        }
                        item {
                            HubSection("Context Manager 2.0",
                                "Ringkaskan perbualan lama tanpa memadam sejarah asal.") {
                                HubAction(if (vm.summarizing) "Sedang meringkaskan…" else "Ringkaskan sesi ini") {
                                    vm.summarizeCurrent()
                                }
                            }
                        }
                        item {
                            HubSection("Sandaran sesi",
                                "Eksport atau import JSON tanpa cloud sync.") {
                                HubAction("Eksport semua sesi") {
                                    exportSessions.launch("aksara-sesi.json")
                                }
                                Spacer(Modifier.height(8.dp))
                                HubAction("Import sesi JSON") {
                                    importSessions.launch(arrayOf("application/json", "text/plain"))
                                }
                            }
                        }
                    }
                    "Prestasi" -> {
                        item {
                            val events = vm.usage.toList()
                            val completed = events.count { it.successful }
                            val failed = events.count { !it.successful }
                            val avg = events.filter { it.successful }.map { it.durationMs }
                                .average().takeUnless { it.isNaN() } ?: 0.0
                            HubSection("Prestasi A.I. · Peranti ini",
                                "Bukan statistik semua pengguna; kelajuan bukan ukuran ketepatan.") {
                                Text("Panggilan: " + events.size + " · Berjaya: " + completed +
                                    " · Gagal: " + failed, color = HubWhite)
                                Text("Purata respons: " +
                                    "%.1f".format(Locale.US, avg / 1000) + " saat", color = HubIce)
                                Text("Terhad kepada 120 peristiwa terakhir tanpa menyimpan soalan.",
                                    color = HubMuted, fontSize = 11.sp)
                            }
                        }
                        item {
                            HubSection("Pecahan model",
                                "Model yang akhirnya menjawab, bukan setiap cubaan routing.") {
                                val groups = vm.usage.filter { it.successful }.groupBy { it.provider }
                                if (groups.isEmpty()) Text("Belum ada rekod.", color = HubMuted)
                                groups.forEach { (provider, rows) ->
                                    val avg = rows.map { it.durationMs }.average() / 1000
                                    Text(provider + " · " + rows.size + " jawapan · " +
                                        "%.1f".format(Locale.US, avg) + "s",
                                        color = HubWhite, fontSize = 13.sp)
                                }
                            }
                        }
                        item {
                            HubSection("Aktiviti terkini",
                                "Hanya status, masa dan penyedia.") {
                                val dateFormat = DateFormat.getDateTimeInstance(
                                    DateFormat.SHORT, DateFormat.SHORT,
                                    Locale.forLanguageTag("ms-MY")
                                )
                                vm.usage.takeLast(8).reversed().forEach { event ->
                                    Text(
                                        dateFormat.format(Date(event.at)) + " · " +
                                            event.provider + " · " +
                                            if (event.successful) "OK" else "Gagal",
                                        color = HubMuted, fontSize = 12.sp
                                    )
                                }
                                TextButton(onClick = { confirmClearMetrics = true }) {
                                    Text("Padam statistik", color = Color(0xFFFFBBC8))
                                }
                            }
                        }
                    }
                    "Pengetahuan" -> {
                        item {
                            HubSection("Pengetahuan & Rujukan",
                                "Karya, Wikipedia dan pengiraan melalui AKSARA Core. Bukan carian web umum.") {
                                listOf(
                                    "Cari karya Aksara tentang aporia dan pengetahuan.",
                                    "Cari rujukan Wikipedia tentang falsafah dan terangkan dengan sumber yang diperoleh.",
                                    "Kira (12+8)*3"
                                ).forEach { question ->
                                    TextButton(
                                        onClick = {
                                            if (vm.send(question)) onNavigate("Chat")
                                        },
                                        enabled = !vm.busy
                                    ) {
                                        Text(question, color = HubIce, textAlign = TextAlign.Start)
                                    }
                                }
                            }
                        }
                    }
                    else -> {
                        item {
                            HubSection("Ruang Kerja",
                                "Draf tempatan, berasingan daripada chat dan tidak dihantar kepada AI secara automatik.") {
                                OutlinedTextField(
                                    value = vm.workspaceTitle,
                                    onValueChange = { vm.updateWorkspace(it, vm.workspaceContent) },
                                    label = { Text("Tajuk draf") },
                                    modifier = Modifier.fillMaxWidth()
                                )
                                OutlinedTextField(
                                    value = vm.workspaceContent,
                                    onValueChange = { vm.updateWorkspace(vm.workspaceTitle, it) },
                                    minLines = 6, maxLines = 12,
                                    label = { Text("Teks draf") },
                                    modifier = Modifier.fillMaxWidth()
                                )
                                HubAction("Ambil jawapan terakhir") { vm.copyLastAnswerToWorkspace() }
                                Spacer(Modifier.height(6.dp))
                                HubAction("Salin draf") {
                                    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE)
                                        as ClipboardManager
                                    clipboard.setPrimaryClip(
                                        ClipData.newPlainText("AKSARA workspace", vm.workspaceContent)
                                    )
                                    notice = "Draf disalin."
                                }
                                Spacer(Modifier.height(6.dp))
                                HubAction("Eksport Markdown") {
                                    saveWorkspace.launch("aksara-ruang-kerja.md")
                                }
                            }
                        }
                    }
                }
                item { Spacer(Modifier.height(25.dp)) }
            }
        }
    }
    if (confirmForget) {
        AlertDialog(
            onDismissRequest = { confirmForget = false },
            title = { Text("Padam nota memori?") },
            text = { Text("Nota yang disimpan pada peranti akan dipadam.") },
            confirmButton = {
                TextButton(onClick = { vm.forgetMemory(); confirmForget = false }) {
                    Text("Padam")
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmForget = false }) { Text("Batal") }
            }
        )
    }
    if (confirmClearMetrics) {
        AlertDialog(
            onDismissRequest = { confirmClearMetrics = false },
            title = { Text("Padam statistik?") },
            text = { Text("Semua metrik tempatan akan dibuang.") },
            confirmButton = {
                TextButton(onClick = { vm.clearMetrics(); confirmClearMetrics = false }) {
                    Text("Padam")
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmClearMetrics = false }) { Text("Batal") }
            }
        )
    }
}

@Composable
private fun HubSection(title: String, detail: String, children: @Composable () -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth()
            .background(HubGlass, RoundedCornerShape(18.dp))
            .border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(18.dp))
            .padding(15.dp),
        verticalArrangement = Arrangement.spacedBy(9.dp)
    ) {
        Text(title, color = HubWhite, fontWeight = FontWeight.Bold, fontSize = 15.sp)
        Text(detail, color = HubMuted, fontSize = 12.sp)
        children()
    }
}

@Composable
private fun HubAction(label: String, onClick: () -> Unit) {
    OutlinedButton(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Text(label, color = HubIce)
    }
}

@Composable
private fun ToggleRow(label: String, value: Boolean, onChange: (Boolean) -> Unit) {
    Row(modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = HubWhite, modifier = Modifier.weight(1f), fontSize = 12.sp)
        Switch(checked = value, onCheckedChange = onChange)
    }
}
