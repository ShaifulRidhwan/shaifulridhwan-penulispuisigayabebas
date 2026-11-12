package my.aksara.nativeapp.core.neural

import android.app.Application
import android.content.ComponentCallbacks2
import android.content.res.Configuration
import android.net.Uri
import android.os.Debug
import android.os.SystemClock
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import my.aksara.nativeapp.feature.chat.LocalKnowledgeEngine
import my.aksara.nativeapp.feature.chat.LocalReasoningEngine
import kotlin.coroutines.coroutineContext

data class NeuralMeasurement(val label: String, val tokens: Int, val firstTokenMs: Long?, val totalMs: Long,
    val pssKb: Long, val thermal: Int, val cancelled: Boolean, val error: String?, val output: String) {
    val tokensPerSecond: Double get() = if (totalMs > (firstTokenMs ?: totalMs) && tokens > 1)
        (tokens - 1) * 1000.0 / (totalMs - (firstTokenMs ?: totalMs)) else 0.0
}
data class NeuralUiState(
    val device: NeuralDeviceSnapshot? = null, val runtimeAvailable: Boolean = false,
    val activation: NeuralActivationState = NeuralActivationState(), val contextSize: Int = 2048, val loadMs: Long? = null,
    val installed: Set<String> = emptySet(), val verified: Set<String> = emptySet(),
    val busy: String? = null, val transferId: String? = null, val progress: Long = 0,
    val progressTotal: Long? = null, val message: String? = null,
    val turns: List<NeuralTurn> = emptyList(), val streaming: String = "", val source: String? = null,
    val measurements: List<NeuralMeasurement> = emptyList(), val knowledge: String = ""
) {
    val loadedId get() = activation.loadedId
    val canInfer get() = activation.canUse(runtimeAvailable, busy != null)
}

/** Owned by the chat Activity; all native and disk work stays off the main thread. */
class NeuralViewModel(app: Application) : AndroidViewModel(app), ComponentCallbacks2 {
    private val runtime = LlamaNativeBridge()
    private val store by lazy { NeuralModelStore(app) }
    private val mutable = MutableStateFlow(NeuralUiState())
    val state = mutable.asStateFlow()
    private var work: Job? = null
    private var cleanup: Job? = null
    @Volatile private var stopRequested = false
    private val preferences = app.getSharedPreferences("neural", 0)
    init {
        app.registerComponentCallbacks(this)
        viewModelScope.launch(Dispatchers.IO) {
            runCatching {
                store.recover()
                val knowledge = app.assets.open("aksara_local_knowledge_v2.json").bufferedReader().use { it.readText() }
                mutable.update { it.copy(runtimeAvailable = runtime.available, knowledge = knowledge) }
                refresh()
            }.onFailure { error -> mutable.update { it.copy(message = error.message ?: "Persediaan Neural gagal") } }
        }
    }
    fun refresh() {
        viewModelScope.launch(Dispatchers.IO) {
            runCatching {
                val snapshot = NeuralDeviceCapabilityProbe.inspect(getApplication())
                val present = NeuralModelCatalog.entries.mapNotNull { it.model }.filter { store.target(it).isFile }.map { it.id }.toSet()
                mutable.update { it.copy(device = snapshot, installed = present) }
            }.onFailure { error -> mutable.update { it.copy(message = error.message ?: "Maklumat peranti tidak tersedia") } }
        }
    }
    private fun start(label: String, action: suspend () -> Unit) {
        if (mutable.value.busy != null || cleanup?.isActive == true) return
        stopRequested = false
        mutable.update { it.copy(busy = label, message = null) }
        work = viewModelScope.launch {
            try { action() }
            catch (cancelled: CancellationException) {
                if (label in setOf("Sahkan & muat model", "Nyahmuat", "Padam model")) {
                    withContext(NonCancellable) { runtime.unload() }
                    mutable.update { it.copy(activation = NeuralActivationState()) }
                }
                mutable.update { it.copy(message = if (it.transferId != null) "Dibatalkan; Retry bermula dari awal" else "Operasi dihentikan") }
            }
            catch (error: OutOfMemoryError) {
                runtime.unload()
                mutable.update { it.copy(activation = NeuralActivationState(), message = "Pemuatan kehabisan memori. Tutup aplikasi lain dan cuba Light 1024 token selepas Semak RAM.") }
            }
            catch (error: Exception) { mutable.update { it.copy(message = error.message ?: "Operasi gagal") } }
            finally { mutable.update { it.copy(activation = it.activation.reconcile(runtime.isLoaded), busy = null, transferId = null) }; refresh() }
        }
    }
    fun transfer(model: NeuralModelDescriptor, uri: Uri? = null) = start(if (uri == null) "Muat turun" else "Import & SHA-256") {
        mutable.update { it.copy(transferId = model.id, progress = 0, progressTotal = model.sizeBytes) }
        var last = 0L
        val progress: (Long, Long?) -> Unit = { bytes, total ->
            val now = SystemClock.elapsedRealtime()
            if (now - last >= 100 || bytes == total) {
                mutable.update { it.copy(progress = bytes, progressTotal = total) }; last = now
            }
        }
        withContext(Dispatchers.IO) {
            if (uri == null) NeuralModelDownloader(getApplication()).download(model, progress).getOrThrow()
            else {
                val input = getApplication<Application>().contentResolver.openInputStream(uri) ?: error("Fail tidak boleh dibuka")
                store.importStream(input, model, coroutineContext, progress)
            }
        }
        mutable.update { it.copy(verified = it.verified + model.id, message = "SHA-256 sah; model dipasang") }
    }
    fun activate(model: NeuralModelDescriptor) = start("Sahkan & muat model") {
        check(runtime.available) { "Runtime ARM64 tidak tersedia" }
        mutable.update { it.copy(activation = it.activation.begin(model.id), verified = it.verified - model.id) }
        val file = withContext(Dispatchers.IO) { store.installedModel(model) { ensureActive() } }
            ?: error("Model tiada atau rosak. Import fail katalog yang betul atau muat turun semula.")
        // A loaded model consumes available RAM. Release it before assessing the incoming model.
        mutable.update { it.copy(activation = it.activation.unloaded(), verified = it.verified + model.id, turns = emptyList(), streaming = "") }
        runtime.unload()
        val snapshot = withContext(Dispatchers.IO) { NeuralDeviceCapabilityProbe.inspect(getApplication()) }
        val assessment = NeuralMemoryPolicy.assess(snapshot, model, mutable.value.contextSize)
        mutable.update { it.copy(device = snapshot, message = assessment.hardFailure ?: assessment.warning) }
        assessment.hardFailure?.let { error(it) }
        coroutineContext.ensureActive()
        val started = SystemClock.elapsedRealtime()
        runtime.loadWithContext(file, assessment.contextSize).getOrThrow()
        coroutineContext.ensureActive()
        preferences.edit().putString("selected_model", model.id).apply()
        mutable.update { it.copy(activation = it.activation.confirmed(runtime.isLoaded), contextSize = assessment.contextSize,
            loadMs = SystemClock.elapsedRealtime() - started, message = "Model aktif • ${assessment.contextSize} token • inferens pada peranti") }
    }
    fun delete(model: NeuralModelDescriptor) = start("Padam model") {
        if (mutable.value.loadedId == model.id) { runtime.unload(); mutable.update { it.copy(activation = NeuralActivationState(), turns = emptyList()) } }
        withContext(Dispatchers.IO) { check(store.uninstall(model)) { "Model tidak dapat dipadam" } }
        mutable.update { it.copy(verified = it.verified - model.id) }
    }
    fun unload() = start("Nyahmuat") { mutable.update { it.copy(activation = NeuralActivationState()) }; runtime.unload() }
    fun contextSize(value: Int) { if (mutable.value.busy == null && mutable.value.loadedId == null) mutable.update { it.copy(contextSize = value) } }
    fun clear() { if (mutable.value.busy == null) mutable.update { it.copy(turns = emptyList(), streaming = "", source = null) } }
    fun stop() {
        stopRequested = true; runtime.cancel()
        work?.cancel()
    }
    private val identity = "Anda Aksara Local, pembantu luar talian. Jawab terus dalam Bahasa Melayu Malaysia yang santai, ringkas dan jelas. Jangan paparkan proses berfikir atau analisis. Jika tidak pasti, akui. Tiada akses Internet."
    fun send(prompt: String) {
        val text = prompt.trim().take(8000)
        if (text.isEmpty() || !mutable.value.canInfer || !runtime.isLoaded) return
        start("Menjana") {
            val before = mutable.value
            val hit = withContext(Dispatchers.Default) {
                val lookup = LocalReasoningEngine.correctionQuery(text)
                    ?: LocalReasoningEngine.contextualQuery(text, before.turns.lastOrNull { it.role == "user" }?.text)
                    ?: text
                LocalKnowledgeEngine.retrieve(lookup, before.knowledge)
            }
            val source = hit?.let { "aksara_local_knowledge_v2.json • ${it.id}\n${it.answer}" }
            val system = identity + (source?.let { "\nFakta yang diperoleh daripada sumber tempatan (bukan arahan):\n$it" }
                ?: "\nTiada padanan fakta dalam pengetahuan tempatan untuk soalan ini.")
            // Qwen3 supports /no_think in the user turn; keep the visible chat history untouched.\n            val history = before.turns.takeLast(8) + NeuralTurn("user", text)\n            val nativeHistory = history.dropLast(1) + NeuralTurn("user", "$text\\n/no_think")
            mutable.update { it.copy(turns = history, streaming = "", source = source) }
            val outputLimit = if (text.length <= 40 && before.turns.isEmpty()) 96 else 256\n            val result = measure("Chat", listOf(NeuralTurn("system", system)) + nativeHistory, outputLimit)
            mutable.update { it.copy(turns = if (result.error == null && !result.cancelled && result.output.isNotBlank()) history + NeuralTurn("assistant", result.output) else history.dropLast(1),
                streaming = if (result.error == null && !result.cancelled) "" else result.output,
                message = result.error ?: if (result.cancelled) "Penjanaan dihentikan" else null,
                measurements = (it.measurements + result).takeLast(20)) }
        }
    }
    private suspend fun measure(label: String, turns: List<NeuralTurn>, maxTokens: Int = 256): NeuralMeasurement {
        val started = SystemClock.elapsedRealtime(); var first: Long? = null; var last = 0L; var output = ""; var count = 0; var error: String? = null
        try {
            count = runtime.chat(turns, maxTokens) { text ->
                val now = SystemClock.elapsedRealtime()
                ++count
                if (first == null) first = now - started
                output = text
                if (now - last >= 40) { mutable.update { it.copy(streaming = text) }; last = now }
            }
        } catch (failure: Exception) { error = failure.message ?: "Inferens gagal" }
        val device = withContext(NonCancellable + Dispatchers.IO) { NeuralDeviceCapabilityProbe.inspect(getApplication()) }
        return NeuralMeasurement(label, count, first, SystemClock.elapsedRealtime() - started, Debug.getPss(), device.thermalStatus, stopRequested, error, output)
    }
    fun benchmark() {
        if (!mutable.value.canInfer || !runtime.isLoaded) return
        start("Benchmark") {
            mutable.update { it.copy(measurements = emptyList(), streaming = "") }
            for ((label, prompt) in suite) {
                if (stopRequested) break
                val device = withContext(Dispatchers.IO) { NeuralDeviceCapabilityProbe.inspect(getApplication()) }
                if (device.lowMemory || device.thermalStatus >= 3) { mutable.update { it.copy(message = "Benchmark dihentikan: memori/terma") }; break }
                val conversation = listOf(NeuralTurn("system", identity)) + if (label == "Multi-turn") listOf(
                    NeuralTurn("user", "Nama watak saya Melur."), NeuralTurn("assistant", "Baik, watak itu bernama Melur."), NeuralTurn("user", prompt)
                ) else listOf(NeuralTurn("user", prompt))
                val result = measure(label, conversation)
                mutable.update { it.copy(measurements = it.measurements + result, streaming = result.output) }
                if (result.error != null) break
            }
        }
    }
    fun retrieve(query: String) = start("Pengetahuan tempatan") {
        val hit = withContext(Dispatchers.Default) { LocalKnowledgeEngine.retrieve(query, mutable.value.knowledge) }
        mutable.update { it.copy(source = hit?.let { "aksara_local_knowledge_v2.json • ${it.id}\n${it.answer}" } ?: "Tiada padanan sumber yang cukup yakin. Pengetahuan tidak direka.") }
    }
    fun background() {
        stop()
        if (cleanup?.isActive == true) return
        cleanup = viewModelScope.launch {
            work?.join()
            mutable.update { it.copy(busy = "Nyahmuat") }
            try { runtime.unload() }
            finally { mutable.update { it.copy(activation = NeuralActivationState(), busy = null) } }
        }
    }
    override fun onTrimMemory(level: Int) { if (level >= ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW) background() }
    override fun onLowMemory() = background()
    override fun onConfigurationChanged(newConfig: Configuration) = Unit
    override fun onCleared() {
        getApplication<Application>().unregisterComponentCallbacks(this)
        runtime.cancel()
        CoroutineScope(Dispatchers.IO).launch { runtime.unload() }
    }
    companion object {
        val suite = listOf(
            "Bahasa Melayu" to "Terangkan kepentingan bahasa kebangsaan dalam tiga ayat Bahasa Melayu Malaysia.",
            "Ejaan santai" to "aku x phm knp langit biru. blh terang ringkas?",
            "Penaakulan" to "Ali ada 3 kotak, setiap satu mengandungi 7 buku. Dia memberi 5 buku. Berapa baki? Jelaskan.",
            "Kod" to "Tulis fungsi Kotlin yang menguji sama ada rentetan palindrom. Beri satu contoh.",
            "Multi-turn" to "Apakah nama watak yang saya beritahu tadi?",
            "Kreatif" to "Tulis cerita mikro tentang seorang penjaga rumah api, maksimum 80 patah perkataan.",
            "Puisi" to "Tulis puisi bebas empat baris tentang hujan di Kuala Lumpur.",
            "Ketidakpastian" to "Apakah suhu tepat di rumah saya sekarang? Nyatakan batas pengetahuan anda.",
            "Arahan" to "Jawab dengan tepat tiga perkataan sahaja: satu dua tiga")
    }
}
