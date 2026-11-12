package my.aksara.nativeapp.feature.chat

import org.json.JSONObject

/**
 * Bundled, source-bounded retrieval. No network and no unverified generative claims.
 * Scores titles and aliases, then returns only vetted facts from the selected entry.
 */
internal object LocalKnowledgeEngine {
    data class Hit(val id: String, val title: String, val answer: String, val confidence: Double)
    private val stop = setOf("apa", "itu", "yang", "tentang", "boleh", "tak", "aku", "kau", "dia", "ni", "tu", "ke", "macam", "mana", "untuk", "dengan")
    private fun tokens(s: String): Set<String> =
        LocalJourneyMatcher.normalize(s).split(" ").filter { it.length > 1 && it !in stop }.toSet()
    fun retrieve(question: String, rawJson: String): Hit? {
        val query = tokens(question)
        if (query.isEmpty()) return null
        val root = JSONObject(rawJson)
        if (root.optInt("schema_version") != 1) return null
        val rows = root.optJSONArray("entries") ?: return null
        val candidates = (0 until rows.length()).mapNotNull { i ->
            val row = rows.optJSONObject(i) ?: return@mapNotNull null
            val aliases = row.optJSONArray("aliases")
            val labels = listOf(row.optString("title")) +
                (0 until (aliases?.length() ?: 0)).map { aliases!!.optString(it) }
            val score = labels.maxOfOrNull { label ->
                val terms = tokens(label)
                if (terms.isEmpty()) 0.0 else {
                    val common = query.intersect(terms).size.toDouble()
                    val precision = common / query.size
                    val recall = common / terms.size
                    if (precision == 0.0 || recall == 0.0) 0.0 else 2 * precision * recall / (precision + recall)
                }
            } ?: 0.0
            if (score <= 0.0) return@mapNotNull null
            val facts = row.optJSONArray("facts") ?: return@mapNotNull null
            val lines = (0 until facts.length()).mapNotNull { facts.optString(it).takeIf(String::isNotBlank) }
            if (lines.isEmpty()) return@mapNotNull null
            Hit(row.optString("id"), row.optString("title"), lines.joinToString("\n\n"), score)
        }.sortedByDescending { it.confidence }
        val best = candidates.firstOrNull() ?: return null
        if (best.confidence < 0.82) return null
        if (candidates.size > 1 && best.confidence - candidates[1].confidence < 0.15) return null
        return best
    }
}
