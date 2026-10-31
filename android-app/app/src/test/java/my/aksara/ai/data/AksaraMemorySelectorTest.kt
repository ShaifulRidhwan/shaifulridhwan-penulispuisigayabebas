package my.aksara.ai.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AksaraMemorySelectorTest {
    @Test fun shortNotesAreKeptAsWritten() {
        assertEquals("Aku suka falsafah.", AksaraMemorySelector.select("buku", "Aku suka falsafah."))
    }
    @Test fun longNotesAreBoundedAndRelevant() {
        val text = (1..250).joinToString("\n") { if (it == 150) "Aku menulis puisi gaya bebas" else "Pemerhatian nombor $it yang tidak berkaitan." }
        val chosen = AksaraMemorySelector.select("puisi gaya bebas", text)
        assertTrue(chosen.length <= 2800)
        assertTrue(chosen.contains("puisi gaya bebas"))
    }
}
