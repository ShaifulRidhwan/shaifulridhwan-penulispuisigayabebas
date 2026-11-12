package my.aksara.nativeapp.feature.chat

/**
 * Session-only follow-up resolver. No persistent memory, no speculative answers.
 * Only extends a previous explicit topic when a narrow follow-up is detected.
 */
internal object LocalReasoningEngine {
    private val followUps = setOf(
        "kenapa", "macam mana", "jelaskan lagi", "cerita lagi",
        "terangkan lagi", "sambung tadi", "lebih detail", "detail sikit"
    )
    fun contextualQuery(question: String, previousUser: String?): String? {
        val q = LocalJourneyMatcher.normalize(question)
        if (q !in followUps || previousUser.isNullOrBlank()) return null
        val previous = LocalJourneyMatcher.normalize(previousUser)
        if (previous.isBlank() || previous.length > 140 || previous == q) return null
        return previous
    }
    fun correctionQuery(question: String): String? {
        val cleaned = question.trim()
        val prefix = Regex("^(?:bukan\\s+(?:tu|itu)[,.:!]?\\s*|maksud\\s+aku[,.:!]?\\s*|aku\\s+maksudkan[,.:!]?\\s*)", RegexOption.IGNORE_CASE)
        val match = prefix.find(cleaned) ?: return null
        return cleaned.substring(match.range.last + 1).trim().takeIf { it.length >= 5 }
    }
}
