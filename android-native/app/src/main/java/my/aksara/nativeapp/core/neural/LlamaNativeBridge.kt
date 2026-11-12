package my.aksara.nativeapp.core.neural

import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Native backend is only available in APKs built with -PenableNeuralNative=true. */
class LlamaNativeBridge : NeuralRuntime {
    private var loaded = false
    override val isLoaded: Boolean get() = loaded
    private val nativeAvailable: Boolean by lazy {
        runCatching { System.loadLibrary("aksara_neural"); true }.getOrDefault(false)
    }
    private external fun nativeLoad(path: String, contextSize: Int): Boolean
    private external fun nativeGenerate(prompt: String, maxTokens: Int): String
    private external fun nativeCancel()
    private external fun nativeUnload()

    override suspend fun load(model: File): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            check(nativeAvailable) { "This APK does not include the native llama.cpp engine" }
            require(model.isFile && model.extension.equals("gguf", ignoreCase = true))
            check(nativeLoad(model.absolutePath, 4096)) { "GGUF model failed to load" }
            loaded = true
        }
    }

    override suspend fun generate(prompt: String, onEvent: (NeuralInferenceEvent) -> Unit) {
        if (!loaded) {
            onEvent(NeuralInferenceEvent.Failure("Load a verified GGUF model first"))
            return
        }
        try {
            val output = withContext(Dispatchers.Default) { nativeGenerate(prompt, 512) }
            onEvent(NeuralInferenceEvent.Token(output))
            onEvent(NeuralInferenceEvent.Completed)
        } catch (error: Exception) {
            onEvent(NeuralInferenceEvent.Failure(error.message ?: "Native inference failed"))
        }
    }

    override fun cancel() { if (nativeAvailable) nativeCancel() }
    override suspend fun unload() = withContext(Dispatchers.IO) {
        if (nativeAvailable) nativeUnload()
        loaded = false
    }
}
