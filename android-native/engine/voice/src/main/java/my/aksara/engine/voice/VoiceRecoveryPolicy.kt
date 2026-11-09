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

    /**
     * Conservative guard for obviously off-locale ASR hypotheses.
     * Malay can contain English technical terms, so never reject a single loanword.
     * This is deliberately not advertised as precise language identification.
     */
    fun suspectUnsupportedTranscript(text: String): Boolean {
        if (text.isBlank()) return false
        if (Regex("""[\p{IsHiragana}\p{IsKatakana}\p{IsHan}\p{IsHangul}\p{IsCyrillic}]""").containsMatchIn(text)) return true
        val lower = text.lowercase(java.util.Locale.ROOT)
        // Explicit Malay framing may quote an otherwise foreign example.
        if (Regex("""\b(?:apa|maksud|terjemah|ayat|bahasa|tolong|boleh|aku|kau|saya|nak|yang|dan)\b""").containsMatchIn(lower)) return false
        // Strong Portuguese patterns were observed in real ms-MY Gemini Live ASR drift.
        // "de chinelo" or "eu tô" in a short snippet should not be accepted as Malay.
        if (Regex("""\b(?:de\s+chinelo|eu\s+t[oô]|ainda\s+a\s+teste|n[aã]o\s+sei|n[aã]o\s+entendo)\b""")
                .containsMatchIn(lower)) return true
        val portuguese = Regex("""\b(?:chinelo|ainda|estou|voc[eê]|obrigado|obrigada|muito|tudo|ent[aã]o|tamb[eé]m|deu|t[oô]|n[aã]o|eu)\b""")
            .findAll(lower).map { it.value }.distinct().count()
        if (portuguese >= 3) return true
        val spanish = Regex("""\b(?:con|agua|hola|quiero|puedes|estoy|usted|buenos|dias|gracias|español|hablando|entiendo|muchas|por|favor)\b""")
            .findAll(lower).map { it.value }.distinct().count()
        return spanish >= 2
    }

    fun explicitForeignLanguageRequest(text: String): Boolean =
        Regex("""(?i)\b(?:tolong|sila|cuba|boleh)\b.{0,70}\b(?:cakap|jawab|terjemah|translate)\b.{0,60}\b(?:bahasa|language)\b""")
            .containsMatchIn(text)

    fun suspectSpanish(text: String): Boolean {
        // Conservative fallback. A lone shared word must not trigger a new socket.
        val cues = Regex("(?i)\\b(?:gracias|estoy|puedes|nosotros|ustedes|entiendo|español|hablando|quieres|también|siguiente)\\b")
        return cues.findAll(text).map { it.value.lowercase() }.distinct().count() >= 2
    }
}
