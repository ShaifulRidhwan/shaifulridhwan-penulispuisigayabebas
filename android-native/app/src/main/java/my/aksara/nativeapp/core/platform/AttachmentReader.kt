package my.aksara.nativeapp.core.platform

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.util.Locale

data class Attachment(val name:String,val text:String="",val media:JSONObject?=null)
object AttachmentReader {
    private val inlineMedia=setOf("image/jpeg","image/png","image/webp",
        "audio/webm","audio/ogg","audio/mp4","audio/mpeg","audio/wav",
        "video/mp4","video/webm","application/pdf")
    private val textExtensions=setOf("txt","md","markdown","csv","json","js","mjs",
        "ts","tsx","jsx","html","htm","css","py","sql","c","cc","cpp","h","hpp","kt","xml","yaml","yml")
    suspend fun read(context:Context,uri:Uri):Attachment=withContext(Dispatchers.IO){
        val resolver=context.contentResolver
        val name=resolver.query(uri,arrayOf(OpenableColumns.DISPLAY_NAME),null,null,null)
            ?.use { cursor -> if(cursor.moveToFirst())cursor.getString(0) else null }?:"lampiran"
        val mime=resolver.getType(uri).orEmpty().lowercase(Locale.ROOT)
        val extension=name.substringAfterLast('.', "").lowercase(Locale.ROOT)
        val docx=extension=="docx"||mime=="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        val media=mime in inlineMedia
        val limit=if(media||docx)3_600_000 else 100_000
        val bytes=resolver.openInputStream(uri)?.use{it.readBounded(limit+1)}
            ?:throw IllegalArgumentException("Fail tidak boleh dibaca.")
        require(bytes.size<=limit) {
            if(media||docx)"Lampiran melebihi had 3.6 MB. Pilih fail lebih kecil."
            else "Dokumen teks melebihi had 100 KB."
        }
        when {
            docx -> Attachment(name,text=DocxTextExtractor.extract(bytes))
            media -> Attachment(name,media=JSONObject().put("name",name)
                .put("mimeType",mime).put("data",Base64.encodeToString(bytes,Base64.NO_WRAP)))
            else -> {
                require(mime.startsWith("text/")||mime=="application/json"||
                    mime=="application/octet-stream"&&extension in textExtensions||
                    extension in textExtensions){"Format fail ini belum disokong untuk analisis."}
                require(!bytes.contains(0)){"Fail binari tidak boleh dibaca sebagai teks."}
                val decoder=Charsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                val content=try{decoder.decode(ByteBuffer.wrap(bytes)).toString()}
                    catch(_:Exception){throw IllegalArgumentException("Fail teks mesti menggunakan UTF-8 yang sah.")}
                Attachment(name,text=content)
            }
        }
    }
}

private fun java.io.InputStream.readBounded(limit:Int):ByteArray {
    val out=java.io.ByteArrayOutputStream();val buffer=ByteArray(8192)
    while(out.size()<limit){
        val n=read(buffer,0,minOf(buffer.size,limit-out.size()))
        if(n<0)break
        if(n>0)out.write(buffer,0,n)
    }
    return out.toByteArray()
}
