package my.aksara.ai.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

private const val MAX_SESSIONS = 12
private const val MAX_TURNS = 70
private const val MAX_CONTENT = 24_000

data class ChatSession(
    val id: String = UUID.randomUUID().toString(),
    val title: String = "Sesi Baharu",
    val mode: String = "cahaya",
    val messages: List<ChatTurn> = emptyList(),
    val summary: String = "",
    val pinned: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)

data class SavedWorkspace(
    val sessions: List<ChatSession>,
    val activeId: String,
    val saveEnabled: Boolean
)

object SessionCodec {
    fun titleFor(question: String): String =
        question.trim().replace(Regex("""\s+"""), " ").take(54).ifBlank { "Sesi Baharu" }

    fun blank(): ChatSession = ChatSession()

    fun serialize(sessions: List<ChatSession>, activeId: String): String {
        val array = JSONArray()
        sessions.sortedWith(compareByDescending<ChatSession> { it.pinned }
            .thenByDescending { it.updatedAt }).take(MAX_SESSIONS).forEach { session ->
            val turns = JSONArray()
            session.messages.takeLast(MAX_TURNS).forEach { turn ->
                turns.put(
                    JSONObject()
                        .put("id", turn.id)
                        .put("role", turn.role)
                        .put("content", turn.content.take(MAX_CONTENT))
                        .put("provider", turn.provider ?: "")
                        .put("complete", turn.complete)
                        .put("timestamp", turn.timestamp)
                        .put("disclaimer", turn.disclaimer.take(300))
                        .put("sources", JSONArray().apply {
                            turn.sources.take(8).forEach { source ->
                                put(JSONObject().put("title", source.title)
                                    .put("url", source.url))
                            }
                        })
                )
            }
            array.put(
                JSONObject()
                    .put("id", session.id)
                    .put("title", session.title.take(64))
                    .put("mode", session.mode)
                    .put("summary", session.summary.take(4000))
                    .put("pinned", session.pinned)
                    .put("createdAt", session.createdAt)
                    .put("updatedAt", session.updatedAt)
                    .put("turns", turns)
            )
        }
        return JSONObject().put("version", 3)
            .put("activeId", activeId).put("sessions", array).toString()
    }

    fun parse(raw: String, enabled: Boolean): SavedWorkspace {
        if (!enabled) {
            val initial = blank()
            return SavedWorkspace(listOf(initial), initial.id, false)
        }
        val objectRoot = JSONObject(raw)
        require(objectRoot.optInt("version") == 3) { "Unsupported session format" }
        val arr = objectRoot.optJSONArray("sessions") ?: JSONArray()
        val found = mutableListOf<ChatSession>()
        for (i in 0 until minOf(arr.length(), MAX_SESSIONS)) {
            val obj = arr.optJSONObject(i) ?: continue
            val id = obj.optString("id").takeIf { it.isNotBlank() } ?: continue
            if (found.any { it.id == id }) continue
            val mode = obj.optString("mode").takeIf { it == "gelap" } ?: "cahaya"
            val turns = obj.optJSONArray("turns") ?: JSONArray()
            val parsed = mutableListOf<ChatTurn>()
            for (j in maxOf(0, turns.length() - MAX_TURNS) until turns.length()) {
                val entry = turns.optJSONObject(j) ?: continue
                val role = entry.optString("role")
                val content = entry.optString("content")
                if (role !in listOf("user", "assistant") || content.isBlank()) continue
                parsed.add(
                    ChatTurn(
                        role = role,
                        content = content.take(MAX_CONTENT),
                        provider = entry.optString("provider").takeIf { it.isNotBlank() },
                        complete = entry.optBoolean("complete", true),
                        id = entry.optString("id").takeIf { it.isNotBlank() }
                            ?: UUID.randomUUID().toString(),
                        timestamp = entry.optLong("timestamp", System.currentTimeMillis()),
                        sources = AnswerSourceParser.read(entry.optJSONArray("sources")),
                        disclaimer = entry.optString("disclaimer").take(300)
                    )
                )
            }
            found.add(
                ChatSession(
                    id = id,
                    title = obj.optString("title").take(64).ifBlank { "Sesi Baharu" },
                    mode = mode,
                    messages = parsed,
                    summary = obj.optString("summary").take(4000),
                    pinned = obj.optBoolean("pinned", false),
                    createdAt = obj.optLong("createdAt", 0).coerceAtLeast(0),
                    updatedAt = obj.optLong("updatedAt", 0).coerceAtLeast(0)
                )
            )
        }
        if (found.isEmpty()) found.add(blank())
        val active = objectRoot.optString("activeId").takeIf { id -> found.any { it.id == id } }
            ?: found.first().id
        return SavedWorkspace(found, active, true)
    }
}

/**
 * Android-private local sessions, no external files and no cloud backup.
 * Legacy v0.2 history is imported once. Saving OFF purges both generations.
 */
class ChatStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(
        "aksara_android_workspace_v3", Context.MODE_PRIVATE
    )
    private val old = context.applicationContext.getSharedPreferences(
        "aksara_android_chat_v2", Context.MODE_PRIVATE
    )

    fun load(): SavedWorkspace {
        val enabled = prefs.getBoolean(
            "save_enabled", old.getBoolean("save_enabled", true)
        )
        if (!enabled) return SessionCodec.parse("{}", false)
        val current = prefs.getString("workspace_json", null)
        if (current != null) {
            return runCatching { SessionCodec.parse(current, true) }
                .getOrElse { SessionCodec.parse("""{"version":3}""", true) }
        }
        val legacy = old.getString("turns", null)
        val initial = SessionCodec.blank()
        if (legacy == null) return SavedWorkspace(listOf(initial), initial.id, true)
        val migrated = runCatching {
            val turns = JSONArray(legacy)
            val copied = buildList {
                for (i in maxOf(0, turns.length() - MAX_TURNS) until turns.length()) {
                    val item = turns.optJSONObject(i) ?: continue
                    val role = item.optString("role")
                    val content = item.optString("content")
                    if (role !in listOf("user", "assistant") || content.isBlank()) continue
                    add(
                        ChatTurn(
                            role = role,
                            content = content.take(MAX_CONTENT),
                            provider = item.optString("provider").takeIf { it.isNotBlank() },
                            complete = item.optBoolean("complete", true)
                        )
                    )
                }
            }
            initial.copy(
                messages = copied,
                title = copied.firstOrNull { it.role == "user" }
                    ?.content?.let(SessionCodec::titleFor) ?: "Sesi Baharu"
            )
        }.getOrElse { initial }
        val workspace = SavedWorkspace(listOf(migrated), migrated.id, true)
        persist(workspace)
        old.edit().remove("turns").apply()
        return workspace
    }

    fun persist(workspace: SavedWorkspace) {
        val editor = prefs.edit().putBoolean("save_enabled", workspace.saveEnabled)
        if (!workspace.saveEnabled) {
            editor.remove("workspace_json").apply()
            old.edit().remove("turns").putBoolean("save_enabled", false).apply()
        } else {
            editor.putString(
                "workspace_json",
                SessionCodec.serialize(workspace.sessions, workspace.activeId)
            ).apply()
        }
    }
}
