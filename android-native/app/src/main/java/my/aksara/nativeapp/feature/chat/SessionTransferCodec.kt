package my.aksara.nativeapp.feature.chat

import my.aksara.nativeapp.core.storage.Message
import my.aksara.nativeapp.core.storage.SessionSnapshot
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/**
 * Explicit user-controlled plaintext exchange. Encrypted local storage is untouched
 * until a complete and validated import is committed using the archive mutex.
 * Raw attachment bytes, signed upload receipts, memory and secrets are not exported.
 */
internal object SessionTransferCodec {
    const val MIME = "application/json"
    const val MAX_BYTES = 12_000_000
    private const val FORMAT = "aksara.native.session-export.v1"

    fun encode(archive: List<Message>, starts: List<String>): String {
        val sessions = groupSessions(archive,starts)
        return JSONObject().put("format",FORMAT)
            .put("conversations",JSONArray().apply {
                sessions.forEach { session ->
                    put(JSONArray().apply { session.messages.forEach { m ->
                        put(JSONObject().put("role",m.role).put("text",m.text)
                            .put("at",m.at).put("incomplete",m.incomplete)
                            .put("provider",m.provider ?: JSONObject.NULL))
                    } })
                }
            }).toString()
    }

    fun decode(text: String): SessionSnapshot {
        require(text.toByteArray(Charsets.UTF_8).size <= MAX_BYTES) {
            "Fail import melebihi 12 MB."
        }
        val root=try { JSONObject(text) } catch(e: Exception) {
            throw IllegalArgumentException("Fail bukan JSON arkib AKSARA yang sah.",e)
        }
        require(root.optString("format")==FORMAT) { "Format arkib bukan AKSARA v1." }
        val sessions=root.getJSONArray("conversations")
        require(sessions.length() in 1..1000) { "Jumlah sesi dalam arkib tidak sah." }
        val messages=ArrayList<Message>()
        val starts=ArrayList<String>()
        for(i in 0 until sessions.length()) {
            val rows=sessions.getJSONArray(i)
            require(rows.length() in 1..8000 && messages.size+rows.length()<=8000) {
                "Arkib melebihi had import 8,000 mesej."
            }
            var firstId=""
            for(j in 0 until rows.length()) {
                val row=rows.getJSONObject(j)
                val role=row.getString("role")
                require(role=="user" || role=="assistant") { "Peranan mesej tidak sah." }
                val content=row.getString("text")
                require(content.length <= 100_000) { "Mesej melebihi had import." }
                val id=UUID.randomUUID().toString()
                if(firstId.isBlank())firstId=id
                val time=row.optLong("at",System.currentTimeMillis()).coerceIn(0L,System.currentTimeMillis()+86_400_000L)
                val provider=row.optString("provider").takeIf {
                    it.matches(Regex("[A-Za-z0-9_.-]{1,64}"))
                }
                messages.add(Message(id,role,content,time,row.optBoolean("incomplete",false),provider))
            }
            starts.add(firstId)
        }
        return SessionSnapshot(messages,starts)
    }
}
