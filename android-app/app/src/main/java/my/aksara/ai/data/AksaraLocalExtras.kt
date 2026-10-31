package my.aksara.ai.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

data class AksaraUsageEvent(
    val at: Long,
    val provider: String,
    val durationMs: Long,
    val successful: Boolean
)

object AksaraMemorySelector {
    fun select(question: String, raw: String): String {
        val memo = raw.take(8_000)
        if (memo.length <= 2_800) return memo
        val words = Regex("""[\p{L}\p{N}]{3,}""")
            .findAll(question.lowercase(Locale.forLanguageTag("ms-MY")))
            .map { it.value }.toSet()
        val rows = memo.lines()
        val scored = rows.mapIndexed { index, row ->
            val lower = row.lowercase(Locale.forLanguageTag("ms-MY"))
            val score = words.count { lower.contains(it) }
            Triple(index, row, score)
        }.sortedWith(compareByDescending<Triple<Int, String, Int>> { it.third }
            .thenBy { it.first })
        val chosen = mutableListOf<Pair<Int, String>>()
        var size = 0
        for ((index, row) in scored) {
            if (row.isBlank() || size + row.length > 2_800) continue
            chosen.add(index to row)
            size += row.length + 1
            if (size >= 2_600) break
        }
        return chosen.sortedBy { it.first }.joinToString("\n") { it.second }.take(2_800)
    }
}

/**
 * Local, separate from session history. Memory is not automatically invented or synced.
 * Model fallback opt-ins are disabled by default, matching cautious web semantics.
 */
class AksaraLocalExtras(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(
        "aksara_android_extras_v1", Context.MODE_PRIVATE
    )

    fun workspaceTitle(): String =
        prefs.getString("workspace_title", "")?.take(80).orEmpty()
    fun workspaceContent(): String =
        prefs.getString("workspace_content", "")?.take(12000).orEmpty()
    fun saveWorkspace(title: String, content: String) {
        prefs.edit().putString("workspace_title", title.take(80))
            .putString("workspace_content", content.take(12000)).apply()
    }

    fun note(): String = prefs.getString("memory_note", "")?.take(8_000).orEmpty()
    fun memoryEnabled(): Boolean = prefs.getBoolean("memory_enabled", true)
    fun contextFallback(): Boolean = prefs.getBoolean("context_fallback", false)
    fun imageFallback(): Boolean = prefs.getBoolean("image_fallback", false)
    fun storeNote(value: String) {
        prefs.edit().putString("memory_note", value.take(8_000)).apply()
    }
    fun setMemoryEnabled(value: Boolean) {
        prefs.edit().putBoolean("memory_enabled", value).apply()
    }
    fun setContextFallback(value: Boolean) {
        prefs.edit().putBoolean("context_fallback", value).apply()
    }
    fun setImageFallback(value: Boolean) {
        prefs.edit().putBoolean("image_fallback", value).apply()
    }
    fun clearMemory() {
        prefs.edit().remove("memory_note").apply()
    }

    fun events(): List<AksaraUsageEvent> {
        val raw = prefs.getString("metrics_json", "[]") ?: "[]"
        return runCatching {
            val list = JSONArray(raw)
            buildList {
                for (i in maxOf(0, list.length() - 120) until list.length()) {
                    val row = list.optJSONObject(i) ?: continue
                    add(AksaraUsageEvent(
                        at = row.optLong("at"),
                        provider = row.optString("provider").take(40),
                        durationMs = row.optLong("durationMs").coerceAtLeast(0),
                        successful = row.optBoolean("successful")
                    ))
                }
            }
        }.getOrDefault(emptyList())
    }

    fun record(events: List<AksaraUsageEvent>, save: Boolean) {
        if (!save) {
            clearMetrics()
            return
        }
        val json = JSONArray()
        events.takeLast(120).forEach {
            json.put(JSONObject().put("at", it.at).put("provider", it.provider)
                .put("durationMs", it.durationMs)
                .put("successful", it.successful))
        }
        prefs.edit().putString("metrics_json", json.toString()).apply()
    }

    fun clearMetrics() { prefs.edit().remove("metrics_json").apply() }
}
