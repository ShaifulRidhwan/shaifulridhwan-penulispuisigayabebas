package my.aksara.nativeapp

import my.aksara.nativeapp.feature.studio.SDTurboModelFormat
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Header-only checks are NOT model initialization or successful offline generation. */
class SDTurboModelFormatTest {
    private fun gguf(version: Int) = byteArrayOf(
        'G'.code.toByte(), 'G'.code.toByte(), 'U'.code.toByte(), 'F'.code.toByte(),
        version.toByte(), 0, 0, 0
    )

    @Test fun supportedGgufVersionsHaveCorrectMagicAndByteOrder() {
        assertTrue(SDTurboModelFormat.supportedHeader(gguf(2)))
        assertTrue(SDTurboModelFormat.supportedHeader(gguf(3)))
        assertFalse(SDTurboModelFormat.supportedHeader(gguf(1)))
        assertFalse(SDTurboModelFormat.supportedHeader(gguf(4)))
        assertFalse(SDTurboModelFormat.supportedHeader(byteArrayOf(0x47, 0x47, 0x55)))
    }

    @Test fun rejectsRenamedFilesAndBigEndianVersions() {
        assertFalse(SDTurboModelFormat.supportedHeader("PNG_NOT_GGUF".toByteArray()))
        assertFalse(SDTurboModelFormat.supportedHeader(byteArrayOf(
            'G'.code.toByte(), 'G'.code.toByte(), 'U'.code.toByte(), 'F'.code.toByte(),
            0, 0, 0, 3
        )))
    }
}
