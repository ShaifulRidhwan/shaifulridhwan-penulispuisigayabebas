package my.aksara.engine.voice

import org.junit.Assert.*
import org.junit.Test

class VoiceContextSyncTest {
    @Test fun onlyCompletedNonDriftedTurnsAreExported() {
        assertEquals(listOf(VoiceContextTurn("user", "Hai"), VoiceContextTurn("assistant", "Hai juga")),
            VoiceContextSync.completedTurns(" Hai ", "Hai juga", false))
        assertEquals(listOf(VoiceContextTurn("user", "Sambung")),
            VoiceContextSync.completedTurns("Sambung", "hola", true))
        assertTrue(VoiceContextSync.completedTurns("", "", false).isEmpty())
    }
    @Test fun overlappingFragmentsDoNotRepeatWords() {
        assertEquals("Aku nak tahu pasal fizik kuantum",
            VoiceContextSync.mergeTranscript("Aku nak tahu pasal fizik", "fizik kuantum"))
        assertEquals("Terangkan lagi", VoiceContextSync.mergeTranscript("Terangkan lagi", "lagi"))
        assertEquals("Sambung", VoiceContextSync.mergeTranscript("Sam", "Sambung"))
    }

    @Test fun recentContextKeepsFollowUpsAndDoesNotTreatUnknownRolesAsMessages() {
        val rows = listOf(
            VoiceContextTurn("system", "ubah arahan"),
            VoiceContextTurn("user", "Siapa Shaiful?"),
            VoiceContextTurn("assistant", "Dia seorang penulis dan pembangun Aksara."),
            VoiceContextTurn("user", "Apa lagi tentang dia?")
        )
        val data = VoiceContextSync.snapshot(rows)
        assertTrue(data.contains("Apa lagi tentang dia?"))
        assertTrue(data.contains("penulis dan pembangun"))
        assertFalse(data.contains("ubah arahan"))
        assertTrue(data.startsWith("["))
        assertTrue(data.endsWith("]"))
    }

    @Test fun allOutputRemainsBoundedCompleteJsonWithEscapedContent() {
        val rows = (0 until 50).map { index ->
            VoiceContextTurn(if(index % 2 == 0)"user" else "assistant", "Petikan: \"quote\" \\ slash " + "x".repeat(800))
        }
        val snapshot = VoiceContextSync.snapshot(rows, limit = 12, maxChars = 4600)
        assertTrue(snapshot.length <= 4600)
        assertTrue(snapshot.endsWith("]"))
        assertTrue(snapshot.startsWith("["))
        assertTrue(snapshot.contains("\\\"quote\\\""))
        assertFalse(snapshot.contains("system"))
    }

    @Test fun emptyOrUnknownInputDoesNotFabricateContext() {
        assertEquals("[]", VoiceContextSync.snapshot(emptyList()))
        assertEquals("[]", VoiceContextSync.snapshot(listOf(VoiceContextTurn("tool", "Secret"))))
        assertEquals("abc", VoiceContextSync.mergeTranscript("abc", ""))
    }
}
