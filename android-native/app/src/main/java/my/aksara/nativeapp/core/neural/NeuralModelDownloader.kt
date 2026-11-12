package my.aksara.nativeapp.core.neural

import android.content.Context
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.IOException
import kotlin.coroutines.coroutineContext

/**
 * Explicit opt-in model downloader. Only descriptors from a separately authenticated
 * catalog should be accepted by the calling UI. SHA-256 protects file integrity,
 * but does not authenticate a malicious manifest.
 */
class NeuralModelDownloader(
    private val context: Context,
    private val client: OkHttpClient = OkHttpClient()
) {
    suspend fun download(
        descriptor: NeuralModelDescriptor,
        onProgress: (Long, Long?) -> Unit = { _, _ -> }
    ): Result<File> = withContext(Dispatchers.IO) {
        val stagingDir = File(context.filesDir, "neural-staging")
        var staging: File? = null
        try {
            require(descriptor.validate()) { "Invalid model descriptor" }
            require(stagingDir.isDirectory || stagingDir.mkdirs()) { "Cannot create staging directory" }
            val request = Request.Builder().url(descriptor.downloadUrl).get().build()
            val response = client.newCall(request).execute()
            response.use { res ->
                if (res.request.url.scheme != "https") throw SecurityException("Non-HTTPS redirect rejected")
                if (!res.isSuccessful) throw IOException("HTTP ${res.code}")
                val body = res.body ?: throw IOException("Empty model response")
                val expected = body.contentLength().takeIf { it >= 0L }
                if (expected != null && expected > stagingDir.usableSpace) {
                    throw IOException("Insufficient storage")
                }
                staging = File.createTempFile("neural-", ".part", stagingDir)
                var count = 0L
                body.byteStream().use { input ->
                    staging!!.outputStream().buffered().use { output ->
                        val buffer = ByteArray(64 * 1024)
                        while (true) {
                            coroutineContext.ensureActive()
                            val n = input.read(buffer)
                            if (n == -1) break
                            count += n
                            if (n.toLong() > stagingDir.usableSpace) {
                                throw IOException("Storage exhausted")
                            }
                            output.write(buffer, 0, n)
                            onProgress(count, expected)
                        }
                        output.flush()
                    }
                }
                if (expected != null && count != expected) throw IOException("Incomplete download")
            }
            coroutineContext.ensureActive()
            val file = staging ?: throw IOException("Missing staging file")
            if (!NeuralModelIntegrity.verifySha256(file, descriptor.sha256)) {
                throw SecurityException("SHA-256 mismatch")
            }
            NeuralModelStore(context).importVerified(file, descriptor).getOrThrow()
                .let { Result.success(it) }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: Exception) {
            Result.failure(error)
        } finally {
            staging?.delete()
        }
    }
}
