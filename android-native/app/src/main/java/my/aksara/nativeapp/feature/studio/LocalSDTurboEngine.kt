package my.aksara.nativeapp.feature.studio

import android.app.ActivityManager
import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.os.StatFs
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.security.MessageDigest
import java.util.concurrent.TimeUnit

/**
 * SD-Turbo CPU backend and model manager. Model weights are never packaged in the APK.
 * A missing or unloadable JNI library is an explicit error, never a Cloud fallback.
 */
internal object SDTurboSpec {
    const val filename = "sd_turbo_q4_0.gguf"
    const val sizeBytes = 1847909248L
    const val sha256 = "d069ef2b2d3d5c2465662d706c242a1016db56163c109bd7e3008a94cdd00359"
    const val source = "https://huggingface.co/samoudi/sd-turbo-gguf/resolve/main/sd_turbo_q4_0.gguf"
    const val minPublishedRam = 4L * 1024L * 1024L * 1024L
    const val width = 512
    const val height = 512
    const val steps = 1
    const val nativeCfg = 1.0f
}

internal class LocalModelManager(private val context: Context) {
    private val dir = File(context.filesDir, "studio-models").apply { mkdirs() }
    private val download = File(dir, SDTurboSpec.filename + ".part")
    private val installed = File(dir, SDTurboSpec.filename)
    private val receipt = File(dir, SDTurboSpec.filename + ".sha256")
    private val client = OkHttpClient.Builder().connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(90, TimeUnit.SECONDS).build()
    private val mutex = Mutex()

    fun modelPath(): String? =
        if (installed.isFile && installed.length() == SDTurboSpec.sizeBytes &&
            receipt.isFile && receipt.readText().trim() == SDTurboSpec.sha256)
            installed.absolutePath else null

    fun availableBytes(): Long = StatFs(dir.absolutePath).availableBytes

    fun deviceWarning(): String? {
        if (Build.SUPPORTED_ABIS.none { it == "arm64-v8a" }) return "SD-Turbo memerlukan arm64-v8a."
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val info = ActivityManager.MemoryInfo()
        am.getMemoryInfo(info)
        if (info.totalMem < SDTurboSpec.minPublishedRam)
            return "RAM peranti di bawah saranan 4 GB untuk model Q4."
        if (info.lowMemory) return "Android mengesan tekanan memori. Cuba lagi selepas menutup aplikasi berat."
        val power=context.getSystemService(Context.POWER_SERVICE) as PowerManager
        if (power.currentThermalStatus >= PowerManager.THERMAL_STATUS_SEVERE)
            return "Peranti terlalu panas untuk inferens SD-Turbo. Sejukkan peranti dahulu."
        return null
    }

    private fun digest(file: File): String {
        val md = MessageDigest.getInstance("SHA-256")
        file.inputStream().buffered().use { input ->
            val buffer = ByteArray(1024 * 1024)
            while (true) {
                val n = input.read(buffer)
                if (n < 0) break
                md.update(buffer, 0, n)
            }
        }
        return md.digest().joinToString("") { "%02x".format(it) }
    }

    private fun atomicallyInstall(candidate: File) {
        require(candidate.length() == SDTurboSpec.sizeBytes) { "Saiz model tidak sepadan." }
        require(digest(candidate) == SDTurboSpec.sha256) { "SHA-256 gagal. Fail tidak dipasang." }
        val destination = File(dir, "sd-turbo-verified.tmp")
        if (destination.exists()) destination.delete()
        if (!candidate.renameTo(destination)) {
            candidate.copyTo(destination, overwrite = true)
            candidate.delete()
        }
        // The old valid model is only replaced after integrity verification.
        java.nio.file.Files.move(destination.toPath(), installed.toPath(),
            java.nio.file.StandardCopyOption.ATOMIC_MOVE,
            java.nio.file.StandardCopyOption.REPLACE_EXISTING)
        receipt.writeText(SDTurboSpec.sha256)
    }

    suspend fun verify(): Boolean = withContext(Dispatchers.IO) {
        mutex.withLock {
            val path = modelPath() ?: return@withLock false
            val correct = digest(File(path)) == SDTurboSpec.sha256
            if (!correct) receipt.delete()
            correct
        }
    }

    suspend fun download(onProgress: (Long, Long) -> Unit) = withContext(Dispatchers.IO) {
        mutex.withLock {
            val used = if (download.isFile) download.length() else 0L
            val remaining = SDTurboSpec.sizeBytes - used
            require(remaining > 0L || used == SDTurboSpec.sizeBytes) { "Fail muat turun separa rosak." }
            // A previous download may have finished before the app was interrupted
            // during verification. Verify and install it without downloading again.
            if (used == SDTurboSpec.sizeBytes) {
                currentCoroutineContext().ensureActive()
                onProgress(used, SDTurboSpec.sizeBytes)
                atomicallyInstall(download)
                return@withLock
            }
            require(availableBytes() > remaining + 128L * 1024 * 1024) { "Storan tidak mencukupi." }
            val request = Request.Builder().url(SDTurboSpec.source)
                .apply { if (used > 0 && used < SDTurboSpec.sizeBytes) header("Range", "bytes=$used-") }
                .build()
            val response = client.newCall(request).execute()
            response.use {
                if (!it.isSuccessful) throw IOException("Muat turun gagal: HTTP ${it.code}.")
                val resume = used > 0 && it.code == 206
                if (resume) {
                    val range = it.header("Content-Range").orEmpty()
                    if (!range.startsWith("bytes $used-") || !range.endsWith("/${SDTurboSpec.sizeBytes}"))
                        throw IOException("Pelayan tidak menyokong sambung muat turun dengan selamat.")
                }
                val append = resume
                if (!append && used > 0) download.delete()
                val body = it.body ?: throw IOException("Tiada data model.")
                FileOutputStream(download, append).use { output ->
                    body.byteStream().use { input ->
                        val buffer = ByteArray(256 * 1024)
                        var progress = if (append) used else 0L
                        while (true) {
                            currentCoroutineContext().ensureActive()
                            val n = input.read(buffer)
                            if (n < 0) break
                            output.write(buffer, 0, n)
                            progress += n
                            if (progress > SDTurboSpec.sizeBytes) throw IOException("Fail model melebihi saiz sah.")
                            onProgress(progress, SDTurboSpec.sizeBytes)
                        }
                        output.fd.sync()
                    }
                }
            }
            currentCoroutineContext().ensureActive()
            atomicallyInstall(download)
        }
    }

    suspend fun import(uri: Uri, onProgress: (Long, Long) -> Unit) = withContext(Dispatchers.IO) {
        mutex.withLock {
            require(availableBytes() > SDTurboSpec.sizeBytes + 128L * 1024 * 1024) { "Storan tidak mencukupi." }
            val temp = File(dir, "import-partial.tmp")
            try {
                val input = context.contentResolver.openInputStream(uri) ?: throw IOException("Fail import tidak dapat dibuka.")
                input.use { source ->
                    FileOutputStream(temp).use { output ->
                        val buffer = ByteArray(256 * 1024)
                        var copied = 0L
                        while (true) {
                            currentCoroutineContext().ensureActive()
                            val n = source.read(buffer)
                            if (n < 0) break
                            copied += n
                            if (copied > SDTurboSpec.sizeBytes) throw IOException("Format/saiz model tidak sah.")
                            output.write(buffer, 0, n)
                            onProgress(copied, SDTurboSpec.sizeBytes)
                        }
                        output.fd.sync()
                    }
                }
                atomicallyInstall(temp)
            } finally { temp.delete() }
        }
    }

    suspend fun remove() = withContext(Dispatchers.IO) {
        mutex.withLock {
            installed.delete()
            receipt.delete()
            download.delete()
        }
    }
}

internal class LocalSDTurboEngine {
    private val mutex = Mutex()
    private val libraryLoaded: Boolean by lazy {
        runCatching { System.loadLibrary("aksara_sdturbo") }.isSuccess
    }
    fun available(): Boolean = libraryLoaded
    private external fun generateNative(modelPath: String, prompt: String, seed: Long, threads: Int): IntArray?
    private external fun cancelNative()
    fun cancel() { if (available()) cancelNative() }

    suspend fun generate(modelPath: String, prompt: String, seed: Long): Bitmap =
        withContext(Dispatchers.Default) {
            mutex.withLock {
                check(available()) { "Runtime SD-Turbo JNI tidak tersedia dalam binaan ini." }
                require(File(modelPath).isFile) { "Model belum dipasang." }
                StudioRules.local("1:1", SDTurboSpec.steps, SDTurboSpec.nativeCfg)
                val threads = Runtime.getRuntime().availableProcessors().coerceIn(1, 4)
                val pixels = generateNative(modelPath, StudioRules.prompt(prompt), seed, threads)
                    ?: throw IOException("Native SD-Turbo gagal menjana imej.")
                require(pixels.size == SDTurboSpec.width * SDTurboSpec.height) { "Dimensi output native tidak sah." }
                Bitmap.createBitmap(pixels, SDTurboSpec.width, SDTurboSpec.height, Bitmap.Config.ARGB_8888)
            }
        }
}
