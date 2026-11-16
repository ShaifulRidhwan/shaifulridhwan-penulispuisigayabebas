package my.aksara.nativeapp.feature.voice

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AksaraHotwordMatcherTest {
    @Test fun detectsMalayWakeWordWithNaturalPunctuation() {
        assertTrue(AksaraHotwordMatcher.matches("Aksara"))
        assertTrue(AksaraHotwordMatcher.matches("Hei, Aksara!"))
        assertTrue(AksaraHotwordMatcher.matches("aksara, apa khabar?"))
        assertTrue(AksaraHotwordMatcher.matches("AKSARA"))
    }

    @Test fun rejectsSubstringsAndOtherNames() {
        assertFalse(AksaraHotwordMatcher.matches("mengaksarakan"))
        assertFalse(AksaraHotwordMatcher.matches("aksaraku"))
        assertFalse(AksaraHotwordMatcher.matches("saya tengah coding"))
        assertFalse(AksaraHotwordMatcher.matches(""))
    }
}
