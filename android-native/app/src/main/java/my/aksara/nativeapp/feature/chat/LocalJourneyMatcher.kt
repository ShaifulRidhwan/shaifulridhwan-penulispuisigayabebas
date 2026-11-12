package my.aksara.nativeapp.feature.chat

import java.text.Normalizer
import kotlin.math.min

/**
 * Deterministic offline matching for the curated Aksara journey.
 * Never silently substitute a low-confidence answer for an online response.
 */
internal object LocalJourneyMatcher {
    private val aliases = mapOf(
        "sape" to "siapa", "sapa" to "siapa", "syape" to "siapa",
        "ko" to "kau", "kow" to "kau", "awk" to "awak",
        "ape" to "apa", "ap" to "apa", "camne" to "macam mana",
        "cmne" to "macam mana", "mcm" to "macam",
        "dgn" to "dengan", "yg" to "yang", "pasal" to "tentang",
        "ak" to "aku", "aq" to "aku", "tk" to "tak",
        "x" to "tak", "da" to "dah", "dh" to "dah",
        "ai" to "a i", "aksra" to "aksara"
    )
    private val fillers = setOf("weh", "wei", "eh", "lah", "la", "tolong", "cuba", "boleh", "tak", "kau")
    private fun tokens(input: String): List<String> {
        val ascii = Normalizer.normalize(input.lowercase(), Normalizer.Form.NFKD)
            .replace(Regex("[\\p{M}]"), "")
        return Regex("[a-z0-9]+").findAll(ascii).map { it.value }
            .flatMap { (aliases[it] ?: it).split(" ") }
            .filter { it !in fillers }.toList()
    }
    fun normalize(input: String): String = tokens(input).joinToString(" ")
    private fun distance(a: String, b: String): Int {
        if (a == b) return 0
        var previous = IntArray(b.length + 1) { it }
        for (i in a.indices) {
            val next = IntArray(b.length + 1)
            next[0] = i + 1
            for (j in b.indices) {
                next[j + 1] = min(min(next[j] + 1, previous[j + 1] + 1),
                    previous[j] + if (a[i] == b[j]) 0 else 1)
            }
            previous = next
        }
        return previous[b.length]
    }
    /** Only resolve elliptical choices when the visible prior assistant message provides options. */
    fun followUpChoice(input: String, previousAssistant: String): String? {
        val query = normalize(input)
        val selection = when {
            Regex("\\b(kedua|ke 2|nombor 2|pilihan 2|number 2)\\b").containsMatchIn(query) -> 2
            Regex("\\b(pertama|ke 1|nombor 1|pilihan 1|number 1)\\b").containsMatchIn(query) -> 1
            Regex("\\b(ketiga|ke 3|nombor 3|pilihan 3|number 3)\\b").containsMatchIn(query) -> 3
            else -> return null
        }
        val option = Regex("(?m)^\\s*\\*{0,2}([1-9])[.)]\\s+(.+?)\\s*$")
            .findAll(previousAssistant)
            .firstOrNull { it.groupValues[1].toInt() == selection }
        return option?.groupValues?.get(2)?.trim()?.takeIf { it.length in 2..120 }
    }
    fun match(input: String, questions: List<String>): Int? {
        val query = normalize(input)
        if (query.isBlank()) return null
        val normalized = questions.map(::normalize)
        val exact = normalized.indexOf(query)
        if (exact >= 0) return exact
        // Require meaningful overlap. A single generic word is not enough.
        val qTokens = query.split(" ").toSet()
        if (qTokens.size < 2) return null
        val candidates = normalized.mapIndexedNotNull { index, title ->
            val t = title.split(" ").toSet()
            val intersection = qTokens.intersect(t).size
            val overlap = intersection.toDouble() / maxOf(qTokens.size, t.size)
            val edit = distance(query, title)
            val typo = if (query.length >= 9 && edit <= 2) 0.90 else 0.0
            val score = maxOf(overlap, typo)
            if (intersection >= 2 || typo > 0) index to score else null
        }.sortedByDescending { it.second }
        val best = candidates.firstOrNull() ?: return null
        // Ambiguous matches are rejected, not guessed.
        if (best.second < 0.88) return null
        if (candidates.size > 1 && best.second - candidates[1].second < 0.12) return null
        return best.first
    }
}
