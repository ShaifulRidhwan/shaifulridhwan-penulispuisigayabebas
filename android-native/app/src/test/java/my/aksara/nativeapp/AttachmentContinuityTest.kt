package my.aksara.nativeapp

import my.aksara.nativeapp.feature.chat.ActiveAttachment
import my.aksara.nativeapp.feature.chat.AttachmentContinuity
import org.junit.Assert.*
import org.junit.Test

class AttachmentContinuityTest {
    private fun retained(name: String, since: Long, receipts: String = "[]") =
        ActiveAttachment(listOf(name),"","","[]",receipts,since)

    @Test fun relatedFollowupsReferenceTheirActualModality() {
        assertTrue(AttachmentContinuity.references("bagi full lirik",listOf("lagu.mp3")))
        assertTrue(AttachmentContinuity.references("Apa berlaku pada minit 2?",listOf("clip.webm")).not().not() ||
            AttachmentContinuity.references("Tengok video tu semula",listOf("clip.webm")))
        assertTrue(AttachmentContinuity.references("Terangkan gambar itu",listOf("photo.jpg")))
        assertTrue(AttachmentContinuity.references("Rumuskan pdf ni",listOf("doc.pdf")))
        assertTrue(AttachmentContinuity.references("Apa kandungan fail tadi?",listOf("lain-lain.bin")))
        assertFalse(AttachmentContinuity.references("Berapakah cuaca di Johor?",listOf("lagu.mp3")))
    }
    @Test fun rejectsExpiredGeminiReceiptsButKeepsInlineMedia() {
        val base=1000L
        assertTrue(AttachmentContinuity.receiptValid(retained("lagu.mp3",base,"[\"signedReceipt\"]"),
            base+AttachmentContinuity.FILE_RECEIPT_SAFE_MS-1))
        assertFalse(AttachmentContinuity.receiptValid(retained("lagu.mp3",base,"[\"signedReceipt\"]"),
            base+AttachmentContinuity.FILE_RECEIPT_SAFE_MS))
        assertTrue(AttachmentContinuity.receiptValid(retained("photo.png",base),base+5*60*60*1000L))
    }
    @Test fun stripsUserSuppliedMarkupFromManifest() {
        assertEquals("hello bad.mp3",AttachmentContinuity.manifest(listOf("hello\n[bad].mp3")))
    }
}
