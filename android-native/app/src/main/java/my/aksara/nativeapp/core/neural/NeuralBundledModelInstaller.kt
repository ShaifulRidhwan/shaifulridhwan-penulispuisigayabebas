package my.aksara.nativeapp.core.neural

import android.content.Context
import java.io.File
import java.io.IOException

/**
 * Optional test-only bundled GGUF. Packaging is explicit and fails closed:
 * placing a file in assets alone does not make it an inference runtime.
 */
class NeuralBundledModelInstaller(private val context: Context) {
    fun installAsset(assetName: String, descriptor: NeuralModelDescriptor): Result<File> = runCatching {
        require(descriptor.validate()) { "Untrusted model metadata" }
        require(assetName.matches(Regex("[a-zA-Z0-9._-]+\\.gguf"))) { "Unsafe asset path" }
        val assetPath = "neural/$assetName"
        val staging = File.createTempFile("bundled-neural-", ".gguf", context.cacheDir)
        try {
            context.assets.open(assetPath).use { input ->
                staging.outputStream().buffered().use { output ->
                    input.copyTo(output, 64 * 1024)
                    output.flush()
                }
            }
            if (!NeuralModelIntegrity.verifySha256(staging, descriptor.sha256)) {
                throw SecurityException("Bundled model hash mismatch")
            }
            NeuralModelStore(context).importVerified(staging, descriptor).getOrThrow()
        } catch (error: IOException) {
            throw IOException("Bundled model unavailable: $assetPath", error)
        } finally {
            staging.delete()
        }
    }
}
