package my.aksara.ai.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AttachmentRulesTest {
    @Test fun textExtensionsOverrideOpaqueMime() {
        assertEquals("text/markdown", AttachmentRules.normalizeMime("application/octet-stream", "notes.md"))
        assertEquals("text/plain", AttachmentRules.normalizeMime("image/jpeg", "notes.txt"))
    }
    @Test fun onlyServerSupportedFormatsSelected() {
        assertTrue("application/pdf" in AttachmentRules.supportedMedia)
        assertTrue("video/mp4" in AttachmentRules.supportedMedia)
        assertTrue("audio/mpeg" in AttachmentRules.supportedMedia)
        assertTrue("application/x-msdownload" !in AttachmentRules.supportedMedia)
    }
}
