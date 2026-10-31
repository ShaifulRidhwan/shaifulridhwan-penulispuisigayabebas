package my.aksara.ai.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AksaraStreamProtocolTest {
    @Test fun parsesStartAndPartialReply() {
        assertTrue(AksaraStreamProtocol.parse("""{"type":"start","version":1}""") is StreamEvent.Started)
        val delta = AksaraStreamProtocol.parse("""{"type":"delta","text":"Selamat pagi"}""")
        assertEquals("Selamat pagi", (delta as StreamEvent.Delta).text)
    }

    @Test fun parsesFinalProviderAndReplyWithoutRepeatingDelta() {
        val event = AksaraStreamProtocol.parse(
            """{"type":"done","reply":"Jawapan lengkap","provider":"groq","model":"oss"}"""
        ) as StreamEvent.Done
        assertEquals("Jawapan lengkap", event.response.reply)
        assertEquals("groq", event.response.provider)
    }

    @Test fun exposesBackendErrorsAndIgnoresUnknownFrames() {
        val failed = AksaraStreamProtocol.parse(
            """{"type":"error","status":429,"error":"Kuota penuh"}"""
        ) as StreamEvent.Failed
        assertEquals("Kuota penuh", failed.message)
        assertNull(AksaraStreamProtocol.parse("""{"type":"heartbeat"}"""))
    }

    @Test fun emptyLineIgnored() {
        assertNull(AksaraStreamProtocol.parse(""))
    }
}
