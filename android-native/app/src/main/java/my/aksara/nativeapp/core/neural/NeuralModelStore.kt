package my.aksara.nativeapp.core.neural

import android.content.Context
import java.io.File
import java.io.InputStream
import java.io.FileOutputStream
import kotlinx.coroutines.ensureActive
import kotlin.coroutines.CoroutineContext

/** Private, same-filesystem staging and POSIX atomic rename; only catalog hashes install. */
class NeuralModelStore(private val directory: File) {
    constructor(context: Context) : this(File(context.filesDir, "neural-models"))
    init { check(directory.isDirectory || directory.mkdirs()) }
    fun target(descriptor: NeuralModelDescriptor) = File(directory, descriptor.id + ".gguf").also { require(descriptor.validate()) }
    fun installedModel(descriptor: NeuralModelDescriptor, checkpoint: () -> Unit = {}): File? = target(descriptor).takeIf {
        it.isFile && NeuralModelIntegrity.verifySha256(it, descriptor.sha256, checkpoint)
    }
    fun recover() {
        directory.listFiles()?.filter { it.name.endsWith(".part") || it.name.endsWith(".partial") }?.forEach { it.delete() }
        // Preserve pre-V2 imports; activation still rechecks their pinned hash.
        NeuralModelCatalog.entries.mapNotNull { it.model }.forEach { descriptor ->
            val old = File(directory, descriptor.id + ".model")
            if (old.isFile && !target(descriptor).exists()) old.renameTo(target(descriptor))
        }
    }
    fun install(staging: File, descriptor: NeuralModelDescriptor, checkpoint: () -> Unit = {}): File {
        require(descriptor.validate())
        require(descriptor.sizeBytes <= 0 || staging.length() == descriptor.sizeBytes) { "Model file size mismatch" }
        require(staging.inputStream().use { input -> ByteArray(4).also { check(input.read(it) == 4) }.contentEquals("GGUF".toByteArray()) }) { "Not a GGUF file" }
        check(NeuralModelIntegrity.verifySha256(staging, descriptor.sha256, checkpoint)) { "SHA-256 mismatch: corrupt or wrong model" }
        val destination = target(descriptor)
        checkpoint()
        java.nio.file.Files.move(staging.toPath(), destination.toPath(), java.nio.file.StandardCopyOption.ATOMIC_MOVE, java.nio.file.StandardCopyOption.REPLACE_EXISTING)
        return destination
    }
    fun stage() = File.createTempFile("neural-", ".part", directory)
    suspend fun importStream(input: InputStream, descriptor: NeuralModelDescriptor, coroutine: CoroutineContext, progress: (Long, Long?) -> Unit): File {
        val staging = stage()
        try {
            require(directory.usableSpace > descriptor.sizeBytes + 128L * 1024 * 1024) { "Insufficient storage" }
            input.use { source -> FileOutputStream(staging).use { output ->
                val buffer = ByteArray(64 * 1024); var count = 0L
                while (true) {
                    coroutine.ensureActive()
                    val n = source.read(buffer); if (n < 0) break
                    count += n
                    require(count <= descriptor.sizeBytes) { "File larger than selected model" }
                    require(directory.usableSpace > n + 32L * 1024 * 1024) { "Storage exhausted" }
                    output.write(buffer, 0, n); progress(count, descriptor.sizeBytes)
                }
                output.fd.sync()
            } }
            coroutine.ensureActive()
            return install(staging, descriptor) { coroutine.ensureActive() }
        } finally { staging.delete() }
    }
    fun importVerified(source: File, descriptor: NeuralModelDescriptor): Result<File> = runCatching {
        val staged = stage()
        try {
            require(directory.usableSpace > source.length() + 128L * 1024 * 1024) { "Insufficient storage" }
            source.inputStream().use { input -> FileOutputStream(staged).use { out -> input.copyTo(out); out.fd.sync() } }
            install(staged, descriptor)
        } finally { staged.delete() }
    }
    fun uninstall(descriptor: NeuralModelDescriptor): Boolean = target(descriptor).let { !it.exists() || it.delete() }
}
