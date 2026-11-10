package my.aksara.nativeapp

import my.aksara.nativeapp.feature.chat.ProviderHealthParser
import org.json.JSONObject
import org.json.JSONArray
import org.junit.Assert.*
import org.junit.Test

class ProviderHealthSnapshotTest {
    @Test fun parsesEvidenceWithoutPromotingReadyOrListedToConnected() {
        val payload=JSONObject("""
          {
            "checkedAt": 1794324660000,
            "providers": [
              {"id":"gemini","status":"online","model":"gemini-3.5-flash-lite",
                "pool":[
                  {"slot":1,"status":"ready","model":"gemini-3.5-flash-lite","http":503,"latencyMs":2141,"checkedAt":1794324400000,"reason":"health_upstream_busy"},
                  {"slot":2,"status":"online","model":"gemini-3.5-flash-lite","http":200,"latencyMs":611,"checkedAt":1794324600000},
                  {"slot":3,"status":"ready","model":"gemini-3.5-flash-lite"},
                  {"slot":4,"status":"ready","model":"gemini-3.5-flash-lite"}]},
              {"id":"groq","status":"online","model":"openai/gpt-oss-120b"},
              {"id":"workers_ai","status":"ready","model":"@cf/zai-org/glm-4.7-flash"},
              {"id":"openrouter","status":"ready"}
            ],
            "freeModels":{"status":"ready","total":2,
              "models":[{"id":"some/model:free","name":"North Mini Code (free)"},
                        {"id":"other/model:free","name":"Gemma 4 (free)"}]}
          }
        """.trimIndent())
        val result=ProviderHealthParser.parse(payload)
        assertEquals(2,result.connectedCount)
        assertEquals(2,result.readyCount)
        assertEquals(0,result.remainingCount)
        assertEquals(4,result.providers.first().slots.size)
        assertEquals(503,result.providers.first().slots.first().http)
        assertEquals(2141L,result.providers.first().slots.first().latencyMs)
        assertNull(result.providers.first().slots[2].checkedAt)
        assertEquals(listOf("North Mini Code (free)","Gemma 4 (free)"),result.catalogModels)
        assertEquals(2,result.catalogTotal)
    }

    @Test fun absentEvidenceIsUnknownAndNeverConvertedToOnline() {
        val result=ProviderHealthParser.parse(JSONObject("""
          {"providers":[{"id":"gemini","status":"ready","pool":[{"slot":1,"status":"ready"}]}]}
        """.trimIndent()))
        assertEquals(0,result.connectedCount)
        assertEquals(1,result.readyCount)
        assertNull(result.checkedAt)
        assertNull(result.providers.first().slots.first().checkedAt)
        assertTrue(result.catalogModels.isEmpty())
        assertThrows(IllegalArgumentException::class.java) {
            ProviderHealthParser.parse(JSONObject("""{"ok":true}"""))
        }
    }

    @Test fun listsThirteenOpenRouterModelsWithoutInflatingProviderCounts() {
        val models = JSONArray().apply {
            repeat(13) { index ->
                put(JSONObject().put("name", "OpenRouter Model ${index + 1}")
                    .put("id", "catalog/model-${index + 1}:free"))
            }
        }
        val payload = JSONObject()
            .put("providers", JSONArray().put(JSONObject().put("id", "openrouter").put("status", "ready")))
            .put("freeModels", JSONObject().put("status", "ready")
                .put("total", 13).put("models", models))
        val snapshot = ProviderHealthParser.parse(payload)
        assertEquals(13, snapshot.catalogTotal)
        assertEquals(13, snapshot.catalogModels.size)
        assertEquals("OpenRouter Model 13", snapshot.catalogModels.last())
        assertEquals(0, snapshot.connectedCount)
        assertEquals(1, snapshot.readyCount)
        assertEquals(0, snapshot.remainingCount)
    }
}
