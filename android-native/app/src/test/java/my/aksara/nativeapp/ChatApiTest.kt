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
    @Test fun productionRoutesCannotUseWorkerFallback(){
        assertEquals(BackendRoutes.PRODUCTION,my.aksara.nativeapp.BuildConfig.API_ORIGIN)
        assertEquals("https://shaifulridhwan-penulispuisigayabebas.netlify.app",BackendRoutes.configuredOrigin)
        assertFalse(BackendRoutes.configuredOrigin.contains("workers.dev"))
        assertEquals("/.netlify/functions/bilik-antara",BackendRoutes.CHAT)
        assertEquals("/.netlify/functions/bilik-antara-stream",BackendRoutes.STREAM)
        assertEquals("/.netlify/functions/bilik-antara-live-token",BackendRoutes.LIVE_TOKEN)
    }
    @Test fun providerHealthCallsExactEndpointAndOrigin()=runBlocking {
        MockWebServer().use{server->
            server.enqueue(MockResponse().setBody("""{"ok":true,"providers":[{"id":"gemini","status":"ready"}]}"""))
            server.start()
            val origin=server.url("/").toString().removeSuffix("/")
            val json=ChatApi(origin).post(BackendRoutes.CHAT,JSONObject().put("providerStatus",true))
            assertEquals("gemini",json.getJSONArray("providers").getJSONObject(0).getString("id"))
            val request=server.takeRequest()
            assertEquals("POST",request.method)
            assertEquals(BackendRoutes.CHAT,request.path)
            assertEquals(origin,request.getHeader("Origin"))
            assertEquals(1,server.requestCount)
        }
    }
    @Test fun dnsFailureReportsBackendUnreachableNotGeminiOffline()=runBlocking{
        val deadDns=OkHttpClient.Builder().dns { throw java.net.UnknownHostException("No A/AAAA") }.build()
        val e=runCatching{
            ChatApi(BackendRoutes.PRODUCTION,deadDns).post(BackendRoutes.CHAT,JSONObject().put("providerStatus",true))
        }.exceptionOrNull()
        assertNotNull(e)
        assertTrue(e!!.message.orEmpty().startsWith("Backend unreachable"))
        assertFalse(e.message.orEmpty().contains("Gemini Offline"))
        val streamError=runCatching{
            ChatApi(BackendRoutes.PRODUCTION,deadDns).chat(JSONObject().put("question","uji")).toList()
        }.exceptionOrNull()
        assertNotNull(streamError)
        assertTrue(streamError!!.message.orEmpty().startsWith("Backend unreachable"))
    }
    @Test fun quotaIsNotMistakenForDnsFailure(){
        assertFalse(BackendNetworkErrors.transportFailed(ApiFailure(429,"Groq 429")))
        assertEquals("Groq 429",BackendNetworkErrors.translate(ApiFailure(429,"Groq 429"),BackendRoutes.PRODUCTION).message)
        assertTrue(my.aksara.engine.voice.VoiceBackendFailure.message(java.net.UnknownHostException("no host"),
            BackendRoutes.PRODUCTION).startsWith("Backend unreachable"))
    }
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
    @Test fun successfulJsonResponseNeverDuplicatesInference()=runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setResponseCode(200)
                .setHeader("Content-Type","application/json")
                .setBody("""{"reply":"Dijawab sekali","provider":"local","sources":[]}"""))
            server.start()
            val events=ChatApi(server.url("/").toString().removeSuffix("/")).chat(JSONObject().put("question","test")).toList()
            assertEquals("Dijawab sekali",(events.last() as ChatEvent.Done).reply)
            assertEquals("200 JSON must not trigger second call",1,server.requestCount)
        }
    }
    @Test fun jsonRateLimitReturnsBackendRetryAfterWithoutAnotherRequest()=runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setResponseCode(429).setHeader("Content-Type","application/json")
                .setBody("""{"error":"Semua provider sibuk","retryAfterSeconds":47}"""))
            server.start()
            val api=ChatApi(server.url("/").toString().removeSuffix("/"))
            val failure=runCatching {
                api.post("/.netlify/functions/bilik-antara", JSONObject().put("question","x"))
            }.exceptionOrNull()
            assertTrue(failure is ApiFailure)
            assertEquals(429,(failure as ApiFailure).status)
            assertEquals("47",failure.retryAfter)
            assertEquals(1,server.requestCount)
        }
    }
    @Test fun streamRateLimitDoesNotTriggerDuplicateFallback()=runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setResponseCode(429).setHeader("Content-Type","application/json")
                .setBody("""{"error":"Sila cuba semula","retryAfterSeconds":21}"""))
            server.start()
            val failure=runCatching {
                ChatApi(server.url("/").toString().removeSuffix("/")).chat(JSONObject().put("question","x")).toList()
            }.exceptionOrNull()
            assertTrue(failure is ApiFailure)
            assertEquals("21",(failure as ApiFailure).retryAfter)
            assertEquals(1,server.requestCount)
        }
    }
    @Test fun interruptedNdjsonErrorRetainsRetryAfter() {
        val error=assertThrows(ApiFailure::class.java) {
            Ndjson.parse("""{"type":"error","status":429,"retryAfterSeconds":33,"error":"Provider rate-limited"}""")
        }
        assertEquals(429,error.status)
        assertEquals("33",error.retryAfter)
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
