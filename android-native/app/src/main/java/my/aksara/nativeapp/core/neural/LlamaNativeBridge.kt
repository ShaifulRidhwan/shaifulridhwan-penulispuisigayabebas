package my.aksara.nativeapp.core.neural

import java.io.ByteArrayOutputStream
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

data class NeuralTurn(val role: String, val text: String)

/** One process-wide runtime, serialized off the UI thread. No network provider exists here. */
@androidx.annotation.Keep
class LlamaNativeBridge : NeuralRuntime {
    companion object { private val operation = Mutex() }
    @Volatile private var loaded = false
    override val isLoaded: Boolean get() = loaded
    val available: Boolean by lazy { runCatching { System.loadLibrary("aksara_neural"); true }.getOrDefault(false) }
    private external fun nativeLoad(path: String, contextSize: Int, ticket: Long): Boolean
    private external fun nativeTicket(): Long
    private external fun nativeGenerate(roles: Array<ByteArray>, contents: Array<ByteArray>, maxTokens: Int, ticket: Long): Int
    private external fun nativeCancel()
    private external fun nativeUnload()
    private var listener: ((String) -> Unit)? = null
    private val output = ByteArrayOutputStream()
    // JNI sends UTF-8 bytes; decode the accumulated stream to retain split multibyte characters.
    @Suppress("unused")
    fun onNativeToken(bytes: ByteArray) { output.write(bytes); listener?.invoke(output.toString("UTF-8")) }
    suspend fun loadWithContext(model: File, contextSize: Int): Result<Unit> {
        if (!available) return Result.failure(IllegalStateException("Native ARM64 runtime unavailable"))
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
    suspend fun chat(turns: List<NeuralTurn>, maxTokens: Int = 384, onText: (String) -> Unit): Int {
        check(available && loaded) { "Load a verified GGUF model first" }
        // Issue the ticket before scheduling so Stop also cancels a queued generation.
        val ticket = nativeTicket()
        return withContext(Dispatchers.Default) {
            operation.withLock {
                output.reset(); listener = onText
                try {
                    nativeGenerate(turns.map { it.role.toByteArray(Charsets.UTF_8) }.toTypedArray(),
                        turns.map { it.text.toByteArray(Charsets.UTF_8) }.toTypedArray(), maxTokens, ticket)
                } finally { listener = null }
            }
        }
    }
    override suspend fun generate(prompt: String, onEvent: (NeuralInferenceEvent) -> Unit) {
        var previous = ""
        try {
            chat(listOf(NeuralTurn("user", prompt))) { text ->
                onEvent(NeuralInferenceEvent.Token(text.removePrefix(previous))); previous = text
            }
            onEvent(NeuralInferenceEvent.Completed)
        } catch (error: Exception) { onEvent(NeuralInferenceEvent.Failure(error.message ?: "Native inference failed")) }
    }
    override fun cancel() { if (available) nativeCancel() }
    override suspend fun unload() = withContext(Dispatchers.IO) {
        cancel()
        operation.withLock { if (available) nativeUnload(); loaded = false }
    }
}
