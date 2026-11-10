package my.aksara.nativeapp

import kotlinx.coroutines.*
import kotlinx.coroutines.flow.toList
import my.aksara.nativeapp.core.network.*
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.*
import org.json.JSONObject
import org.json.JSONArray
import org.junit.Assert.*
import org.junit.Test

class ChatApiTest {
    @Test fun cancellationWaitsForBlockedHttpCallToRelease()=runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setSocketPolicy(SocketPolicy.NO_RESPONSE))
            server.start()
            val client=OkHttpClient()
            val job=launch(Dispatchers.Default) {
                ChatApi(server.url("/").toString().removeSuffix("/"),client).chat(JSONObject()).collect {}
            }
            assertNotNull(server.takeRequest(5,java.util.concurrent.TimeUnit.SECONDS))
            withTimeout(3000) { job.cancelAndJoin() }
            assertEquals("Cancellation must release the active HTTP call",0,client.dispatcher.runningCallsCount())
        }
    }

    @Test fun cancellationDuringStreamingRetainsBoundedCleanup()=runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setHeader("Content-Type","application/x-ndjson")
                .setChunkedBody("{\"type\":\"delta\",\"text\":\"separa\"}\n"+" ".repeat(1024),64)
                .throttleBody(64,1,java.util.concurrent.TimeUnit.SECONDS))
            server.start()
            val client=OkHttpClient()
            val first=CompletableDeferred<Unit>()
            val job=launch(Dispatchers.Default) {
                ChatApi(server.url("/").toString().removeSuffix("/"),client).chat(JSONObject()).collect {
                    if(it is ChatEvent.Delta)first.complete(Unit)
                }
            }
            withTimeout(5000) { first.await() }
            withTimeout(3000) { job.cancelAndJoin() }
            assertEquals(0,client.dispatcher.runningCallsCount())
            assertEquals("Cancellation must not replay inference",1,server.requestCount)
        }
    }

    @Test fun responseRetainsActualThoughtLedgerWithoutInventingEntries() {
        val event=Ndjson.parse("""{"type":"done","reply":"Analisis","provider":"gemini","thoughtLedger":[{"idea":"Premis A","status":"premis"},{"idea":" ","status":"premis"}]}""") as ChatEvent.Done
        assertEquals(listOf(my.aksara.nativeapp.core.storage.ThoughtEntry("Premis A","premis")),event.thoughtLedger)
        val empty=Ndjson.parse("""{"type":"done","reply":"Hai"}""") as ChatEvent.Done
        assertTrue(empty.thoughtLedger.isEmpty())
    }
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
        val deadDns=OkHttpClient.Builder().dns(object:okhttp3.Dns{
            override fun lookup(hostname:String):List<java.net.InetAddress> =
                throw java.net.UnknownHostException("No A/AAAA")
        }).build()
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
    @Test fun evidenceClaimsCannotExceedObservedToolsAndSourceLinks() {
        val fabricated=Ndjson.parse("""{"type":"done","reply":"Cuba semak","evidenceProfile":{"level":"page_text"},"sources":[{"title":"Rujukan","url":"https://example.org/a"}]}""") as ChatEvent.Done
        assertEquals("links_only",fabricated.evidenceLevel)
        val noLinks=Ndjson.parse("""{"type":"done","reply":"Cuba semak","toolsUsed":["google_search"],"evidenceProfile":{"level":"grounded_search"}}""") as ChatEvent.Done
        assertEquals("no_external_evidence",noLinks.evidenceLevel)
        val page=Ndjson.parse("""{"type":"done","reply":"Dirujuk","toolsUsed":["tavily_extract"],"evidenceProfile":{"level":"page_text"},"sources":[{"title":"Dokumen","url":"https://example.org"}]}""") as ChatEvent.Done
        assertEquals("page_text",page.evidenceLevel)
    }
    @Test fun searchExcerptDoesNotPretendEntirePageWasRead() {
        val preview=EvidenceIntegrity.formatSources(
            listOf("Hasil" to "https://example.org/a","Duplikasi" to "https://example.org/a"),
            "search_excerpt")
        assertTrue(preview.contains("kandungan penuh halaman belum disahkan"))
        assertEquals(1,Regex("https://example.org/a").findAll(preview).count())
        assertTrue(EvidenceIntegrity.formatSources(listOf("Palsu" to "javascript:alert(1)"),"page_text").isEmpty())
    }
    @Test fun sourceTitlesCannotInjectMarkdownLinks() {
        val markdown=EvidenceIntegrity.formatSources(
            listOf("Sumber](https://evil.example)" to "https://example.org/a(b)"),"links_only")
        assertFalse(markdown.contains("](https://evil.example)"))
        assertTrue(markdown.contains("https://example.org/a%28b%29"))
        assertTrue(markdown.contains("Kandungan laman belum disahkan"))
    }
    @Test fun signedFileReceiptsAreSentToBackendWithoutUploadingFileBytes()=runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setHeader("Content-Type","application/json")
                .setBody("""{"reply":"PDF dianalisis","provider":"gemini"}"""))
            server.start()
            val receipt="signed.receipt.example"
            val payload=JSONObject().put("question","Analisis PDF ini")
                .put("fileUploads",org.json.JSONArray().put(receipt))
            val events=ChatApi(server.url("/").toString().removeSuffix("/")).chat(payload).toList()
            assertEquals("PDF dianalisis",(events.last() as ChatEvent.Done).reply)
            val sent=JSONObject(server.takeRequest().body.readUtf8())
            assertEquals(receipt,sent.getJSONArray("fileUploads").getString(0))
            assertFalse(sent.has("fileUri"))
            assertEquals(1,server.requestCount)
        }
    }

    @Test fun actualImageVideoAndAudioAttachmentsReachChatBackend()=runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setResponseCode(200)
                .setHeader("Content-Type","application/json")
                .setBody("""{"reply":"Lampiran diterima","provider":"gemini","sources":[]}"""))
            server.start()
            val media=JSONArray()
                .put(JSONObject().put("name","foto.jpg").put("mimeType","image/jpeg").put("data","AQID"))
                .put(JSONObject().put("name","klip.mp4").put("mimeType","video/mp4").put("data","BAUG"))
                .put(JSONObject().put("name","suara.mp3").put("mimeType","audio/mpeg").put("data","BwgJ"))
            val request=JSONObject()
                .put("question","Sila analisis kandungan lampiran ini.")
                .put("media",media)
            val events=ChatApi(server.url("/").toString().removeSuffix("/")).chat(request).toList()
            assertEquals("Lampiran diterima",(events.last() as ChatEvent.Done).reply)
            assertEquals(1,server.requestCount)
            val received=server.takeRequest()
            assertEquals(BackendRoutes.STREAM,received.path)
            val body=JSONObject(received.body.readUtf8())
            assertEquals("Sila analisis kandungan lampiran ini.",body.getString("question"))
            val sent=body.getJSONArray("media")
            assertEquals(3,sent.length())
            assertEquals("image/jpeg",sent.getJSONObject(0).getString("mimeType"))
            assertEquals("AQID",sent.getJSONObject(0).getString("data"))
            assertEquals("video/mp4",sent.getJSONObject(1).getString("mimeType"))
            assertEquals("BAUG",sent.getJSONObject(1).getString("data"))
            assertEquals("audio/mpeg",sent.getJSONObject(2).getString("mimeType"))
        }
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
