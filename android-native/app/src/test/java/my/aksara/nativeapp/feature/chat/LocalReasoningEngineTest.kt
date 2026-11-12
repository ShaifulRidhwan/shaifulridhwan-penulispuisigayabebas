package my.aksara.nativeapp.feature.chat

import org.junit.Assert.*
import org.junit.Test

class LocalReasoningEngineTest {
    @Test fun followsExplicitTopicWithinSession() {
        assertEquals("apa itu aksara local", LocalReasoningEngine.contextualQuery("jelaskan lagi", "Apa itu Aksara Local?"))
        assertNull(LocalReasoningEngine.contextualQuery("jelaskan lagi", null))
        assertNull(LocalReasoningEngine.contextualQuery("berapa harga btc", "Apa itu Aksara Local?"))
    }
    @Test fun respectsExplicitCorrectionWithoutInventingTopic() {
        assertEquals("Studio Antara", LocalReasoningEngine.correctionQuery("bukan tu, Studio Antara"))
        assertNull(LocalReasoningEngine.correctionQuery("bukan tu"))
        assertNull(LocalReasoningEngine.correctionQuery("Aku suka puisi"))
    }
}
