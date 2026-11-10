package my.aksara.nativeapp

import my.aksara.nativeapp.feature.chat.WritingWorkflow
import my.aksara.nativeapp.feature.chat.WebBrainBridge
import org.junit.Assert.*
import org.junit.Test

class WritingWorkflowTest {
    @Test fun explicitSixStagesUseExistingBackendWithoutChangingOrdinaryChat() {
        for (name in listOf("RESEARCH","RAW","POLISH","BEDAH","TAJAM","LOCK")) {
            val original="$name: Hujan bertanya pada jendela."
            val actual=WritingWorkflow.forInference(original)
            assertTrue("Writing stage $name missing", actual.contains("WRITING WORKFLOW · $name"))
            assertTrue(actual.endsWith(original))
            val payload=WebBrainBridge.chatPayload(
                original,emptyList(),"cahaya","",false,"",emptyList())
            assertTrue(payload.getString("question").contains("WRITING WORKFLOW · $name"))
            assertFalse(payload.has("provider"))
            assertFalse(payload.has("model"))
        }
        val ordinary="Apa maksud LOCK dalam proses suntingan?"
        assertEquals(ordinary,WritingWorkflow.forInference(ordinary))
        assertNull(WritingWorkflow.stage("Puisi tentang RAW dan POLISH"))
    }

    @Test fun lockNeverClaimsPermanentSavingAndLeavesOriginalDraftIntact() {
        val draft="LOCK:\nMalam menyembunyikan jam.\nEsok tidak berjanji."
        val guided=WritingWorkflow.forInference(draft)
        assertTrue(guided.contains("Jangan ubah satu pun aksara"))
        assertTrue(guided.contains("jangan menyatakan bahawa fail"))
        assertTrue(guided.endsWith(draft))
        assertEquals(WritingWorkflow.Stage.LOCK,WritingWorkflow.stage(draft))
    }

    @Test fun bedahAndTajamAreCritiqueAndSurgicalEditsNotBlindPraise() {
        val bedah=WritingWorkflow.forInference("BEDAH: Cerita ini lemah?")
        assertTrue(bedah.contains("Jangan memuji tanpa alasan"))
        val tajam=WritingWorkflow.forInference("TAJAM: Daun ini terjatuh.")
        assertTrue(tajam.contains("sebelum/selepas"))
    }
}
