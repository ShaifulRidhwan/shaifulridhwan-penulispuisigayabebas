package my.aksara.engine.voice

import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

/** Deterministic reconnect and language sanity rules; no tokens or transcripts are persisted. */
object VoiceRecoveryPolicy {
    fun backoffMs(attempt: Int, jitterMs: Long = 0L): Long {
        require(attempt in 1..3) { "At most three retry attempts are permitted." }
        return (800L shl (attempt - 1)) + jitterMs.coerceIn(0L, 249L)
    }

    fun retryAfterSeconds(header: String?, bodySeconds: Long, nowMillis: Long = System.currentTimeMillis()): Long {
        val fromHeader = header?.trim()?.toLongOrNull()
            ?: runCatching {
                val target = ZonedDateTime.parse(header?.trim().orEmpty(), DateTimeFormatter.RFC_1123_DATE_TIME)
                ((target.toInstant().toEpochMilli() - nowMillis + 999L) / 1000L).coerceAtLeast(0L)
            }.getOrNull()
        return (fromHeader ?: bodySeconds).coerceAtLeast(0L).coerceAtMost(86_400L)
    }

    fun suspectSpanish(text: String): Boolean {
        // Conservative fallback. A lone shared word must not trigger a new socket.
        val cues = Regex("(?i)\\b(?:gracias|estoy|puedes|nosotros|ustedes|entiendo|español|hablando|quieres|también|siguiente)\\b")
        return cues.findAll(text).map { it.value.lowercase() }.distinct().count() >= 2
    }
}
