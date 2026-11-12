package my.aksara.nativeapp.core.neural

import android.content.Context
import java.io.File
import java.io.IOException

/**
 * Imports a user-supplied model file into private storage after hash verification.
 * Network downloads and signed remote catalog are intentionally not implemented here.
 */
class NeuralModelStore(private val context: Context) {
    private val directory: File
        get() = File(context.filesDir, "neural-models").also { if (!it.exists() && !it.mkdirs()) throw IOException("Cannot create model directory") }

    fun installedModel(descriptor: NeuralModelDescriptor): File? {
        if (!descriptor.validate()) return null
        val file = File(directory, descriptor.id + ".model")
        return file.takeIf { NeuralModelIntegrity.verifySha256(it, descriptor.sha256) }
    }

    fun importVerified(source: File, descriptor: NeuralModelDescriptor): Result<File> = runCatching {
        require(descriptor.validate()) { "Invalid model descriptor" }
        require(source.isFile) { "Model source does not exist" }
        require(source.canonicalPath != File(directory, descriptor.id + ".model").canonicalPath) {
            "Source and destination must differ"
        }
        val free = directory.usableSpace
        require(source.length() > 0L && source.length() <= free) { "Insufficient storage" }
        val staging = File.createTempFile("neural-", ".partial", directory)
        try {
            source.inputStream().use { input ->
                staging.outputStream().use { output ->
                    input.copyTo(output, 64 * 1024)
                    output.flush()
                }
            }
            if (!NeuralModelIntegrity.verifySha256(staging, descriptor.sha256)) {
                throw SecurityException("Model checksum mismatch")
            }
            val target = File(directory, descriptor.id + ".model")
            if (target.exists() && !target.delete()) throw IOException("Cannot replace existing model")
            if (!staging.renameTo(target)) throw IOException("Cannot finalize model import")
            target
        } finally {
            staging.delete()
        }
    }

    fun uninstall(descriptor: NeuralModelDescriptor): Boolean {
        if (!descriptor.validate()) return false
        val target = File(directory, descriptor.id + ".model")
        return !target.exists() || target.delete()
    }
}
