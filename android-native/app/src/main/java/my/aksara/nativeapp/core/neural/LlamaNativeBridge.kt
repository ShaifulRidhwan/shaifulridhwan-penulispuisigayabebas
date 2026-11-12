package my.aksara.nativeapp.core.neural

import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

data class NeuralTurn(val role: String, val text: String)

data class NeuralNativeMetrics(val promptTokens: Long, val reusedTokens: Long, val prefillUs: Long,
    val firstTokenUs: Long?, val decodeUs: Long, val decodeSteps: Long, val threads: Long,
    val batchThreads: Long, val context: Long, val queueMs: Long, val cancelUs: Long?) {
    val decodeTokensPerSecond: Double? get() = if (decodeSteps > 0 && decodeUs > 0) decodeSteps * 1_000_000.0 / decodeUs else null
}

/** One process-wide runtime, serialized off the UI thread. No network provider exists here. */
@androidx.annotation.Keep
class LlamaNativeBridge : NeuralRuntime {
    companion object { private val operation = Mutex() }
    @Volatile private var loaded = false
    override val isLoaded: Boolean get() = loaded
    private val libraryLoadResult: Result<Unit> by lazy { runCatching { System.loadLibrary("aksara_neural") } }
    val available: Boolean get() = libraryLoadResult.isSuccess
    val availabilityError: String? get() = libraryLoadResult.exceptionOrNull()?.let { cause ->
        "JNI_LOAD_FAILED: ${cause.javaClass.simpleName}: ${cause.message ?: "unknown linker error"}"
    }
    private external fun nativeLoad(path: String, contextSize: Int, ticket: Long): Boolean
    private external fun nativeTicket(): Long
    private external fun nativeGenerate(roles: Array<ByteArray>, contents: Array<ByteArray>, maxTokens: Int, ticket: Long, threads: Int): Int
    private external fun nativeCancel()
    private external fun nativeUnload()
    private external fun nativeClearCache()
    private var listener: ((String) -> Unit)? = null
    private var decoder = NeuralUtf8Stream()
    private var submittedNs = 0L
    private var queueMs = 0L
    var lastMetrics: NeuralNativeMetrics? = null
        private set
    var lastTokenCount: Int = 0
        private set
    @Suppress("unused")
    fun onNativeStart() { queueMs = (System.nanoTime() - submittedNs) / 1_000_000 }
    @Suppress("unused")
    fun onNativeMetrics(values: LongArray) {
        if (values.size == 10) lastMetrics = NeuralNativeMetrics(values[0], values[1], values[2],
            values[3].takeIf { it >= 0 }, values[4], values[5], values[6], values[7], values[8], queueMs, values[9].takeIf { it >= 0 })
    }
    // Emit deltas; no repeated whole-response UTF-8 decoding on every native token.
    @Suppress("unused")
    fun onNativeToken(bytes: ByteArray) {
        ++lastTokenCount
        decoder.append(bytes).takeIf { it.isNotEmpty() }?.let { listener?.invoke(it) }
    }
    suspend fun loadWithContext(model: File, contextSize: Int): Result<Unit> {
        if (!available) return Result.failure(IllegalStateException(availabilityError ?: "Native ARM64 runtime unavailable"))
        val ticket = nativeTicket()
        return withContext(Dispatchers.IO) {
            operation.withLock {
                runCatching {
                    check(available) { "Native ARM64 runtime unavailable in this APK/device" }
                    require(model.isFile && model.extension.equals("gguf", true)) { "Verified GGUF file missing" }
                    loaded = false
                    check(nativeLoad(model.absolutePath, contextSize, ticket)) { "GGUF loading failed" }
                    loaded = true
                }
            }
        }
    }
    override suspend fun load(model: File) = loadWithContext(model, 2048)
    suspend fun chat(turns: List<NeuralTurn>, maxTokens: Int = 384, threads: Int = 0, onText: (String) -> Unit): Int {
        check(available && loaded) { "Load a verified GGUF model first" }
        // Issue the ticket before scheduling so Stop also cancels a queued generation.
        val ticket = nativeTicket()
        val submitted = System.nanoTime()
        return withContext(Dispatchers.Default) {
            operation.withLock {
                submittedNs = submitted; lastMetrics = null; lastTokenCount = 0; decoder = NeuralUtf8Stream(); listener = onText
                try {
                    nativeGenerate(turns.map { it.role.toByteArray(Charsets.UTF_8) }.toTypedArray(),
                        turns.map { it.text.toByteArray(Charsets.UTF_8) }.toTypedArray(), maxTokens, ticket, threads)
                } finally {
                    try { decoder.append(byteArrayOf(), end = true).takeIf { it.isNotEmpty() }?.let(onText) }
                    finally { listener = null }
                }
            }
        }
    }
    override suspend fun generate(prompt: String, onEvent: (NeuralInferenceEvent) -> Unit) {
        try {
            chat(listOf(NeuralGenerationPolicy.userTurn(prompt, false))) { delta ->
                onEvent(NeuralInferenceEvent.Token(delta))
            }
            onEvent(NeuralInferenceEvent.Completed)
        } catch (error: Exception) { onEvent(NeuralInferenceEvent.Failure(error.message ?: "Native inference failed")) }
    }
    override fun cancel() { if (available) nativeCancel() }
    suspend fun clearCache() = withContext(Dispatchers.Default) {
        operation.withLock { if (available && loaded) nativeClearCache() }
    }
    override suspend fun unload() = withContext(Dispatchers.IO) {
        cancel()
        operation.withLock { if (available) nativeUnload(); loaded = false }
    }
}
