package my.aksara.nativeapp.core.platform

import org.w3c.dom.Element
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.zip.ZipInputStream
import javax.xml.parsers.DocumentBuilderFactory

/** Bounded first-worksheet XLSX -> CSV. Never executes Excel formulae. */
internal object SpreadsheetTextExtractor {
    fun toCsv(bytes:ByteArray):String {
        require(bytes.size<=3_600_000) { "XLSX melebihi had 3.6 MB." }
        var unpacked=0
        var stringsXml:ByteArray?=null
        var sheetXml:ByteArray?=null
        var first=Int.MAX_VALUE
        ZipInputStream(ByteArrayInputStream(bytes)).use { zip ->
            while(true) {
                val entry=zip.nextEntry ?: break
                val sheet=Regex("""xl/worksheets/sheet(\d+)\.xml""").matchEntire(entry.name)
                val save=entry.name=="xl/sharedStrings.xml" || sheet!=null
                val out=ByteArrayOutputStream()
                val buffer=ByteArray(8192)
                while(true) {
                    val size=zip.read(buffer)
                    if(size<0)break
                    unpacked+=size
                    require(unpacked<=12_000_000) { "Kandungan XLSX terlalu besar." }
                    if(save&&size>0)out.write(buffer,0,size)
                }
                if(entry.name=="xl/sharedStrings.xml")stringsXml=out.toByteArray()
                if(sheet!=null) {
                    val no=sheet.groupValues[1].toInt()
                    if(no<first){first=no;sheetXml=out.toByteArray()}
                }
                zip.closeEntry()
            }
        }
        val page=sheetXml ?: throw IllegalArgumentException("XLSX tiada worksheet.")
        val shared=stringsXml?.let {
            val nodes=parse(it).getElementsByTagName("si")
            require(nodes.length<=10000) { "XLSX terlalu banyak shared strings." }
            (0 until nodes.length).map { i -> nodes.item(i).textContent.orEmpty().take(2000) }
        } ?: emptyList()
        val nodes=parse(page).getElementsByTagName("row")
        val data=ArrayList<List<String>>()
        for(i in 0 until minOf(251,nodes.length)) {
            val row=nodes.item(i) as? Element ?: continue
            val values=MutableList(30){""}
            val cells=row.getElementsByTagName("c")
            var fallback=0
            for(j in 0 until cells.length){
                val c=cells.item(j) as? Element ?: continue
                val letters=c.getAttribute("r").takeWhile { it.isLetter() }.uppercase()
                val col=if(letters.isEmpty()) fallback else letters.fold(0){sum,ch->
                    (sum*26+ch.code-'A'.code+1).coerceAtMost(31)
                }-1
                fallback=col+1
                if(col !in 0..29)continue
                val raw=c.getElementsByTagName("v").item(0)?.textContent.orEmpty()
                values[col]=when(c.getAttribute("t")) {
                    "s" -> shared.getOrNull(raw.toIntOrNull()?:-1).orEmpty()
                    "inlineStr" -> c.getElementsByTagName("is").item(0)?.textContent.orEmpty()
                    "b" -> if(raw=="1")"TRUE" else "FALSE"
                    else -> raw
                }.replace("\u0000","").take(2000)
            }
            if(values.any(String::isNotBlank))data+=values
        }
        require(data.size>=2) { "XLSX memerlukan tajuk dan sekurang-kurangnya satu baris." }
        val width=data.maxOf { row -> row.indexOfLast(String::isNotBlank)+1 }.coerceIn(1,30)
        val header=data.first().take(width).mapIndexed { i,txt ->
            txt.trim().ifBlank { "Kolum "+(i+1) }.take(50)
        }
        require(header.size==header.toSet().size) { "Tajuk kolum mesti unik." }
        val rows=listOf(header)+data.drop(1).take(250).map{it.take(width)}
        val csv=rows.joinToString("\n"){row->row.joinToString(","){cell->
            if(cell.any { it==',' || it=='"' || it=='\n' || it=='\r' })
                "\""+cell.replace("\"","\"\"")+"\"" else cell
        }}
        require(csv.length<=100_000) { "XLSX terlalu besar untuk backend analisis." }
        return csv
    }
    private fun parse(bytes:ByteArray):org.w3c.dom.Document {
        val f=DocumentBuilderFactory.newInstance()
        f.setFeature("http://apache.org/xml/features/disallow-doctype-decl",true)
        f.setFeature("http://xml.org/sax/features/external-general-entities",false)
        f.setFeature("http://xml.org/sax/features/external-parameter-entities",false)
        f.isExpandEntityReferences=false
        f.isXIncludeAware=false
        return f.newDocumentBuilder().parse(ByteArrayInputStream(bytes))
    }
}
