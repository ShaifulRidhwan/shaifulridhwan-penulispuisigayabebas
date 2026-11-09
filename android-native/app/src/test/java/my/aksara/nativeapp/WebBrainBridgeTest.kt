package my.aksara.nativeapp

import my.aksara.nativeapp.feature.chat.WebBrainBridge
import my.aksara.nativeapp.core.storage.Message
import my.aksara.nativeapp.core.storage.ThoughtEntry
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class WebBrainBridgeTest {
    private fun row(id: String, role: String, content: String, incomplete: Boolean = false) =
        Message(id, role, content, incomplete = incomplete)

    @Test fun webOwnsRoutingThinkingToolsResearchAndEvidence() {
        val payload = WebBrainBridge.chatPayload(
            question = "Audit sumber sekarang", completed = listOf(
                row("1", "user", "Baca https://example.org"),
                row("2", "assistant", "Sedang menyemak pautan.")),
            thoughtMode = "gelap", summary = "", memoryEnabled = false,
            memoryNotes = "Rahsia yang tidak boleh dihantar",
            thoughtLedger = listOf(ThoughtEntry("Kesimpulan terdahulu", "premis")))
        assertEquals("gelap", payload.getString("thoughtMode"))
        assertFalse(payload.getBoolean("contextFallback"))
        assertFalse(payload.getBoolean("mediaFallback"))
        assertEquals("", payload.getString("memoryNotes"))
        assertEquals(1, payload.getJSONArray("thoughtLedger").length())
        // Never create a competing system prompt, tool catalog, provider or model.
        for (forbidden in listOf("systemInstruction", "system", "tools", "model", "provider", "routing"))
            assertFalse("Client must defer $forbidden to Web Brain", payload.has(forbidden))
        assertEquals(2, payload.getJSONArray("history").length())
    }

    @Test fun memoryRequiresOptInAndCompletedHistoryOnly() {
        val rows = listOf(row("1", "user", "Asal"),
            row("2", "assistant", "Respons lengkap"),
            row("3", "assistant", "Separuh", incomplete = true))
        val disabled = WebBrainBridge.chatPayload("Lagi", rows, "cahaya", "",
            false, "Nota peribadi", emptyList())
        val enabled = WebBrainBridge.chatPayload("Lagi", rows, "cahaya", "",
            true, "Nota peribadi", emptyList())
        assertEquals("", disabled.getString("memoryNotes"))
        assertEquals("Nota peribadi", enabled.getString("memoryNotes"))
        assertEquals(2, enabled.getJSONArray("history").length())
        assertFalse(enabled.toString().contains("Separuh"))
    }

    @Test fun imagesAndFileReceiptsKeepBackendMediaContract() {
        val images = JSONArray().put(JSONObject().put("mimeType", "image/png").put("data", "AQID"))
        val uploads = JSONArray().put("signed-receipt")
        val payload = WebBrainBridge.chatPayload("Semak gambar", emptyList(),
            "unknown-mode", "", false, "", emptyList(), "Teks fail",
            "bukti.pdf", images, uploads)
        assertEquals("cahaya", payload.getString("thoughtMode"))
        assertEquals("Teks fail", payload.getString("documentText"))
        assertEquals("image/png", payload.getJSONArray("media").getJSONObject(0).getString("mimeType"))
        assertEquals("signed-receipt", payload.getJSONArray("fileUploads").getString(0))
    }

    @Test fun summaryAlsoForbidsPrivateProviderFallback() {
        val summary = WebBrainBridge.summaryPayload(listOf(row("1", "user", "Keputusan awal"),
            row("2", "assistant", "Ringkasan"), row("3", "assistant", "Separuh", true)), "")
        assertTrue(summary.getBoolean("summarize"))
        assertFalse(summary.getBoolean("contextFallback"))
        assertEquals(2, summary.getJSONArray("history").length())
    }

    @Test fun transportWindowRespectsBackend24MessageCapWithoutLosingRecentTurns() {
        val rows = (1..55).map { n -> row(n.toString(),
            if (n % 2 == 0) "assistant" else "user", "Giliran teks $n") }
        val payload = WebBrainBridge.chatPayload("Sambung perbincangan", rows,
            "cahaya", "", false, "", emptyList())
        val history = payload.getJSONArray("history")
        assertTrue(history.length() <= 24)
        assertTrue(history.toString().contains("Giliran teks 55"))
    }
    @Test fun archiveAndResearchRequireExplicitOptIn() {
        val base=WebBrainBridge.chatPayload("Boleh semak?",emptyList(),
            "cahaya","Sesi aktif",false,"",emptyList())
        assertEquals("Boleh semak?",base.getString("question"))
        assertFalse(base.getString("summary").contains("PETIKAN SEJARAH"))
        val explicit=WebBrainBridge.chatPayload("Boleh semak?",emptyList(),
            "cahaya","Sesi aktif",false,"",emptyList(),
            retrievedContext="[PETIKAN SEJARAH PILIHAN PENGGUNA] Petikan arkib",
            webResearch=true)
        assertTrue(explicit.getString("question").contains("sumber Web terkini"))
        assertTrue(explicit.getString("summary").contains("Petikan arkib"))
        assertFalse(explicit.getBoolean("contextFallback"))
        assertFalse(explicit.getBoolean("mediaFallback"))
        assertFalse(explicit.has("provider"))
    }

}
