package my.aksara.ai.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ConversationContextBuilderTest {
    @Test fun excludesIncompleteAndPreservesChronology() {
        val history = listOf(
            ChatTurn("user", "Apa pendapat tentang puisi?"),
            ChatTurn("assistant", "Puisi gaya bebas.", complete = true),
            ChatTurn("user", "Maksud aku Shaiful tu"),
            ChatTurn("assistant", "Oh,", complete = false)
        )
        val selected = ConversationContextBuilder.select(history)
        assertEquals(3, selected.size)
        assertEquals("Maksud aku Shaiful tu", selected.last().content)
        assertEquals(listOf("user", "assistant", "user"), selected.map { it.role })
    }

    @Test fun doesNotStartWithOrphanAssistant() {
        val history = listOf(
            ChatTurn("assistant", "Old response"),
            ChatTurn("user", "New question"),
            ChatTurn("assistant", "New answer")
        )
        assertEquals(listOf("user", "assistant"), ConversationContextBuilder.select(history, 2).map { it.role })
    }

    @Test fun noCompletedUserMeansEmptyContext() {
        assertTrue(ConversationContextBuilder.select(listOf(ChatTurn("assistant", "partial", complete = false))).isEmpty())
    }

    @Test fun capsWindowWithoutReordering() {
        val history = (1..30).map { ChatTurn("user", "Question $it") }
        val selected = ConversationContextBuilder.select(history)
        assertEquals(20, selected.size)
        assertEquals("Question 11", selected.first().content)
        assertEquals("Question 30", selected.last().content)
    }
}
