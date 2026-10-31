package my.aksara.ai.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class VoiceSpokenTextTest {
    @Test fun removesMarkdownFormattingButKeepsUsefulText() {
        val text = VoiceSpokenText.clean(
            "# Tajuk\n**Jawapan** dan *renungan*.\n- Satu\n- Dua\n[Baca](https://example.com)"
        )
        assertTrue(text.contains("Tajuk"))
        assertTrue(text.contains("Jawapan dan renungan."))
        assertTrue(text.contains("Satu"))
        assertTrue(text.contains("Baca"))
        assertFalse(text.contains("https://"))
        assertFalse(text.contains("**"))
    }

    @Test fun limitsLongVoiceOutput() {
        val result = VoiceSpokenText.clean("X".repeat(9000))
        assertEquals(7000, result.length)
        val parts = VoiceSpokenText.segments("A".repeat(4000))
        assertTrue(parts.size > 1)
        assertTrue(parts.all { it.length <= 1800 })
    }

    @Test fun removesFencedCode() {
        val ticks = "\u0060\u0060\u0060"
        val s = VoiceSpokenText.clean("Mula\n" + ticks + "kotlin\nsecret()" + ticks + "\nTamat")
        assertFalse(s.contains("secret()"))
        assertTrue(s.contains("Tamat"))
    }
}
