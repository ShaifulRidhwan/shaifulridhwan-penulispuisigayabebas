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

data class ChatTurn(
    val role: String,
    val content: String,
    val provider: String? = null,
    val complete: Boolean = true,
    val id: String = UUID.randomUUID().toString()
)

data class ChatResponse(val reply: String, val provider: String?, val model: String?)

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
                    model = frame.optString("model").takeIf { it.isNotBlank() }
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

    suspend fun chatStream(
        question: String,
        mode: String,
        history: List<ChatTurn>,
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
            // Future backend versions can honor the native-Android UI contract.
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
