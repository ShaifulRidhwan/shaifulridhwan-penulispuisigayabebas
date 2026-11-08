package my.aksara.nativeapp

import my.aksara.nativeapp.feature.chat.ProviderIdentity
import org.junit.Assert.*
import org.junit.Test

class ProviderIdentityTest {
    @Test fun identifiesOnlyActualBackendFinalProvider() {
        for (id in listOf("gemini", "groq", "workers_ai", "openrouter", "aksara_local")) {
            assertEquals(id, ProviderIdentity.of(id)?.id)
        }
        assertEquals("gemini", ProviderIdentity.normalize(" Gemini "))
        assertNull(ProviderIdentity.of(""))
        assertNull(ProviderIdentity.of("netlify"))
        assertNull(ProviderIdentity.of("local")) // never assume a fallback is genuinely local
        assertNull(ProviderIdentity.of("some_future_provider"))
    }
}
