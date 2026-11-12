package my.aksara.nativeapp.core.neural

import android.content.Context
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.coroutineContext

/** Downloads restart from zero. Partial files never become installed models. */
@OptIn(kotlinx.coroutines.InternalCoroutinesApi::class)
class NeuralModelDownloader(private val store: NeuralModelStore, private val client: OkHttpClient = OkHttpClient.Builder()
    .connectTimeout(30, TimeUnit.SECONDS).readTimeout(60, TimeUnit.SECONDS).build()) {
    constructor(context: Context) : this(NeuralModelStore(context))
    suspend fun download(descriptor: NeuralModelDescriptor, onProgress: (Long, Long?) -> Unit = { _, _ -> }): Result<File> = withContext(Dispatchers.IO) {
        require(descriptor.validate()) { "Invalid model descriptor" }
        val call = client.newCall(Request.Builder().url(descriptor.downloadUrl).build())
        // Invoke at cancellation, including a blocked socket read, rather than at job completion.
        val watcher = coroutineContext[Job]?.invokeOnCompletion(onCancelling = true, invokeImmediately = true) { if (it != null) call.cancel() }
        try {
            call.execute().use { response ->
                check(response.request.url.isHttps) { "Insecure redirect rejected" }
                if (response.code != 200) throw IOException("HTTP ${response.code}; retry the download")
                val body = response.body ?: throw IOException("Empty response")
                val length = body.contentLength()
                require(length < 0 || length == descriptor.sizeBytes) { "Publisher file size mismatch" }
                Result.success(store.importStream(body.byteStream(), descriptor, coroutineContext, onProgress))
            }
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (error: Exception) { Result.failure(error) }
        finally { watcher?.dispose() }
    }
}
