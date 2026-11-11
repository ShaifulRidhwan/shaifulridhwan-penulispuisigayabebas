package my.aksara.nativeapp

import my.aksara.nativeapp.core.storage.Message
import my.aksara.nativeapp.feature.chat.findUnifiedHistory
import my.aksara.nativeapp.feature.chat.groupSessions
import my.aksara.nativeapp.feature.chat.planSessionRemoval
import org.junit.Assert.*
import org.junit.Test

class UnifiedHistoryTest {
    private val archive = listOf(
        Message("s1", "user", "The Coder Poet", 100),
        Message("a1", "assistant", "Falsafah dan code", 200),
        Message("s2", "user", "Siapa Aku?", 300),
        Message("a2", "assistant", "Identiti dan perjalanan", 400),
        Message("s3", "user", "Entropi & Kehidupan", 500),
        Message("a3", "assistant", "Entropi menyentuh masa", 600)
    )
    private val boundaries = listOf("s1", "s2", "s3")
    private val sessions = groupSessions(archive, boundaries).asReversed()

    @Test fun universalSearchMatchesSessionTitlesAndMessageContents() {
        val matches = findUnifiedHistory(sessions, "CoDe")
        assertEquals(listOf("s1"), matches.sessions.map { it.startId })
        assertEquals(listOf("s1", "a1"), matches.messages.map { it.second.id })
        val hidden = findUnifiedHistory(sessions, "tidak wujud")
        assertTrue(hidden.sessions.isEmpty())
        assertTrue(hidden.messages.isEmpty())
    }

    @Test fun emptyQueryShowsRecentSessionsWithoutCopyingWholeMessageIndex() {
        val results = findUnifiedHistory(sessions, "   ")
        assertEquals(listOf("s3", "s2", "s1"), results.sessions.map { it.startId })
        assertTrue(results.messages.isEmpty())
    }

    @Test fun searchHonorsResultCapAndDoesNotMutateArchive() {
        val result = findUnifiedHistory(sessions, "a", maxResults = 1)
        assertEquals(1, result.sessions.size)
        assertEquals(1, result.messages.size)
        assertEquals(archive.size, archive.count())
    }

    @Test fun deletingOneSessionKeepsOtherSessionIdsAndMessages() {
        val removal = planSessionRemoval(archive, boundaries, "s2")!!
        assertEquals(listOf("s1", "a1", "s3", "a3"), removal.archive.map { it.id })
        assertEquals(listOf("s1", "s3"), removal.starts)
        assertEquals(setOf("s2", "a2"), removal.removedIds)
        assertEquals(2, groupSessions(removal.archive, removal.starts).size)
        assertEquals(archive.size, 6)
    }

    @Test fun missingSessionCannotAccidentallyDeleteEverything() {
        assertNull(planSessionRemoval(archive, boundaries, "missing"))
        assertEquals(6, archive.size)
    }

    @Test fun legacyFlatHistoryRemainsOneSessionUntilExplicitSplit() {
        val flat = groupSessions(archive, emptyList())
        assertEquals(1, flat.size)
        val removed = planSessionRemoval(archive, emptyList(), "s1")!!
        assertTrue(removed.archive.isEmpty())
        assertTrue(removed.starts.isEmpty())
    }
}
