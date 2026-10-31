package my.aksara.ai.data

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

private const val BASE_URL = "https://shaifulridhwan-penulispuisigayabebas.netlify.app"
private const val CHAT_URL = "$BASE_URL/.netlify/functions/bilik-antara"
private const val STREAM_URL = "$BASE_URL/.netlify/functions/bilik-antara-stream"

data class AnswerSource(
    val title: String,
    val url: String
)

object AnswerSourceParser {
    fun read(items: JSONArray?): List<AnswerSource> {
        if (items == null) return emptyList()
        return buildList {
            for (i in 0 until minOf(items.length(), 8)) {
                val o = items.optJSONObject(i) ?: continue
                val url = o.optString("url")
                if (!url.startsWith("https://") || url.length > 1024) continue
                val title = o.optString("title").take(150).ifBlank { "Sumber " + (i + 1) }
                add(AnswerSource(title, url))
            }
        }
    }
}

data class ChatTurn(
    val role: String,
    val content: String,
    val provider: String? = null,
    val complete: Boolean = true,
    val id: String = UUID.randomUUID().toString(),
    val timestamp: Long = System.currentTimeMillis(),
    val sources: List<AnswerSource> = emptyList(),
    val disclaimer: String = ""
)

data class ChatResponse(
    val reply: String,
    val provider: String?,
    val model: String?,
    val sources: List<AnswerSource> = emptyList(),
    val disclaimer: String = ""
)

data class ChatMedia(val mimeType: String, val data: String, val name: String)
data class ChatRequestOptions(
    val summary: String = "",
    val memoryNotes: String = "",
    val contextFallback: Boolean = false,
    val mediaFallback: Boolean = false,
    val preferredProvider: String = "",
    val documentText: String = "",
    val documentName: String = "",
    val media: List<ChatMedia> = emptyList(),
    val thoughtLedger: List<String> = emptyList()
)
data class ProviderHealth(
    val id: String,
    val status: String,
    val model: String?,
    val latencyMs: Long?,
    val reason: String?,
    val retryAfterSeconds: Int?
)
data class ProviderSnapshot(
    val providers: List<ProviderHealth>,
    val preferred: String,
    val configuredCount: Int,
    val checkedAt: Long,
    val someOnline: Boolean
)

sealed interface StreamEvent {
    data object Started : StreamEvent
    data class Delta(val text: String) : StreamEvent
    data class Done(val response: ChatResponse) : StreamEvent
    data class Failed(val message: String) : StreamEvent
}

object AksaraStreamProtocol {
    fun parse(line: String): StreamEvent? {
        if (line.isBlank()) return null
        if (line.length > 200_000) throw IOException("Respons streaming terlalu besar.")
        val frame = try { JSONObject(line) }
        catch (e: Exception) { throw IOException("Format streaming tidak sah.", e) }
        return when (frame.optString("type")) {
            "start" -> StreamEvent.Started
            "delta" -> StreamEvent.Delta(frame.optString("text", ""))
            "done" -> StreamEvent.Done(
                ChatResponse(
                    reply = frame.optString("reply", ""),
                    provider = frame.optString("provider").takeIf { it.isNotBlank() },
                    model = frame.optString("model").takeIf { it.isNotBlank() },
                    sources = AnswerSourceParser.read(frame.optJSONArray("sources")),
                    disclaimer = frame.optString("disclaimer").take(300)
                )
            )
            "error" -> StreamEvent.Failed(
                frame.optString("error").takeIf { it.isNotBlank() }
                    ?: "Sambungan Aksara terputus."
            )
            else -> null
        }
    }
}

class AksaraApi {
    @Volatile private var activeStream: HttpURLConnection? = null

    fun cancelStream() {
        activeStream?.disconnect()
    }

    suspend fun probe(): Boolean = runCatching {
        val data = post(JSONObject().put("probe", true))
        data.optBoolean("ok", false)
    }.getOrDefault(false)

    suspend fun providerStatus(): ProviderSnapshot {
        val data = post(JSONObject().put("providerStatus", true))
        val list = data.optJSONArray("providers") ?: JSONArray()
        val providers = buildList {
            for (i in 0 until list.length()) {
                val item = list.optJSONObject(i) ?: continue
                val id = item.optString("id")
                if (id.isBlank()) continue
                add(ProviderHealth(
                    id = id,
                    status = item.optString("status", "unknown"),
                    model = item.optString("model").takeIf { it.isNotBlank() },
                    latencyMs = item.optLong("latencyMs", -1).takeIf { it >= 0 },
                    reason = item.optString("reason").takeIf { it.isNotBlank() },
                    retryAfterSeconds = item.optInt("retryAfterSeconds", -1).takeIf { it >= 0 }
                ))
            }
        }
        return ProviderSnapshot(
            providers = providers,
            preferred = data.optString("preferredProvider"),
            configuredCount = data.optInt("configuredCount", providers.size),
            checkedAt = data.optLong("checkedAt", 0),
            someOnline = data.optBoolean("someOnline", false)
        )
    }

    suspend fun summarize(history: List<ChatTurn>, previousSummary: String): String {
        val turns = JSONArray()
        history.filter { it.complete }.takeLast(24).forEach { turn ->
            turns.put(JSONObject().put("role", turn.role).put("content", turn.content.take(24000)))
        }
        val json = post(JSONObject().put("summarize", true)
            .put("summary", previousSummary.take(4000)).put("history", turns))
        return json.optString("summary").take(4000)
            .takeIf { it.isNotBlank() }
            ?: throw IOException("Ringkasan belum tersedia. Sejarah asal tidak dipadam.")
    }

    suspend fun chatStream(
        question: String,
        mode: String,
        history: List<ChatTurn>,
        options: ChatRequestOptions = ChatRequestOptions(),
        onDelta: suspend (String) -> Unit
    ): ChatResponse = withContext(Dispatchers.IO) {
        val prior = JSONArray()
        history
            .filter { it.complete && (it.role == "user" || it.role == "assistant") }
            .takeLast(20)
            .forEach { turn ->
                prior.put(
                    JSONObject()
                        .put("role", turn.role)
                        .put("content", turn.content)
                )
            }
        val request = JSONObject()
            .put("question", question)
            .put("thoughtMode", mode)
            .put("history", prior)
            .put("summary", options.summary.take(4000))
            .put("memoryNotes", options.memoryNotes.take(8000))
            .put("contextFallback", options.contextFallback)
            .put("mediaFallback", options.mediaFallback)
            .put("preferredProvider", options.preferredProvider.take(30))
            .put("documentText", options.documentText.take(100000))
            .put("documentName", options.documentName.take(100))
            .put("thoughtLedger", JSONArray(options.thoughtLedger.takeLast(8)))
            .put("media", JSONArray().apply {
                options.media.take(3).forEach { file ->
                    put(JSONObject().put("mimeType", file.mimeType).put("data", file.data))
                }
            })
            // Platform hint needs to be consumed by backend for exact Android wording.
            .put("clientPlatform", "android")
        val conn = newConnection(STREAM_URL, "application/x-ndjson")
        activeStream = conn
        try {
            writePayload(conn, request)
            val status = conn.responseCode
            if (status !in 200..299) {
                val raw = conn.errorStream?.bufferedReader(Charsets.UTF_8)
                    ?.use { it.readText().take(1200) } ?: ""
                val body = runCatching { JSONObject(raw) }.getOrNull()
                throw IOException(
                    body?.optString("error")?.takeIf { it.isNotBlank() }
                        ?: "Streaming tidak tersedia (HTTP $status)."
                )
            }
            val partial = StringBuilder()
            var final: ChatResponse? = null
            conn.inputStream.bufferedReader(Charsets.UTF_8).use { reader ->
                while (true) {
                    currentCoroutineContext().ensureActive()
                    val line = reader.readLine() ?: break
                    when (val event = AksaraStreamProtocol.parse(line)) {
                        is StreamEvent.Started -> Unit
                        is StreamEvent.Delta -> {
                            if (partial.length + event.text.length > 120_000) {
                                throw IOException("Jawapan melebihi had paparan.")
                            }
                            partial.append(event.text)
                            onDelta(partial.toString())
                        }
                        is StreamEvent.Done -> {
                            final = event.response
                            break
                        }
                        is StreamEvent.Failed -> throw IOException(event.message)
                        null -> Unit
                    }
                }
            }
            currentCoroutineContext().ensureActive()
            val response = final ?: throw IOException(
                "Sambungan streaming terputus sebelum jawapan lengkap."
            )
            if (response.reply.isBlank()) throw IOException(
                "Aksara belum memberikan jawapan lengkap."
            )
            response
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            currentCoroutineContext().ensureActive()
            throw error
        } finally {
            if (activeStream === conn) activeStream = null
            conn.disconnect()
        }
    }

    private fun newConnection(url: String, accepts: String): HttpURLConnection {
        return (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 15_000
            readTimeout = 35_000
            doOutput = true
            instanceFollowRedirects = false
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
            setRequestProperty("Accept", accepts)
        }
    }

    private fun writePayload(conn: HttpURLConnection, payload: JSONObject) {
        conn.outputStream.use {
            it.write(payload.toString().toByteArray(Charsets.UTF_8))
        }
    }

    private suspend fun post(payload: JSONObject): JSONObject = withContext(Dispatchers.IO) {
        val conn = newConnection(CHAT_URL, "application/json")
        try {
            writePayload(conn, payload)
            val status = conn.responseCode
            val stream = if (status in 200..299) conn.inputStream else conn.errorStream
            val raw = stream?.bufferedReader(Charsets.UTF_8)?.use {
                it.readText().take(2000)
            } ?: "{}"
            val body = runCatching { JSONObject(raw) }.getOrElse { JSONObject() }
            if (status !in 200..299) {
                throw IOException(
                    body.optString("error").takeIf { it.isNotBlank() }
                        ?: "Backend tidak tersedia (HTTP $status)."
                )
            }
            body
        } finally {
            conn.disconnect()
        }
    }
}
