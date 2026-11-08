package my.aksara.nativeapp

import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import my.aksara.nativeapp.core.network.BackendRoutes
import my.aksara.nativeapp.core.network.ChatApi
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.net.InetAddress
import java.util.concurrent.TimeUnit

/** Live instrumentation: validates actual emulator DNS/HTTP, not a mocked backend. */
class NativeBackendNetworkTest {
    @Test fun androidDnsAndRealProductionProviderHealth()=runBlocking {
        val hostname=java.net.URI(BackendRoutes.configuredOrigin).host
        assertEquals("shaifulridhwan-penulispuisigayabebas.netlify.app",hostname)
        assertTrue("Emulator cannot resolve production Netlify",InetAddress.getAllByName(hostname).isNotEmpty())
        val response=withTimeout(65000) {
            ChatApi(BackendRoutes.configuredOrigin).post(BackendRoutes.CHAT,JSONObject().put("providerStatus",true))
        }
        assertTrue("Backend provider-health JSON missing ok",response.optBoolean("ok"))
        assertTrue("Missing provider rows",(response.optJSONArray("providers")?.length()?:0)>0)
    }
    @Test fun realGeminiLiveBrokerReturnsEphemeralToken() {
        val client=OkHttpClient.Builder().connectTimeout(15,TimeUnit.SECONDS)
            .readTimeout(30,TimeUnit.SECONDS).build()
        val request=Request.Builder().url(BackendRoutes.configuredOrigin+BackendRoutes.LIVE_TOKEN)
            .header("Origin",BackendRoutes.configuredOrigin)
            .post("{}".toRequestBody("application/json".toMediaType())).build()
        client.newCall(request).execute().use { response ->
            val raw=response.body?.string().orEmpty()
            assertTrue("Live token endpoint HTTP "+response.code+" (token redacted)",response.isSuccessful)
            val data=JSONObject(raw)
            assertTrue("Invalid ephemeral token format",data.optString("token").startsWith("auth_tokens/"))
            assertTrue("Invalid broker model",data.optString("model").startsWith("gemini-"))
        }
    }
}
