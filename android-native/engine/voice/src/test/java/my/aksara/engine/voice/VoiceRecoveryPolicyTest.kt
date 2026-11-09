package my.aksara.engine.voice

import org.junit.Assert.*
import org.junit.Test

class VoiceRecoveryPolicyTest {
    @Test fun boundedRetryWithJitter() {
        assertEquals(800L, VoiceRecoveryPolicy.backoffMs(1))
        assertEquals(1600L, VoiceRecoveryPolicy.backoffMs(2))
        assertEquals(3200L, VoiceRecoveryPolicy.backoffMs(3))
        assertEquals(3449L, VoiceRecoveryPolicy.backoffMs(3, 700L))
        assertThrows(IllegalArgumentException::class.java) { VoiceRecoveryPolicy.backoffMs(4) }
    }
    @Test fun honorsNumericAndHttpDateRetryAfter() {
        assertEquals(47L, VoiceRecoveryPolicy.retryAfterSeconds("47", 4L))
        assertEquals(9L, VoiceRecoveryPolicy.retryAfterSeconds(null, 9L))
        assertEquals(12L, VoiceRecoveryPolicy.retryAfterSeconds(
            "Sun, 08 Nov 2026 15:00:12 GMT", 0L, 1794150000000L))
    }
    @Test fun languageDetectorIsConservative() {
        assertTrue(VoiceRecoveryPolicy.suspectSpanish("Gracias, estoy hablando contigo."))
        assertFalse(VoiceRecoveryPolicy.suspectSpanish("Apa khabar, aku sedang menjawab soalan kau."))
        assertFalse(VoiceRecoveryPolicy.suspectSpanish("gracias"))
    }
    @Test fun detectsLanguageDriftAcrossTranscriptFragments() {
        val first = VoiceContextSync.mergeTranscript("", "gracias")
        assertFalse(VoiceRecoveryPolicy.suspectSpanish(first))
        val completed = VoiceContextSync.mergeTranscript(first, "estoy hablando contigo")
        assertTrue(VoiceRecoveryPolicy.suspectSpanish(completed))
    }
}
