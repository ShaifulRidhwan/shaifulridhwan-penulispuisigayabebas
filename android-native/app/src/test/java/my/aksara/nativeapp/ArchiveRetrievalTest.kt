package my.aksara.nativeapp

import my.aksara.nativeapp.core.storage.Message
import my.aksara.nativeapp.feature.chat.ArchiveRetrieval
import my.aksara.nativeapp.feature.chat.ResearchRequest
import org.junit.Assert.*
import org.junit.Test

class ArchiveRetrievalTest {
    private fun m(id:String,role:String,text:String,time:Long) = Message(id,role,text,time)
    @Test fun picksRelevantHistoricalTurnWithoutScanningUnrelatedTopics() {
        val old=listOf(
            m("1","user","Aku pilih Netlify sebagai backend Android",1),
            m("2","assistant","Netlify digunakan untuk semua sambungan",2),
            m("3","user","Hari ini aku makan nasi",3),
            m("4","assistant","Sedap.",4)
        )
        val found=ArchiveRetrieval.select(old,emptyList(),"Apa keputusan backend Netlify Android?")
        assertEquals(1,found.size)
        assertEquals("1",found[0].prompt.id)
        assertEquals("2",found[0].response?.id)
        assertTrue(ArchiveRetrieval.excerpts(old,emptyList(),"Netlify Android").contains("Netlify"))
    }
    @Test fun excludesCurrentSessionIncompleteOrMissingMedia() {
        val rows=listOf(
            m("1","user","Backend Netlify stabil",1),
            m("2","assistant","Sah",2),
            m("3","user","Netlify analisis\n\n[Lampiran: fail.csv]",3),
            Message("4","assistant","Separuh",incomplete=true))
        assertTrue(ArchiveRetrieval.select(rows,rows.take(2),"Netlify backend")
            .none { it.prompt.id in setOf("1","3") })
        assertTrue(ArchiveRetrieval.excerpts(rows,rows,"Netlify").isEmpty())
    }
    @Test fun noBackgroundRetrievalForLowSignalQuestion() {
        val rows=listOf(m("1","user","Rahsia perbualan",1))
        assertEquals("",ArchiveRetrieval.excerpts(rows,emptyList(),"ok"))
    }
    @Test fun researchModeDoesNotPretendSearchWasExecuted() {
        val q="Berapakah populasi Malaysia?"
        assertEquals(q,ResearchRequest.forBackend(q,false))
        val selected=ResearchRequest.forBackend(q,true)
        assertTrue(selected.contains("sumber Web terkini"))
        assertTrue(selected.contains(q))
        assertTrue(selected.contains("petikan carian"))
    }
}
