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

class KernelAiEditPlannerTest {
    @Test fun suggestionUsesExistingBackendAndNeverAppliesChanges() = runBlocking {
        val backend = MockWebServer()
        backend.start()
        try {
            val done = JSONObject().put("type", "done").put("provider", "gemini")
                .put("reply", """{"content":"print('hello from Nexus')\n"}""")
            backend.enqueue(MockResponse().setResponseCode(200)
                .addHeader("Content-Type", "application/x-ndjson")
                .setBody(done.toString() + "\n"))
            val api = ChatApi(backend.url("/").toString().trimEnd('/'))
            val suggestion = KernelAiEditPlanner(api).suggest(
                "script.py", "Tambah output hello", "print('hi')\n")
            assertEquals("print('hello from Nexus')\n", suggestion)
            val request = requireNotNull(backend.takeRequest(2, TimeUnit.SECONDS))
            assertEquals(BackendRoutes.STREAM, request.path)
            val payload = JSONObject(request.body.readUtf8())
            assertEquals(0, payload.getJSONArray("history").length())
            assertEquals("", payload.getString("memoryNotes"))
            assertTrue(payload.getString("question").contains("Original text"))
        } finally { backend.shutdown() }
    }

    @Test fun proposalParserRejectsUnstructuredOutputAndMissingContent() {
        assertThrows(IllegalArgumentException::class.java) {
            KernelEditProposalCodec.decode("run shell rm -rf /")
        }
        assertThrows(IllegalArgumentException::class.java) {
            KernelEditProposalCodec.decode("""{"command":"touch /tmp/foo"}""")
        }
        assertEquals("", KernelEditProposalCodec.decode("""{"content":""}"""))
    }
}
