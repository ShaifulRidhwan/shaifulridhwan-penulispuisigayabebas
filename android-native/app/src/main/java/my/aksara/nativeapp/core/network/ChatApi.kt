package my.aksara.nativeapp.core.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.flowOn
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

sealed interface ChatEvent {
    data class Delta(val text: String) : ChatEvent
    data class Done(val reply: String, val provider: String, val sources: List<Pair<String, String>>,
        val model: String = "", val researchStatus: String = "", val toolsUsed: List<String> = emptyList(),
        val evidenceLevel: String = "no_external_evidence", val outputFormat: String = "") : ChatEvent
}
class ApiFailure(val status: Int, message: String, val retryAfter: String? = null) : IOException(message)
object Ndjson {
    fun parse(line: String): ChatEvent? {
        if (line.isBlank()) return null
        val item = try { JSONObject(line) } catch (e: Exception) { throw IOException("Aliran respons tidak lengkap.", e) }
        return when (item.optString("type")) {
            "delta" -> ChatEvent.Delta(item.getString("text"))
            "done" -> {
                val reply = item.optString("reply").ifBlank { throw IOException("Jawapan pelayan kosong.") }
                val refs = item.optJSONArray("sources") ?: JSONArray()
                val urls = (0 until refs.length()).mapNotNull { i ->
                    refs.optJSONObject(i)?.let { s -> s.optString("url").takeIf { uri ->
                        runCatching {
                            val u = java.net.URI(uri)
                            u.scheme == "https" && u.host != null && u.userInfo == null
                        }.getOrDefault(false)
                    }?.let { link -> s.optString("title", link).take(180) to link } }
                }
                val tools = item.optJSONArray("toolsUsed") ?: JSONArray()
                ChatEvent.Done(reply, item.optString("provider").take(64), urls,
                    model = item.optString("model").take(100),
                    researchStatus = item.optString("researchStatus").take(65),
                    toolsUsed = (0 until tools.length()).mapNotNull { index ->
                        tools.optString(index).takeIf { it.isNotBlank() }?.take(70)
                    },
                    evidenceLevel = item.optJSONObject("evidenceProfile")?.optString("level")?.take(60)
                        ?: "no_external_evidence",
                    outputFormat = item.optString("outputFormat").take(30)
                )
            }
            "error" -> throw ApiFailure(item.optInt("status", 502), item.optString("error", "Permintaan gagal."),
                item.optInt("retryAfterSeconds",0).takeIf { it>0 }?.toString())
            else -> null // forward-compatible heartbeat / metadata frames
        }
    }
}
private fun retryAfter(response: Response, payload: JSONObject): String? =
    payload.optInt("retryAfterSeconds", 0).takeIf { it > 0 }?.toString()
        ?: response.header("Retry-After")

class ChatApi(val origin: String, private val client: OkHttpClient = OkHttpClient.Builder()
    .connectTimeout(20, TimeUnit.SECONDS).readTimeout(165, TimeUnit.SECONDS).callTimeout(170, TimeUnit.SECONDS).build()) {
    private fun request(path: String, payload: JSONObject) = Request.Builder().url(origin + path)
        .header("Origin", origin).header("Accept", "application/x-ndjson, application/json")
        .post(payload.toString().toRequestBody("application/json".toMediaType())).build()
    suspend fun post(path: String, payload: JSONObject): JSONObject = kotlinx.coroutines.suspendCancellableCoroutine { continuation ->
        val call=client.newCall(request(path,payload))
        continuation.invokeOnCancellation { call.cancel() }
        call.enqueue(object:Callback {
            override fun onFailure(call:Call,e:IOException){if(continuation.isActive)continuation.resumeWith(Result.failure(e))}
            override fun onResponse(call:Call,response:Response){
                val result=runCatching {response.use { res ->
                    val data=try{JSONObject(res.body?.string().orEmpty())}catch(_:Exception){JSONObject()}
                    if(!res.isSuccessful)throw ApiFailure(res.code,data.optString("error","HTTP ${res.code}"),retryAfter(res,data))
                    data
                }}
                if(continuation.isActive)continuation.resumeWith(result)
            }
        })
    }
    fun chat(payload: JSONObject): Flow<ChatEvent> = callbackFlow {
        var call: Call? = null
        val work = kotlinx.coroutines.CoroutineScope(Dispatchers.IO).launchSafely(
            onError = { close(it) },
            block = {
                call = client.newCall(request("/.netlify/functions/bilik-antara-stream", payload))
                val response = call!!.execute()
                response.use { res ->
                    if (res.code in listOf(404, 405, 501)) {
                        // An explicit unsupported route can safely fall back before inference.
                        val result = post("/.netlify/functions/bilik-antara", payload)
                        send(Ndjson.parse(JSONObject(result.toString()).put("type","done").toString())!!)
                        close(); return@launchSafely
                    }
                    if (res.isSuccessful && !res.header("Content-Type").orEmpty().contains("application/x-ndjson",ignoreCase=true)) {
                        // A successful JSON response may ALREADY have run the model. Never replay it.
                        val data=runCatching { JSONObject(res.body?.string().orEmpty()) }
                            .getOrElse { throw IOException("Pelayan tidak memulangkan NDJSON atau JSON yang sah.") }
                        if(data.optString("reply").isBlank())throw IOException("Pelayan memulangkan respons tanpa jawapan.")
                        send(Ndjson.parse(data.put("type","done").toString())!!)
                        close(); return@launchSafely
                    }
                    if (!res.isSuccessful) {
                        val body = runCatching { JSONObject(res.body?.string().orEmpty()) }.getOrDefault(JSONObject())
                        throw ApiFailure(res.code, body.optString("error", "HTTP ${res.code}"), retryAfter(res,body))
                    }
                    val source = res.body?.source() ?: throw IOException("Aliran respons kosong.")
                    var done = false; var chars = 0
                    while (!source.exhausted()) {
                        // readUtf8LineStrict bounds a malformed or unbounded frame.
                        val line = try { source.readUtf8LineStrict(500_000) } catch(e: java.io.EOFException) {
                            if(source.buffer.size in 1..500_000) source.buffer.readUtf8() else throw e
                        }
                        val event = Ndjson.parse(line)
                        if (event is ChatEvent.Delta) { chars += event.text.length; if (chars > 40_000) throw IOException("Jawapan melebihi had.") }
                        if (event != null) send(event)
                        if (event is ChatEvent.Done) { done = true; break }
                    }
                    if (!done) throw IOException("Jawapan terputus sebelum habis.")
                    close()
                }
            }
        )
        awaitClose { call?.cancel(); work.cancel() }
    }.flowOn(Dispatchers.IO)
}
private fun kotlinx.coroutines.CoroutineScope.launchSafely(onError: (Throwable) -> Unit, block: suspend () -> Unit) =
    launch(context = coroutineContext) { try { block() } catch (e: Throwable) { onError(e) } }
