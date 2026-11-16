package my.aksara.nativeapp.feature.chat

import android.speech.SpeechRecognizer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AksaraSpeechPolicyTest {
    @Test fun selectsMalayFromOnDeviceSupportedLocales() {
        assertEquals("ms-MY",AksaraSpeechPolicy.preferredMalay(listOf("en-US","ms-MY","id-ID")))
        assertEquals("ms",AksaraSpeechPolicy.preferredMalay(listOf("en-US","ms")))
        assertNull(AksaraSpeechPolicy.preferredMalay(listOf("en-US","id-ID")))
        assertTrue(AksaraSpeechPolicy.isMalay("ms-SG"))
        assertFalse(AksaraSpeechPolicy.isMalay("id-ID"))
    }

    @Test fun unsupportedMalayAlwaysRequiresConsentBeforeSystemAsr() {
        assertEquals(AksaraSpeechAlternative.SYSTEM_CONSENT,
            AksaraSpeechPolicy.alternative(AksaraSpeechMode.LOCAL,
                SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED))
        assertEquals(AksaraSpeechAlternative.AUTO_LANGUAGE,
            AksaraSpeechPolicy.alternative(AksaraSpeechMode.SYSTEM_MALAY,
                SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED))
        assertNull(AksaraSpeechPolicy.alternative(AksaraSpeechMode.SYSTEM_AUTO,
            SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED))
    }

    @Test fun missingOfflineModelAllowsDownloadWithoutCloudFallback() {
        assertEquals(AksaraSpeechAlternative.MODEL_DOWNLOAD,
            AksaraSpeechPolicy.alternative(AksaraSpeechMode.LOCAL,
                SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE))
        assertNull(AksaraSpeechPolicy.alternative(AksaraSpeechMode.LOCAL,
            SpeechRecognizer.ERROR_NO_MATCH))
        assertTrue(AksaraSpeechPolicy.message(SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED)
            .contains("Bahasa Melayu"))
        assertTrue(AksaraSpeechPolicy.message(SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE)
            .contains("Model"))
    }
}
