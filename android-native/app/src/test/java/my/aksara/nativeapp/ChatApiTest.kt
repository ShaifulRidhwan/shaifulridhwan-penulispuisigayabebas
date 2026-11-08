package my.aksara.nativeapp

import kotlinx.coroutines.*
import kotlinx.coroutines.flow.toList
import my.aksara.nativeapp.core.network.*
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.*
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class ChatApiTest {
    @Test fun evidenceMetadataIsNotInferredFromConfiguredTools() {
        val event=Ndjson.parse("""{"type":"done","reply":"Jawapan","provider":"groq","model":"safe-model","researchStatus":"search-snippets","toolsUsed":["browser_search"],"evidenceProfile":{"level":"search_excerpt"},"sources":[{"title":"Portal","url":"https://example.org/article"},{"title":"Bukan HTTPS","url":"http://not-safe.example"}]}""") as ChatEvent.Done
        assertEquals("groq",event.provider)
        assertEquals("search_excerpt",event.evidenceLevel)
        assertEquals(listOf("browser_search"),event.toolsUsed)
        assertEquals(1,event.sources.size)
        val noEvidence=Ndjson.parse("""{"type":"done","reply":"Tiada bukti","provider":"gemini","sources":[]}""") as ChatEvent.Done
        assertEquals("no_external_evidence",noEvidence.evidenceLevel)
        assertTrue(noEvidence.toolsUsed.isEmpty())
    }
    @Test fun ndjsonRejectsTruncatedJson() { assertThrows(java.io.IOException::class.java){Ndjson.parse("{broken") } }
    @Test fun errorFrameIsNeverSuccess() { assertThrows(ApiFailure::class.java){Ndjson.parse("{\"type\":\"error\",\"error\":\"rate limited\",\"status\":429}")} }
    @Test fun preservesUnicodeAndHistoryThroughRealHttpStream()=runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setHeader("Content-Type","application/x-ndjson").setBody("{\"type\":\"delta\",\"text\":\"cahaya ☀\"}\n{\"type\":\"done\",\"reply\":\"cahaya ☀\",\"provider\":\"fixture\"}\n"))
            server.start();val origin=server.url("/").toString().removeSuffix("/")
            val events=ChatApi(origin).chat(JSONObject().put("question","Kenapa?")).toList()
            assertEquals("cahaya ☀",(events.last() as ChatEvent.Done).reply)
            val request=server.takeRequest();assertEquals(origin,request.getHeader("Origin"));assertTrue(request.body.readUtf8().contains("Kenapa?"))
        }
    }
    @Test fun interruptedStreamDoesNotSilentlyFallback()=runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setHeader("Content-Type","application/x-ndjson").setBody("{\"type\":\"delta\",\"text\":\"separa\"}\n"));server.start()
            var failure:Throwable?=null
            try {ChatApi(server.url("/").toString().removeSuffix("/")).chat(JSONObject()).toList()} catch(e:Throwable){failure=e}
            assertNotNull(failure);assertEquals(1,server.requestCount)
        }
    }
    @Test fun unsupportedStreamFallsBackOnlyBeforeDeltas()=runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setResponseCode(404));server.enqueue(MockResponse().setBody("{\"reply\":\"jawapan\",\"provider\":\"fixture\"}"));server.start()
            val events=ChatApi(server.url("/").toString().removeSuffix("/")).chat(JSONObject()).toList()
            assertEquals(1,events.size);assertEquals(2,server.requestCount)
        }
    }
}
