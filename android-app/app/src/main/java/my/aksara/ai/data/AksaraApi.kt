package my.aksara.ai.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

private const val BASE_URL = "https://shaifulridhwan-penulispuisigayabebas.netlify.app"
private const val CHAT_URL = "$BASE_URL/.netlify/functions/bilik-antara"

data class ChatTurn(
    val role: String,
    val content: String,
    val provider: String? = null
)

data class ChatResponse(val reply: String, val provider: String?, val model: String?)

class AksaraApi {
    suspend fun probe(): Boolean = runCatching {
        val data = post(JSONObject().put("probe", true))
        data.optBoolean("ok", false)
    }.getOrDefault(false)

    suspend fun chat(question: String, mode: String, history: List<ChatTurn>): ChatResponse {
        val prior = JSONArray()
        history.takeLast(20).forEach { turn ->
            prior.put(JSONObject().put("role", turn.role).put("content", turn.content))
        }
        val request = JSONObject()
            .put("question", question)
            .put("thoughtMode", mode)
            .put("history", prior)
        val json = post(request)
        val reply = json.optString("reply", "").trim()
        if (reply.isEmpty()) throw IOException("Aksara belum memberikan jawapan. Cuba lagi.")
        return ChatResponse(
            reply = reply,
            provider = json.optString("provider").takeIf { it.isNotBlank() },
            model = json.optString("model").takeIf { it.isNotBlank() }
        )
    }

    private suspend fun post(payload: JSONObject): JSONObject = withContext(Dispatchers.IO) {
        val conn = URL(CHAT_URL).openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "POST"
            conn.connectTimeout = 15_000
            conn.readTimeout = 35_000
            conn.doOutput = true
            conn.instanceFollowRedirects = false
            conn.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            conn.setRequestProperty("Accept", "application/json")
            conn.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
            val status = conn.responseCode
            val stream = if (status in 200..299) conn.inputStream else conn.errorStream
            val raw = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: "{}"
            val body = runCatching { JSONObject(raw) }.getOrElse { JSONObject() }
            if (status !in 200..299) {
                val message = body.optString("error").takeIf { it.isNotBlank() }
                    ?: "Backend tidak tersedia (HTTP $status)."
                throw IOException(message.take(400))
            }
            body
        } finally {
            conn.disconnect()
        }
    }
}
