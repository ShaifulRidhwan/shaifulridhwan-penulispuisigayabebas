package my.aksara.ai.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SessionCodecTest {
    @Test fun preservesMultipleSessionsAndActiveSelection() {
        val a = ChatSession(
            id = "a", title = "Sains", mode = "gelap",
            messages = listOf(ChatTurn(role = "user", content = "Kenapa graviti?"))
        )
        val b = ChatSession(id = "b", title = "Puisi")
        val saved = SessionCodec.parse(SessionCodec.serialize(listOf(a, b), "a"), true)
        assertEquals(2, saved.sessions.size)
        assertEquals("a", saved.activeId)
        assertEquals("gelap", saved.sessions.first { it.id == "a" }.mode)
        assertEquals("Kenapa graviti?", saved.sessions.first { it.id == "a" }.messages.first().content)
    }

    @Test fun invalidActiveIdFallsBackSafely() {
        val saved = SessionCodec.parse(
            """{"version":3,"activeId":"missing","sessions":[{"id":"real","title":"Hello","mode":"cahaya","turns":[]}]}""", true
        )
        assertEquals("real", saved.activeId)
    }

    @Test fun optOutDoesNotReadHistory() {
        val saved = SessionCodec.parse("{not-json}", false)
        assertFalse(saved.saveEnabled)
        assertTrue(saved.sessions.single().messages.isEmpty())
    }

    @Test fun titleIsBounded() {
        assertEquals(54, SessionCodec.titleFor("x".repeat(100)).length)
    }
}
