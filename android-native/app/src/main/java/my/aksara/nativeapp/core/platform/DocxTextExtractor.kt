package my.aksara.nativeapp.core.platform

import org.w3c.dom.Node
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.zip.ZipInputStream
import javax.xml.XMLConstants
import javax.xml.parsers.DocumentBuilderFactory

/** Parses user-supplied DOCX text locally. No external entities or executable macros. */
object DocxTextExtractor {
    private const val WORD_NS="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    fun extract(document:ByteArray,maxChars:Int=100_000):String {
        require(document.isNotEmpty()&&document.size<=3_600_000){"Saiz DOCX tidak dibenarkan."}
        require(maxChars in 1..1_000_000)
        var wordXml:ByteArray?=null
        ZipInputStream(ByteArrayInputStream(document)).use { zip ->
            var entries=0
            while(true){
                val entry=zip.nextEntry?:break
                require(++entries<=250){"Terlalu banyak bahagian dalam DOCX."}
                if(!entry.isDirectory&&entry.name=="word/document.xml"){
                    val output=ByteArrayOutputStream()
                    val buffer=ByteArray(8192)
                    while(true){
                        val n=zip.read(buffer)
                        if(n<0)break
                        require(output.size()+n<=2_500_000){"Teks XML DOCX terlalu besar."}
                        output.write(buffer,0,n)
                    }
                    wordXml=output.toByteArray()
                    break
                }
                zip.closeEntry()
            }
        }
        val xml=wordXml?:throw IllegalArgumentException("DOCX tidak mengandungi word/document.xml.")
        val factory=DocumentBuilderFactory.newInstance().apply {
            isNamespaceAware=true
            isExpandEntityReferences=false
            isXIncludeAware=false
            setFeature(XMLConstants.FEATURE_SECURE_PROCESSING,true)
            setFeature("http://apache.org/xml/features/disallow-doctype-decl",true)
            setFeature("http://xml.org/sax/features/external-general-entities",false)
            setFeature("http://xml.org/sax/features/external-parameter-entities",false)
        }
        val root=factory.newDocumentBuilder().parse(ByteArrayInputStream(xml))
        val paragraphs=root.getElementsByTagNameNS(WORD_NS,"p")
        val answer=StringBuilder()
        fun append(node:Node){
            if(node.namespaceURI==WORD_NS){
                when(node.localName){
                    "t" -> {answer.append(node.textContent);return}
                    "tab" -> {answer.append('\t');return}
                    "br","cr" -> {answer.append('\n');return}
                }
            }
            val children=node.childNodes
            for(i in 0 until children.length)append(children.item(i))
        }
        for(i in 0 until paragraphs.length){
            if(i>0)answer.append('\n')
            append(paragraphs.item(i))
            require(answer.length<=maxChars){"Teks DOCX melebihi had "+maxChars+" aksara."}
        }
        return answer.toString().trim().also {
            require(it.isNotEmpty()){"DOCX tiada teks yang boleh dibaca."}
        }
    }
}
