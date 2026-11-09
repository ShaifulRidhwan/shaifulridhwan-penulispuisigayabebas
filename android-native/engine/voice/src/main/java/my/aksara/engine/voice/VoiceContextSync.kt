package my.aksara.engine.voice

/**
 * Browser Voice Core V3 equivalent for bounded, in-memory conversational context.
 * These are user/model DATA, never extra system instructions or persisted transcripts.
 */
data class VoiceContextTurn(val role: String, val content: String)

object VoiceContextSync {
    /** Only completed transcript data can be handed back to the chat session. */
    fun completedTurns(input: String, output: String, languageDrift: Boolean): List<VoiceContextTurn> = buildList {
        // The entire turn is untrusted when either input ASR or output language drifted.
        // Saving just its malformed user half poisons future Chat and reconnect context.
        if (!languageDrift) {
            if (input.isNotBlank()) add(VoiceContextTurn("user", input.trim()))
            if (output.isNotBlank()) add(VoiceContextTurn("assistant", output.trim()))
        }
    }
    private fun clean(value: String): String =
        value.replace(Regex("[\\r\\n\\t]+"), " ").replace(Regex("\\s+"), " ").trim()

    /** Merge Live transcription fragments without repeating overlapping words. */
    fun mergeTranscript(previous: String, incoming: String, maxChars: Int = 2800): String {
        val limit = maxChars.coerceIn(400, 6000)
        val before = clean(previous)
        val after = clean(incoming)
        if (after.isEmpty()) return before.takeLast(limit)
        if (before.isEmpty() || after.startsWith(before)) return after.takeLast(limit)
        if (before.startsWith(after)) return before.takeLast(limit)
        if (before.endsWith(after) || (before.contains(after) && after.length >= 16))
            return before.takeLast(limit)
        val overlap = (minOf(before.length, after.length) downTo 1)
            .firstOrNull { before.endsWith(after.take(it)) } ?: 0
        return (if (overlap > 0) before + after.drop(overlap) else before + " " + after).takeLast(limit)
    }

    private fun quoteJson(value: String): String = buildString {
        append('"')
        value.forEach { character ->
            when (character) {
                '"' -> append("\\\"")
                '\\' -> append("\\\\")
                '\n' -> append("\\n")
                '\r' -> append("\\r")
                '\t' -> append("\\t")
                else -> if (character.code < 32) append("\\u%04x".format(character.code))
                    else append(character)
            }
        }
        append('"')
    }

    /** Recent chat and Voice turns, kept as complete valid JSON even at the char cap. */
    fun snapshot(turns: List<VoiceContextTurn>, limit: Int = 12, maxChars: Int = 4600): String {
        val budget = maxChars.coerceIn(400, 6000)
        val recent = turns.takeLast(limit.coerceIn(1, 24))
            .filter { it.role == "user" || it.role == "assistant" }
            .mapNotNull { turn ->
                val content = clean(turn.content).take(450)
                if (content.isBlank()) null
                else "{\"role\":\"" + turn.role + "\",\"content\":" + quoteJson(content) + "}"
            }
        val keep = mutableListOf<String>()
        var length = 2
        for (entry in recent.asReversed()) {
            val extra = entry.length + if (keep.isEmpty()) 0 else 1
            if (length + extra <= budget) {
                keep += entry
                length += extra
            }
        }
        return "[" + keep.asReversed().joinToString(",") + "]"
    }
}
