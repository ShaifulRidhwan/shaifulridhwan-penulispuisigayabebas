package my.aksara.ai.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

data class SavedChat(
    val messages: List<ChatTurn>,
    val mode: String,
    val saveEnabled: Boolean
)

/**
 * Private, local-only conversation storage. No backup, sync or external files.
 * Saving can be disabled; opting out deletes previously persisted turns.
 */
class ChatStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(
        "aksara_android_chat_v2", Context.MODE_PRIVATE
    )

    fun load(): SavedChat {
        val enabled = prefs.getBoolean("save_enabled", true)
        val mode = prefs.getString("mode", "cahaya")
            ?.takeIf { it == "cahaya" || it == "gelap" } ?: "cahaya"
        if (!enabled) return SavedChat(emptyList(), mode, false)
        val raw = prefs.getString("turns", null) ?: return SavedChat(emptyList(), mode, true)
        return runCatching {
            val entries = JSONArray(raw)
            val turns = buildList {
                for (i in 0 until minOf(entries.length(), 80)) {
                    val entry = entries.optJSONObject(i) ?: continue
                    val role = entry.optString("role")
                    val content = entry.optString("content")
                    if (role !in listOf("user", "assistant") || content.isBlank()) continue
                    add(
                        ChatTurn(
                            role = role,
                            content = content.take(24_000),
                            provider = entry.optString("provider")
                                .takeIf { it.isNotBlank() },
                            complete = entry.optBoolean("complete", true)
                        )
                    )
                }
            }
            SavedChat(turns, mode, true)
        }.getOrElse { SavedChat(emptyList(), mode, true) }
    }

    fun persist(messages: List<ChatTurn>, mode: String, enabled: Boolean) {
        val edit = prefs.edit()
            .putBoolean("save_enabled", enabled)
            .putString("mode", mode)
        if (!enabled) {
            edit.remove("turns").apply()
            return
        }
        val entries = JSONArray()
        messages.takeLast(80).forEach { turn ->
            entries.put(
                JSONObject()
                    .put("role", turn.role)
                    .put("content", turn.content.take(24_000))
                    .put("provider", turn.provider ?: "")
                    .put("complete", turn.complete)
            )
        }
        edit.putString("turns", entries.toString()).apply()
    }

    fun clear() {
        prefs.edit().remove("turns").apply()
    }
}
