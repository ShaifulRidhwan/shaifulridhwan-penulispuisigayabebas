package my.aksara.nativeapp.core.network

import android.content.Context
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import my.aksara.nativeapp.core.platform.Attachment
import my.aksara.nativeapp.core.platform.UploadCandidate
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okio.BufferedSink
import org.json.JSONObject
import java.io.IOException
import java.net.URI
import java.util.concurrent.TimeUnit

/**
 * Gemini Files resumable upload. The Netlify broker holds the API key and
 * returns a short-lived capability URL; file bytes NEVER go through Netlify.
 */
class LargeUploadClient(
    private val origin:String=BackendRoutes.configuredOrigin,
    private val client:OkHttpClient=OkHttpClient.Builder()
        .connectTimeout(25,TimeUnit.SECONDS)
        .readTimeout(5,TimeUnit.MINUTES)
        .writeTimeout(5,TimeUnit.MINUTES)
        .callTimeout(6,TimeUnit.MINUTES)
        .build()
) {
    private fun broker(payload:JSONObject):JSONObject {
        val request=Request.Builder().url(origin+BackendRoutes.LARGE_UPLOAD)
            .header("Origin",origin)
            .header("Cache-Control","no-store")
            .post(payload.toString().toRequestBody("application/json".toMediaType())).build()
        client.newCall(request).execute().use { response ->
            val text=response.body?.string().orEmpty()
            val body=runCatching{JSONObject(text)}.getOrDefault(JSONObject())
            if(!response.isSuccessful)throw IOException(
                body.optString("error").ifBlank{"Upload backend HTTP ${response.code}"})
            return body
        }
    }

    suspend fun upload(
        context:Context, uri:Uri, file:UploadCandidate,
        onProgress:(Int)->Unit={}
    ):Attachment=withContext(Dispatchers.IO) {
        val start=broker(JSONObject().put("action","start")
            .put("name",file.name).put("mimeType",file.mimeType)
            .put("sizeBytes",file.sizeBytes))
        val uploadUrl=start.getString("uploadUrl")
        val parsed=URI(uploadUrl)
        require(parsed.scheme=="https"&&parsed.host=="generativelanguage.googleapis.com"&&
            parsed.userInfo==null){"URL upload Google tidak sah."}
        val ticket=start.getString("ticket")
        val contextJob=currentCoroutineContext()
        val body=object:RequestBody(){
            override fun contentType()=file.mimeType.toMediaType()
            override fun contentLength():Long=file.sizeBytes
            override fun writeTo(sink:BufferedSink) {
                val stream=context.contentResolver.openInputStream(uri)
                    ?:throw IOException("Lampiran tidak dapat dibaca semula.")
                stream.use { input ->
                    val buffer=ByteArray(256*1024)
                    var uploaded=0L
                    var reported=-1
                    while(true) {
                        contextJob.ensureActive()
                        val n=input.read(buffer)
                        if(n<0)break
                        if(n==0)continue
                        uploaded+=n
                        if(uploaded>file.sizeBytes)throw IOException("Saiz lampiran berubah semasa upload.")
                        sink.write(buffer,0,n)
                        val percent=(uploaded*100L/file.sizeBytes).toInt()
                        if(percent!=reported){reported=percent;onProgress(percent)}
                    }
                    if(uploaded!=file.sizeBytes)throw IOException("Lampiran tidak lengkap. Pilih semula.")
                }
            }
        }
        val uploadRequest=Request.Builder().url(uploadUrl).post(body)
            .header("X-Goog-Upload-Offset","0")
            .header("X-Goog-Upload-Command","upload, finalize")
            .header("Cache-Control","no-store").build()
        val uploaded=client.newCall(uploadRequest).execute().use { response ->
            val json=runCatching{JSONObject(response.body?.string().orEmpty())}.getOrDefault(JSONObject())
            if(!response.isSuccessful)throw IOException(
                "Gemini gagal menerima fail (HTTP ${response.code}). Cuba semula.")
            json.optJSONObject("file")
                ?:throw IOException("Gemini tidak memulangkan metadata fail selepas upload.")
        }
        val fileName=uploaded.optString("name")
        require(Regex("^files/[A-Za-z0-9_-]{8,180}$").matches(fileName)){
            "Gemini tidak memulangkan nama fail yang sah."
        }
        repeat(35){ attempt ->
            currentCoroutineContext().ensureActive()
            val result=broker(JSONObject().put("action","verify")
                .put("ticket",ticket).put("name",fileName))
            when(result.optString("status")){
                "ready"->return@withContext Attachment(
                    name=file.name,receipt=result.getString("receipt"),sizeBytes=file.sizeBytes)
                "processing"-> {
                    onProgress(100)
                    delay(if(attempt<10)1500 else 2500)
                }
                else->throw IOException("Status pemprosesan Gemini tidak diketahui.")
            }
        }
        throw IOException("Gemini masih memproses lampiran. Cuba fail lebih pendek atau muat naik semula.")
    }

    suspend fun delete(receipt:String)=withContext(Dispatchers.IO){
        runCatching { broker(JSONObject().put("action","delete").put("receipt",receipt)) }
        Unit
    }
}
