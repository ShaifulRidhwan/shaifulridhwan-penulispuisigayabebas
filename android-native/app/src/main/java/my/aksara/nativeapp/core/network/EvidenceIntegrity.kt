package my.aksara.nativeapp.core.network

/**
 * A source link is not proof that a page was read, or that a factual claim is correct.
 * Never promote unverified model/tool metadata into a stronger evidence label.
 */
object EvidenceIntegrity {
    private val pageTools=setOf("owned_page_html","tavily_extract","url_context")
    private val searchTools=setOf("google_search","browser_search","groq_browser_search",
        "tavily_search","publisher_rss","wikipedia_summary")
    fun normalizeLevel(reported:String,toolsUsed:List<String>,sourceCount:Int):String {
        if(sourceCount<=0)return "no_external_evidence"
        val tools=toolsUsed.toSet()
        val page=tools.any { it in pageTools }
        val grounded="google_search" in tools
        val search=tools.any { it in searchTools }
        return when(reported) {
            "page_text" -> when {
                page -> "page_text"
                grounded -> "grounded_search"
                search -> "search_excerpt"
                else -> "links_only"
            }
            "grounded_search" -> if(grounded) "grounded_search"
                else if(search) "search_excerpt" else "links_only"
            "search_excerpt" -> if(search) "search_excerpt" else "links_only"
            else -> "links_only"
        }
    }
    fun formatSources(sources:List<Pair<String,String>>,evidenceLevel:String):String {
        if(sources.isEmpty())return ""
        val lines=sources.joinToString("\n") { (title,url) ->
            val safeTitle=title.replace(Regex("""[\[\]()\r\n\t]""")," ")
                .replace('\\',' ').replace(Regex("""\s+""")," ").trim().take(180).ifBlank { "Sumber" }
            val safeUrl=url.replace("(", "%28").replace(")", "%29")
            "[$safeTitle]($safeUrl)"
        }
        val disclaimer=if(evidenceLevel=="links_only")
            "\n\n_Pautan rujukan sahaja. Kandungan laman belum disahkan._" else ""
        return "\n\n"+lines+disclaimer
    }
}
