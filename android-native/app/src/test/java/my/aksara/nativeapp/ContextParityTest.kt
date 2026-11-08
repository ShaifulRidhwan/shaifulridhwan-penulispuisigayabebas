package my.aksara.nativeapp

import my.aksara.nativeapp.core.storage.Message
import my.aksara.nativeapp.feature.chat.ContextPolicy
import org.junit.Assert.*
import org.junit.Test

class ContextParityTest {
    private fun row(id:String,role:String,content:String)=Message(id,role,content)
    @Test fun selectsOlderCorrectionForFollowUp() {
        val history=listOf(row("1","user","Keputusan akhir: jangan ubah rekaan voice Aksara, kekalkan Aoede."))
            .plus((2..23).map { row(it.toString(),if(it%2==0)"assistant" else "user","Sembang umum yang lain nombor "+it) })
        val selected=ContextPolicy.selectHistory(history,"Sambung yang tadi tentang voice")
        assertTrue(selected.any { it.id=="1" })
        assertTrue(selected.size<=24)
    }
    @Test fun summarizesOnlyWhenEnoughUncompactedMessages() {
        assertNull(ContextPolicy.summaryWindow(19,0))
        assertEquals(0..7,ContextPolicy.summaryWindow(20,0))
        assertNull(ContextPolicy.summaryWindow(26,18))
        assertEquals(18..25,ContextPolicy.summaryWindow(38,18))
    }
    @Test fun memorySelectionRemainsEmptyWhenNoSavedNotes() {
        assertEquals("",ContextPolicy.selectMemory("","apa itu"))
        val long=(1..100).joinToString("\n") { if(it==50)"Kekalkan Bahasa Melayu Malaysia santai." else "Nota topik tertentu "+it }
        assertTrue(ContextPolicy.selectMemory(long,"Bahasa Melayu").contains("Kekalkan Bahasa"))
    }
}
