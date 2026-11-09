package my.aksara.nativeapp

import my.aksara.nativeapp.core.storage.OfflineDraftPolicy
import my.aksara.nativeapp.core.storage.PendingDraft
import org.junit.Assert.*
import org.junit.Test

class OfflineDraftPolicyTest {
    @Test fun retryNeverHappensWithoutExplicitUserAction() {
        val one=OfflineDraftPolicy.add(emptyList(),"Sambung apabila online",40)
        assertEquals(1,one.size)
        assertEquals("Sambung apabila online",one[0].text)
        assertEquals(40,one[0].savedAt)
        assertEquals(one,one.toList())
        assertEquals(emptyList<PendingDraft>(),OfflineDraftPolicy.remove(one,one[0].id))
    }
    @Test fun deduplicatesAndBoundsWithoutSendingAttachments() {
        var queue=emptyList<PendingDraft>()
        repeat(26){queue=OfflineDraftPolicy.add(queue,"Mesej "+it,it.toLong())}
        assertEquals(20,queue.size)
        queue=OfflineDraftPolicy.add(queue,"Mesej 25")
        assertEquals(20,queue.size)
        assertThrows(IllegalArgumentException::class.java) {
            OfflineDraftPolicy.add(queue,"Analisis video\n\n[Lampiran: video.mp4]")
        }
        assertThrows(IllegalArgumentException::class.java) {
            OfflineDraftPolicy.add(queue,"a".repeat(2401))
        }
    }
}
