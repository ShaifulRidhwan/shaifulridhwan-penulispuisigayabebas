package my.aksara.nativeapp.feature.chat

import my.aksara.nativeapp.core.storage.Message
import my.aksara.nativeapp.core.storage.ThoughtEntry
import org.json.JSONArray
import org.json.JSONObject

/**
 * Android-to-Web Brain request contract. Web Netlify remains authoritative for:
 * Context Manager, Intelligence/Thinking, Multi-AI routing, tools, research,
 * knowledge, evidence grading, hallucination checks, and provider recovery.
 *
 * This class does not provide model instructions, model selection, tool declarations
 * or a competing local reasoning engine. ContextPolicy only chooses a bounded
 * transport window because the existing backend accepts at most 24 history rows.
 */
internal object WebBrainBridge {
    private fun safeHistory(rows: List<Message>): JSONArray = JSONArray().apply {
        rows.forEach { put(JSONObject().put("role", it.role).put("content", it.text)) }
    }

    fun summaryPayload(completed: List<Message>, summary: String): JSONObject =
        JSONObject().put("summarize", true)
            .put("summary", summary.take(4000))
            // Private conversation must never be sent to backup providers without consent.
            .put("contextFallback", false)
            .put("history", safeHistory(completed.filter { !it.incomplete &&
                it.role in setOf("user", "assistant") && it.text.isNotBlank() }.takeLast(24)))

    fun chatPayload(
        question: String,
        completed: List<Message>,
        thoughtMode: String,
        summary: String,
        memoryEnabled: Boolean,
        memoryNotes: String,
        thoughtLedger: List<ThoughtEntry>,
        documentText: String = "",
        documentName: String = "",
        media: JSONArray? = null,
        fileUploads: JSONArray? = null,
        retrievedContext: String = "",
        webResearch: Boolean = false
    ): JSONObject {
        val recent = ContextPolicy.selectHistory(completed, question)
        val notes = if (memoryEnabled) ContextPolicy.selectMemory(memoryNotes, question) else ""
        val result = JSONObject()
            .put("question", ResearchRequest.forBackend(question,webResearch))
            .put("history", safeHistory(recent))
            .put("thoughtMode", if (thoughtMode == "gelap") "gelap" else "cahaya")
            .put("contextFallback", false)
            .put("mediaFallback", false)
            .put("summary", if(retrievedContext.isBlank())summary.take(4000)
                else (summary.take(1100)+"\n\n"+retrievedContext.take(2600)).take(4000))
            .put("memoryNotes", notes)
            .put("thoughtLedger", JSONArray().apply {
                thoughtLedger.takeLast(8).forEach { entry ->
                    val idea = entry.idea.trim().take(170)
                    if (idea.isNotBlank()) put(JSONObject()
                        .put("idea", idea).put("status", entry.status.take(35)))
                }
            })
            .put("documentText", documentText)
            .put("documentName", documentName.take(200))
            .put("media", media?.takeIf { it.length() > 0 } ?: JSONObject.NULL)
            .put("fileUploads", fileUploads?.takeIf { it.length() > 0 } ?: JSONObject.NULL)
        require(result.toString().toByteArray(Charsets.UTF_8).size <= 5_350_000) {
            "Jumlah mesej, sejarah dan lampiran melebihi had API 5.35 MB."
        }
        return result
    }
}
