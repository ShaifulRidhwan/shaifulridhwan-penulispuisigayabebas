package my.aksara.nativeapp.core.neural

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.interaction.collectIsDraggedAsState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.hazeSource
import my.aksara.nativeapp.core.design.*
import my.aksara.nativeapp.feature.chat.AksaraGlassModal
import my.aksara.nativeapp.feature.chat.ChatWallpaper
import java.util.Locale
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

private fun bytes(value: Long) = String.format(Locale.ROOT, "%.2f GiB", value / 1073741824.0)
private val moduleNames = listOf("Neural Core", "Device Intelligence", "Live Inference", "Model Library", "Neural Laboratory", "Knowledge & Reasoning")
private val moduleIcons = listOf("brain", "activity", "chat", "book", "research", "network")

@Composable
fun AksaraNeuralDashboard(onBack: () -> Unit, onDialogVisibilityChange: (Boolean) -> Unit, vm: NeuralViewModel = viewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()
    var module by remember { mutableStateOf<Int?>(null) }
    var importModel by remember { mutableStateOf<NeuralModelDescriptor?>(null) }
    var deleting by remember { mutableStateOf<NeuralModelDescriptor?>(null) }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        val descriptor = importModel
        if (uri != null && descriptor != null) vm.transfer(descriptor, uri)
        importModel = null
    }
    LaunchedEffect(module) {
        onDialogVisibilityChange(module != null)
        // Refresh transient memory eligibility while the relevant details are visible.
        while (isActive && (module == 1 || module == 3)) { vm.refresh(); delay(5000) }
    }
    DisposableEffect(Unit) { onDispose { onDialogVisibilityChange(false) } }
    val owner = LocalLifecycleOwner.current
    DisposableEffect(owner, vm) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_STOP) vm.background()
            if (event == Lifecycle.Event.ON_RESUME) vm.refresh()
        }
        owner.lifecycle.addObserver(observer)
        onDispose { owner.lifecycle.removeObserver(observer) }
    }
    BackHandler(module != null) { if (deleting != null) deleting = null else module = null }
    val backdrop = remember { HazeState() }
    val margins = aksaraDeviceMargins()
    CompositionLocalProvider(LocalBackdrop provides backdrop) {
        Box(Modifier.fillMaxSize()) {
            ChatWallpaper(Modifier.fillMaxSize().hazeSource(backdrop))
            Column(Modifier.fillMaxSize().safeDrawingPadding().padding(horizontal = margins.horizontal)
                .padding(top = margins.top, bottom = margins.bottom), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    AksaraIcon("brain", Modifier.size(26.dp))
                    Column(Modifier.weight(1f)) {
                        AksaraText("AKSARA NEURAL", size = 20f, weight = 650, family = AksaraTypography.heading)
                        AksaraText("llama.cpp · ARM64 · JNI", size = 11f, color = AksaraColors.gold)
                    }
                    AksaraButton("Menu Utama", onBack, icon = "chat")
                }
                // Compact command deck: content-sized tiles, not six full-height placeholders.
                // The remaining wallpaper is intentional breathing room, not stretched cards.
                BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
                    val columns = if (maxWidth > maxHeight) 3 else 2
                    val rows = moduleNames.indices.chunked(columns)
                    val compact = maxHeight < 440.dp
                    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        AksaraGlassSurface(Modifier.fillMaxWidth(), radius = 18.dp, blur = 8.dp) {
                            Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 14.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                                // Prominent brain emblem, using the existing gold icon and shared glass tokens.
                                AksaraIcon("brain", Modifier.size(56.dp))
                                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    AksaraText("Model Aktif", size = 11f, color = AksaraColors.gold)
                                    AksaraText(state.loadedId ?: "Aksara Local", size = 17f, weight = 650,
                                        family = AksaraTypography.heading)
                                    AksaraText(when {
                                        state.busy != null -> state.busy!!
                                        state.canInfer -> "Sedia · inferens offline"
                                        state.runtimeAvailable -> "Enjin sedia · pilih model"
                                        else -> "Runtime tidak tersedia"
                                    }, size = 11f, color = AksaraColors.muted)
                                    AksaraText("RAM ${state.device?.let { bytes(it.availableRamBytes) } ?: "…"} · ${state.contextSize} token",
                                        size = 10f, color = AksaraColors.muted)
                                }
                            }
                        }
                        rows.forEach { row ->
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                row.forEach { index ->
                                    AksaraGlassSurface(Modifier.weight(1f)
                                        .height(if (compact) 84.dp else 94.dp)
                                        .testTag("neural-module-$index")
                                        .aksaraBouncyClick { vm.refresh(); module = index },
                                        radius = 20.dp, blur = 8.dp) {
                                        Row(Modifier.fillMaxSize().padding(horizontal = 11.dp, vertical = 10.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                                            AksaraIcon(moduleIcons[index], Modifier.size(24.dp))
                                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                                                AksaraText(moduleNames[index], size = 12f, line = 16f,
                                                    weight = 600, family = AksaraTypography.heading)
                                                AksaraText(when (index) {
                                                    0 -> if (state.loadedId != null) "Model aktif" else "llama.cpp sedia"
                                                    1 -> state.device?.let { "${bytes(it.availableRamBytes)} tersedia" } ?: "Mengukur…"
                                                    2 -> "${state.turns.count { it.role == "assistant" }} jawapan"
                                                    3 -> "${state.installed.size}/3 dipasang"
                                                    4 -> "${state.measurements.size} ukuran"
                                                    else -> "Memori OFF"
                                                }, size = 10f, line = 14f, color = AksaraColors.muted)
                                            }
                                            AksaraIcon("chevron-right", Modifier.size(15.dp))
                                        }
                                    }
                                }
                            }
                        }
                        AksaraText("Tiada muat turun automatik · tiada inferens awan",
                            size = 10f, color = AksaraColors.muted)
                    }
                }
            }
            module?.let { selected ->
                AksaraGlassModal(onClose = { deleting = null; module = null }, preferredHeight = 740.dp) {
                    Column(Modifier.fillMaxSize().imePadding().padding(15.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            AksaraText(moduleNames[selected], Modifier.weight(1f), size = 18f, weight = 600, family = AksaraTypography.heading)
                            AksaraButton("", { deleting = null; module = null }, icon = "close", modifier = Modifier.width(44.dp))
                        }
                        state.busy?.let { label ->
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                AksaraText(label, Modifier.weight(1f), size = 12f, color = AksaraColors.gold)
                                AksaraButton("Henti", vm::stop)
                            }
                        }
                        state.message?.let { AksaraText(it, size = 12f, color = AksaraColors.gold) }
                        if (selected == 2) NeuralChat(state, vm, Modifier.weight(1f))
                        else Column(Modifier.weight(1f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            when (selected) {
                                0 -> {
                                    Note("Enjin", "llama.cpp b12248 · CPU ARM64\n3837bf0bc02ea5d08f8ee3585fc8c7784a81bce8\nRuntime: ${if (state.runtimeAvailable) "tersedia" else "tidak tersedia"}")
                                    Note("Model aktif", state.loadedId ?: "Tiada. Buka Model Library untuk memasang dan mengaktifkan GGUF.")
                                    Note("Konteks", "${state.contextSize} token. Sejarah sesi terhad kepada empat giliran; lebihan konteks ditolak dengan mesej jelas.")
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        listOf(1024, 2048).forEach { size -> AksaraButton("$size", { vm.contextSize(size) }, enabled = state.loadedId == null && state.busy == null) }
                                    }
                                    AksaraButton("Nyahmuat model", vm::unload, enabled = state.canInfer)
                                    AksaraButton("Model Library", { module = 3 })
                                    Note("Privasi", "Inferens Aksara Local hanya melalui JNI pada peranti. Tiada fallback awan. Memori jangka panjang OFF; chat tempatan disimpan dalam RAM sesi sahaja.")
                                }
                                1 -> {
                                    state.device?.let { d ->
                                        Note("Peranti", "RAM fizikal (Android) ${bytes(d.totalRamBytes)}\nRAM tersedia ${bytes(d.availableRamBytes)}\nAmbang tekanan Android ${bytes(d.lowMemoryThresholdBytes)}\nHeap Java ${bytes(d.javaHeapUsedBytes)} / ${bytes(d.javaHeapMaxBytes)}\nHeap native ${bytes(d.nativeHeapAllocatedBytes)}\nPSS proses ${bytes(d.processPssBytes)}\nRAM maya/extended tidak dikira\nStoran tersedia ${bytes(d.availableStorageBytes)}\nABI ${d.supportedAbis.joinToString()}\nAndroid API ${d.sdkInt}\nTerma ${d.thermalStatus} (0 biasa, 3 serius)\nMemori rendah: ${d.lowMemory}\nRuntime: ${state.runtimeAvailable}")
                                        NeuralModelCatalog.entries.forEach { entry -> entry.model?.let { model ->
                                            val assessment = NeuralMemoryPolicy.assess(d, model, state.contextSize)
                                            Note(entry.tier.label, "Anggaran native ${bytes(assessment.estimatedNativeBytes)} + rizab Android ${bytes(assessment.reserveBytes)}\n" +
                                                (assessment.hardFailure ?: assessment.warning ?: "Layak mencuba; kejayaan native masih perlu disahkan") + "\nKonteks pemuatan: ${assessment.contextSize} token")
                                        } }
                                    }
                                    AksaraButton("Ukur semula", vm::refresh)
                                }
                                3 -> {
                                    AksaraText("Import hanya fail GGUF yang sepadan dengan model katalog. Retry bermula dari awal; fail separa dibuang selepas gangguan.", size = 12f)
                                    NeuralModelCatalog.entries.forEach { entry -> entry.model?.let { model ->
                                        ModelEntry(entry, model, state, onDownload = { vm.transfer(model) }, onImport = {
                                            importModel = model; picker.launch(arrayOf("*/*"))
                                        }, onActivate = { vm.activate(model) }, onDelete = { deleting = model }, onRefresh = vm::refresh)
                                    } }
                                }
                                4 -> {
                                    Note("Diagnostik", "Model load: ${state.loadMs?.let { "$it ms" } ?: "belum diukur"}\nKonteks: ${state.contextSize}\nPSS merangkumi proses aplikasi, bukan model sahaja. Kelajuan diukur daripada token native; tiada skor kualiti automatik.")
                                    AksaraButton("Jalankan 9 benchmark", vm::benchmark, enabled = state.canInfer)
                                    AksaraText("Suite: " + NeuralViewModel.suite.joinToString { it.first }, size = 11f)
                                    state.measurements.forEach { result ->
                                        Note(result.label, "${result.tokens} token · TTFT ${result.firstTokenMs?.let { "$it ms" } ?: "—"}\n${String.format(Locale.ROOT, "%.2f", result.tokensPerSecond)} token/s · ${result.totalMs} ms jumlah\nPSS ${result.pssKb / 1024} MiB · terma ${result.thermal}\nDibatalkan: ${result.cancelled}\nRalat: ${result.error ?: "tiada"}\n\n${result.output}")
                                    }
                                    if (state.measurements.isEmpty()) AksaraText("Belum ada keputusan. Aktifkan model dan mulakan ujian secara manual.", size = 12f)
                                }
                                5 -> KnowledgePanel(state, vm)
                            }
                        }
                        deleting?.let { model ->
                            Note("Padam ${model.name}?", "Fail peribadi akan dibuang. Model aktif dinyahmuat terlebih dahulu.")
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                AksaraButton("Batal", { deleting = null })
                                AksaraButton("Sahkan padam", { vm.delete(model); deleting = null }, enabled = state.busy == null)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable private fun Note(title: String, text: String) {
    AksaraGlassSurface(Modifier.fillMaxWidth(), radius = 14.dp, blur = 4.dp) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            AksaraText(title, size = 13f, weight = 600, color = AksaraColors.gold)
            AksaraText(text, size = 12f)
        }
    }
}
@Composable private fun ModelEntry(entry: NeuralCatalogEntry, model: NeuralModelDescriptor, state: NeuralUiState,
    onDownload: () -> Unit, onImport: () -> Unit, onActivate: () -> Unit, onDelete: () -> Unit, onRefresh: () -> Unit) {
    val context = LocalContext.current
    val installed = model.id in state.installed
    val assessment = state.device?.let { NeuralMemoryPolicy.assess(it, model, state.contextSize) }
    val eligibility = assessment?.hardFailure ?: assessment?.warning ?: if (assessment == null) "Peranti belum diukur" else "Layak mencuba"
    val memoryDescription = assessment?.let {
        "Tersedia ${bytes(state.device!!.availableRamBytes)}; anggaran native ${bytes(it.estimatedNativeBytes)}\n" +
            "KV ${bytes(it.kvCacheBytes)} · scratch ${bytes(it.scratchBytes)} · overhead ${bytes(it.overheadBytes)}\n" +
            "Rizab Android ${bytes(it.reserveBytes)} · cadangan tersedia ${bytes(it.recommendedAvailableBytes)}\nKonteks ${it.contextSize} token"
    } ?: "Tekan Semak RAM untuk bacaan baharu"
    Note("${entry.tier.label} · ${model.name}", "${model.parameters} parameter · GGUF ${model.quantization}\nFail: ${model.sizeBytes} bait (${bytes(model.sizeBytes)})\nStoran diperlukan: ${bytes(model.sizeBytes + 134217728)}\n${memoryDescription}\nQwen / Alibaba · ${model.license}\nRevisi: ${model.sourceRevision}\nSHA-256: ${model.sha256}\nPemasangan: ${if (installed) "fail tersedia" else "belum dipasang"}\nPengesahan: ${if (model.id in state.verified) "SHA-256 sah sesi ini" else "diperiksa semasa import/aktivasi"}\nKeserasian: ${eligibility}\n${model.downloadUrl}")
    AksaraButton("Sumber & atribusi", {
        runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(model.downloadUrl.substringBefore("/resolve/") + "/tree/" + model.sourceRevision))) }
    })
    if (installed) AksaraButton("Semak RAM", onRefresh, enabled = state.busy == null)
    if (state.transferId == model.id) AksaraText("${state.progress} / ${state.progressTotal ?: "?"} bait · ${if ((state.progressTotal ?: 0) > 0) state.progress * 100 / state.progressTotal!! else 0}% · SHA-256 sebelum pemasangan", size = 11f)
    Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
        if (!installed) {
            AksaraButton("Muat turun / Retry", onDownload, enabled = entry.canDownload && state.busy == null && (state.device?.availableStorageBytes ?: 0) > model.sizeBytes + 134217728)
            AksaraButton("Import", onImport, enabled = state.busy == null)
        } else {
            val label = when {
                state.activation.pendingId == model.id -> "Mengesahkan / memuat…"
                state.loadedId == model.id -> "Aktif"
                NeuralMemoryPolicy.isLight(model) -> "Cuba Light · 1024"
                else -> "Sahkan & aktif"
            }
            AksaraButton(label, onActivate, enabled = state.busy == null && state.loadedId != model.id)
            AksaraButton("Padam", onDelete, enabled = state.busy == null)
        }
    }
}
@Composable private fun Input(value: String, onValue: (String) -> Unit, modifier: Modifier = Modifier) {
    AksaraGlassSurface(modifier.fillMaxWidth(), radius = 14.dp, blur = 5.dp) {
        Box(Modifier.padding(12.dp)) {
            if (value.isEmpty()) AksaraText("Tulis mesej…", color = AksaraColors.muted, size = 13f)
            BasicTextField(value, { onValue(it.take(8000)) }, Modifier.fillMaxWidth().heightIn(min = 28.dp, max = 100.dp),
                textStyle = AksaraTypography.style(13f), cursorBrush = SolidColor(AksaraColors.gold))
        }
    }
}
@Composable private fun NeuralChat(state: NeuralUiState, vm: NeuralViewModel, modifier: Modifier) {
    var prompt by remember { mutableStateOf("") }
    val list = rememberLazyListState()
    val dragging by list.interactionSource.collectIsDraggedAsState()
    var follow by remember { mutableStateOf(true) }
    LaunchedEffect(dragging) { if (!dragging) follow = !list.canScrollForward }
    LaunchedEffect(state.streaming, state.turns.size) {
        if (follow && !dragging && (state.turns.isNotEmpty() || state.streaming.isNotEmpty())) {
            list.scrollToItem(if (state.streaming.isNotEmpty()) state.turns.size else (state.turns.size - 1).coerceAtLeast(0))
        }
    }
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            AksaraText(state.loadedId ?: "Aktifkan model di Model Library", Modifier.weight(1f), size = 11f, color = AksaraColors.gold)
            AksaraButton("Kosongkan", vm::clear, enabled = state.busy == null)
        }
        LazyColumn(Modifier.weight(1f).fillMaxWidth(), state = list, verticalArrangement = Arrangement.spacedBy(9.dp)) {
            if (state.turns.isEmpty() && state.streaming.isEmpty()) item { Note("Aksara Local", "Mesej dijana pada peranti. Aktifkan model untuk bermula. Tiada memori kekal.") }
            items(state.turns) { turn -> Note(if (turn.role == "user") "Anda" else "Aksara Local", turn.text) }
            if (state.streaming.isNotEmpty()) item { Note("Aksara Local · aliran", state.streaming) }
            state.source?.let { source -> item { Note("Fakta diperoleh • berasingan daripada jawapan model", source) } }
        }
        state.measurements.lastOrNull()?.let { AksaraText("${it.tokens} token · ${it.totalMs} ms · ${String.format(Locale.ROOT, "%.2f", it.tokensPerSecond)} token/s", size = 10f) }
        Input(prompt, { prompt = it })
        AksaraButton("Hantar pada peranti", { vm.send(prompt); prompt = "" }, Modifier.fillMaxWidth(), icon = "send",
            enabled = state.canInfer && prompt.isNotBlank())
    }
}
@Composable private fun KnowledgePanel(state: NeuralUiState, vm: NeuralViewModel) {
    var query by remember { mutableStateOf("") }
    Note("Pengetahuan V2 · memori OFF", "Menggunakan korpus berversi PR #320 dan LocalKnowledgeEngine yang sama. Fakta diambil tanpa rangkaian. Penaakulan model dipaparkan berasingan; tiada padanan tidak dianggap fakta.")
    Input(query, { query = it })
    AksaraButton("Cari sumber tempatan", { vm.retrieve(query) }, enabled = query.isNotBlank() && state.busy == null)
    state.source?.let { Note("Sumber / hasil retrieval", it) }
}
