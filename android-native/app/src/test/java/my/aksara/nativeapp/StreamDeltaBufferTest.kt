package my.aksara.nativeapp

import my.aksara.nativeapp.feature.chat.StreamDeltaBuffer
import org.junit.Assert.assertEquals
import org.junit.Test

class StreamDeltaBufferTest {
    @Test fun aggregatesAllTokensWithoutDroppingCharacters() {
        val visible=StringBuilder()
        val buffer=StreamDeltaBuffer { visible.append(it) }
        listOf("Antara ","aksara"," dan ","code.").forEach(buffer::append)
        buffer.flush()
        assertEquals("Antara aksara dan code.",visible.toString())
        buffer.flush()
        assertEquals("Antara aksara dan code.",visible.toString())
    }
    @Test fun stopFlushKeepsLastPartialReply() {
        val output=mutableListOf<String>()
        val buffer=StreamDeltaBuffer(output::add)
        buffer.append("separa")
        buffer.flush()
        buffer.append(" jawapan")
        buffer.flush()
        assertEquals(listOf("separa"," jawapan"),output)
    }
}
