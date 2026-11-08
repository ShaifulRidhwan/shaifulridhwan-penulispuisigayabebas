package my.aksara.nativeapp.core.platform

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject

data class Attachment(val name:String,val text:String="",val media:JSONObject?=null)
object AttachmentReader {
    suspend fun read(context:Context,uri:Uri):Attachment=withContext(Dispatchers.IO){
        val resolver=context.contentResolver
        val name=resolver.query(uri,arrayOf(OpenableColumns.DISPLAY_NAME),null,null,null)?.use {cursor->if(cursor.moveToFirst())cursor.getString(0) else null}?:"lampiran"
        val mime=resolver.getType(uri).orEmpty()
        val media=mime in setOf("image/jpeg","image/png","image/webp","audio/webm","audio/ogg","audio/mp4","audio/mpeg","audio/wav","video/mp4","video/webm","application/pdf")
        val limit=if(media)3_600_000 else 100_000
        val bytes=resolver.openInputStream(uri)!!.use{it.readBounded(limit+1)}
        require(bytes.size<=limit){if(media)"Lampiran melebihi had API inline 3.6 MB. Pilih fail lebih kecil." else "Dokumen teks melebihi had 100 KB."}
        if(media)Attachment(name,media=JSONObject().put("name",name).put("mimeType",mime).put("data",Base64.encodeToString(bytes,Base64.NO_WRAP)))
        else {require(!bytes.contains(0)){"Pembaca format binari $mime belum tersedia."};Attachment(name,text=bytes.toString(Charsets.UTF_8))}
    }
}

private fun java.io.InputStream.readBounded(limit:Int):ByteArray {
    val out=java.io.ByteArrayOutputStream();val buffer=ByteArray(8192)
    while(out.size()<limit){val n=read(buffer,0,minOf(buffer.size,limit-out.size()));if(n<0)break;if(n>0)out.write(buffer,0,n)}
    return out.toByteArray()
}
