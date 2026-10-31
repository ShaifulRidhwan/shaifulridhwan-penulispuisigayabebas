package my.aksara.ai.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NativeMarkdownTest {
    @Test fun parsesCodeAndKeepsTheLanguage() {
        val ticks = "\u0060\u0060\u0060"
        val blocks = NativeMarkdown.parse(
            "# Tajuk\n\n" + ticks + "kotlin\nval x = 42\n" + ticks + "\n- Item"
        )
        assertEquals(MarkdownKind.HEADING, blocks[0].kind)
        assertEquals(MarkdownKind.CODE, blocks[2].kind)
        assertEquals("kotlin", blocks[2].language)
        assertTrue(blocks[2].text.contains("val x = 42"))
        assertEquals(MarkdownKind.BULLET, blocks[3].kind)
    }

    @Test fun tableHasHeaderAndBoundedRows() {
        val blocks = NativeMarkdown.parse(
            "|Nama|Nilai|\n|---|---|\n|Cahaya|A|\n|Gelap|B|"
        )
        assertEquals(1, blocks.size)
        assertEquals(MarkdownKind.TABLE, blocks[0].kind)
        assertEquals(listOf("Nama", "Nilai"), blocks[0].cells[0])
        assertEquals(3, blocks[0].cells.size)
    }

    @Test fun suspiciousLinksCannotBeOpened() {
        assertNull(NativeMarkdown.safeHttpsLink("javascript:alert(1)"))
        assertNull(NativeMarkdown.safeHttpsLink("http://example.com"))
        assertNull(NativeMarkdown.safeHttpsLink("https://user:pass@example.com"))
        assertNull(NativeMarkdown.safeHttpsLink("https://example.com/abc def"))
        assertTrue(NativeMarkdown.safeHttpsLink("https://example.com/buku?q=1")!!.startsWith("https://"))
    }

    @Test fun maliciousHtmlIsNotExecuted() {
        val parsed = NativeMarkdown.parse("<script>alert('x')</script>")
        assertEquals(MarkdownKind.TEXT, parsed[0].kind)
        assertTrue(parsed[0].text.contains("<script>"))
    }

    @Test fun unfinishedCodeRetained() {
        val ticks = "\u0060\u0060\u0060"
        val blocks = NativeMarkdown.parse(ticks + "text\nhello")
        assertEquals(MarkdownKind.CODE, blocks.last().kind)
        assertEquals("hello", blocks.last().text)
    }
}
