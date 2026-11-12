package my.aksara.nativeapp.feature.chat

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class LocalJourneyMatcherTest {
    private val questions = listOf("Siapa Aku?", "The Coder Poet", "Apa Itu Aksara Local?", "Apa Itu Multi A.I.?")
    @Test fun exactAndCasualMalay() {
        assertEquals(0, LocalJourneyMatcher.match("Siapa Aku?", questions))
        assertEquals(0, LocalJourneyMatcher.match("sape aku", questions))
        assertEquals(2, LocalJourneyMatcher.match("ape itu aksara local", questions))
    }
    @Test fun rejectsUnrelatedAndAmbiguousPrompts() {
        assertNull(LocalJourneyMatcher.match("beli nasi lemak", questions))
        assertNull(LocalJourneyMatcher.match("apa itu", questions))
        assertNull(LocalJourneyMatcher.match("", questions))
    }
    @Test fun typoAndPunctuation() {
        assertEquals(1, LocalJourneyMatcher.match("the coder poet!!!", questions))
        assertEquals(2, LocalJourneyMatcher.match("apa itu aksra local", questions))
    }
}
