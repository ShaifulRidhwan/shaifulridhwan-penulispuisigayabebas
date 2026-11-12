package my.aksara.nativeapp.feature.chat

import org.junit.Assert.*
import org.junit.Test

class LocalKnowledgeEngineTest {
    private val corpus = """{"schema_version":1,"entries":[
      {"id":"voice","title":"Gemini Live Voice","aliases":["voice chat","bahasa santai"],"facts":["Voice uses Gemini."]},
      {"id":"chess","title":"Ratu Gelap Chess","aliases":["catur","ratu gelap"],"facts":["Chess is available."]}
    ]}"""
    @Test fun retrievesGroundedFact() {
        val hit = LocalKnowledgeEngine.retrieve("gemini live voice", corpus)
        assertEquals("voice", hit?.id)
        assertEquals("Voice uses Gemini.", hit?.answer)
    }
    @Test fun rejectsUnrelatedOrAmbiguousInput() {
        assertNull(LocalKnowledgeEngine.retrieve("berapa harga bitcoin hari ini", corpus))
        assertNull(LocalKnowledgeEngine.retrieve("apa itu", corpus))
        assertNull(LocalKnowledgeEngine.retrieve("", corpus))
    }
    @Test fun rejectsUnsupportedSchema() {
        assertNull(LocalKnowledgeEngine.retrieve("gemini live voice", """{"schema_version":9,"entries":[]}"""))
    }
}
