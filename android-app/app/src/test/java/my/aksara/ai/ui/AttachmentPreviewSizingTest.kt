package my.aksara.ai.ui

import org.junit.Assert.assertEquals
import org.junit.Test

class AttachmentPreviewSizingTest {
    @Test fun imagesAreDownsampledBeforePreview() {
        assertEquals(8, AttachmentPreviewSizing.sampleSize(4000, 3000))
        assertEquals(1, AttachmentPreviewSizing.sampleSize(500, 400))
        assertEquals(1, AttachmentPreviewSizing.sampleSize(0, 0))
        assertEquals(256, AttachmentPreviewSizing.sampleSize(100000, 100000))
    }
}
