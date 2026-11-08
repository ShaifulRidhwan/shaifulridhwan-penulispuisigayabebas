package my.aksara.nativeapp

import my.aksara.nativeapp.core.platform.DocxTextExtractor
import my.aksara.nativeapp.core.storage.Message
import my.aksara.nativeapp.feature.chat.mergeSessionArchive
import org.junit.Assert.*
import org.junit.Test
import java.io.ByteArrayOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class NativeIntegrationContractTest {
    private fun docx(xml:String):ByteArray {
        val out=ByteArrayOutputStream()
        ZipOutputStream(out).use { zip ->
            zip.putNextEntry(ZipEntry("word/document.xml"))
            zip.write(xml.toByteArray())
            zip.closeEntry()
        }
        return out.toByteArray()
    }
    @Test fun extractsRealDocxParagraphsAndEntities() {
        val xml="""<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Aksara &amp; Kod</w:t></w:r></w:p><w:p><w:r><w:t>Baris kedua</w:t></w:r></w:p></w:body></w:document>"""
        assertEquals("Aksara & Kod\nBaris kedua",DocxTextExtractor.extract(docx(xml)))
    }
    @Test fun rejectsXmlExternalEntityDeclaration() {
        val xml="""<!DOCTYPE w:document [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>&xxe;</w:t></w:r></w:p></w:document>"""
        assertThrows(Exception::class.java){DocxTextExtractor.extract(docx(xml))}
    }
    @Test fun keepsEarlierArchiveWhenScreenIsCleared() {
        val earlier=Message("old","user","Old conversation")
        val fresh=Message("new","user","New conversation")
        val saved=mergeSessionArchive(listOf(earlier),listOf(fresh))
        assertEquals(listOf("old","new"),saved.map { it.id })
    }
    @Test fun streamingUpdateReplacesBubbleWithoutDuplicating() {
        val partial=Message("reply","assistant","hello",incomplete=true)
        val done=partial.copy(text="hello world",incomplete=false)
        val saved=mergeSessionArchive(listOf(partial),listOf(done))
        assertEquals(1,saved.size)
        assertEquals("hello world",saved.single().text)
        assertFalse(saved.single().incomplete)
    }
}
