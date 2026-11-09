package my.aksara.nativeapp

import my.aksara.nativeapp.feature.chat.P3Intelligence
import my.aksara.nativeapp.core.storage.Message
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class P3IntelligenceTest {
    @Test fun plannedStepsArePreviewsNeverExecutedActions() {
        val plan=P3Intelligence.previewPlan("1. Audit provider\n2. Baiki routing\n3. Uji Voice")
        assertEquals(3,plan.size)
        assertFalse(plan.any{it.executed})
        assertEquals(emptyList<P3Intelligence.PlanStep>(),P3Intelligence.previewPlan("Hai"))
    }

    @Test fun graphEdgesRequireUserCoMentionsNotAssistantHallucination() {
        val rows=listOf(
            Message("u1","user","Android voice guna Bluetooth"),
            Message("a1","assistant","Studio Android mungkin suara"),
            Message("u2","user","Android voice patut dapat laluan yang betul"))
        val links=P3Intelligence.topicLinks(rows)
        assertEquals(1,links.size)
        assertEquals("Android",links.first().first)
        assertEquals("Voice",links.first().second)
        assertEquals(2,links.first().mentions)
    }

    @Test fun manifestIsConfigurationNotRuntimeVerification() {
        val payload=JSONObject().put("capabilities",JSONObject()
            .put("gemini",JSONObject().put("functionCalling",true).put("urlContext",false))
            .put("groq",JSONObject().put("browserSearch",true)))
        val rows=P3Intelligence.inventory(payload)
        assertEquals(3,rows.size)
        assertTrue(rows.any{it.provider=="gemini"&&it.name=="functionCalling"&&it.configured})
        assertTrue(rows.any{it.provider=="gemini"&&it.name=="urlContext"&&!it.configured})
        assertTrue(P3Intelligence.reviewLabel(null,"links_only").contains("tidak dilaporkan"))
    }
}
