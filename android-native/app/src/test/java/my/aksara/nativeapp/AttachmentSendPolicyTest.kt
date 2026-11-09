package my.aksara.nativeapp

import my.aksara.nativeapp.feature.chat.AttachmentSendPolicy
import org.junit.Assert.*
import org.junit.Test

class AttachmentSendPolicyTest {
    @Test fun attachmentOnlyCanBeSentWithoutTyping() {
        assertEquals("Sila analisis kandungan lampiran ini.",AttachmentSendPolicy.submissionText("",true))
        assertEquals("Sila analisis kandungan lampiran ini.",AttachmentSendPolicy.submissionText("   ",true))
        assertEquals("",AttachmentSendPolicy.submissionText(" ",false))
        assertEquals("Baca graf ini",AttachmentSendPolicy.submissionText(" Baca graf ini ",true))
    }
    @Test fun pickerDoesNotOfferCodeAndEachCategoryUsesCorrectMime() {
        assertArrayEquals(arrayOf("image/*"),AttachmentSendPolicy.mimeTypes("Foto"))
        assertArrayEquals(arrayOf("video/*"),AttachmentSendPolicy.mimeTypes("Video"))
        assertArrayEquals(arrayOf("audio/*"),AttachmentSendPolicy.mimeTypes("Audio"))
        assertTrue(AttachmentSendPolicy.mimeTypes("Dokumen").contains("application/pdf"))
    }
}
