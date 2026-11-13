package my.aksara.nativeapp.core.nexus.kernel

import kotlinx.coroutines.runBlocking
import my.aksara.nativeapp.core.network.BackendRoutes
import my.aksara.nativeapp.core.network.ChatApi
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.TimeUnit

/**
 * Real ChatApi NDJSON transport -> Aksara model planner -> typed DAG -> policy.
 * No live model call, no rootfs and no APK needed for this verification.
 */
class KernelPlannerIntegrationTest {
    @Test fun modelPlannerEndToEndBuildsApprovedReadOnlyDag() = runBlocking {
        val server = MockWebServer()
        server.start()
        try {
            val response = JSONObject()
                .put("type", "done")
                .put("provider", "gemini")
                .put("reply", """{"capabilities":["linux.health","today.github","ai.health"]}""")
            server.enqueue(MockResponse().setResponseCode(200)
                .addHeader("Content-Type", "application/x-ndjson")
                .setBody(response.toString() + "\n"))
            val api = ChatApi(server.url("/").toString().trimEnd('/'))
            val registry = KernelDefaults.registry()
            val plan = KernelAiPlanner(api).propose("Semak Linux, GitHub dan AI", registry)
            assertEquals(4, plan.nodes.size)
            assertEquals("kernel.evidence", plan.nodes.last().capability)
            val request = requireNotNull(server.takeRequest(2, TimeUnit.SECONDS))
            assertEquals(BackendRoutes.STREAM, request.path)
            val body = JSONObject(request.body.readUtf8())
            assertEquals(0, body.getJSONArray("history").length())
            assertEquals("", body.optString("memoryNotes"))
            assertFalse(body.optBoolean("contextFallback", true))
            assertTrue(body.getString("question").contains("linux.health"))
            assertFalse(body.toString().contains("/workspace/secret"))
            val approved = KernelPolicy.approveReadOnly(plan, registry, System.currentTimeMillis())
            assertTrue(KernelPolicy.permits(plan, approved, registry, approved.grantedAt + 1L))
            assertFalse(KernelPolicy.permits(plan.copy(nodes = plan.nodes.dropLast(1)),
                approved, registry, approved.grantedAt + 1L))
        } finally { server.shutdown() }
    }

    @Test fun maliciousPlannerOutputFailsBeforeAnyShellExecution() = runBlocking {
        val server = MockWebServer()
        server.start()
        try {
            val response = JSONObject()
                .put("type", "done")
                .put("provider", "gemini")
                .put("reply", """{"capabilities":["linux.health; rm -rf /"]}""")
            server.enqueue(MockResponse().setResponseCode(200)
                .addHeader("Content-Type", "application/x-ndjson")
                .setBody(response.toString() + "\n"))
            val planner = KernelAiPlanner(ChatApi(server.url("/").toString().trimEnd('/')))
            val outcome = runCatching {
                planner.propose("Semak Linux", KernelDefaults.registry())
            }
            assertTrue(outcome.isFailure)
        } finally { server.shutdown() }
    }

    @Test fun providerSnapshotNeverInventsFallbackAvailability() {
        assertFalse(KernelProviderPolicy.assess(emptyList()).available)
        assertFalse(KernelProviderPolicy.assess(
            listOf("Gemini" to "Offline", "Groq" to "Disconnected")).available)
        assertTrue(KernelProviderPolicy.assess(
            listOf("Gemini" to "Online", "Groq" to "Offline")).available)
    }
}
