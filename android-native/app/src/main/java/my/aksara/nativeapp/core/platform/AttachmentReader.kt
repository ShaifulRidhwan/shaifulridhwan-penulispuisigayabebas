package my.aksara.nativeapp.core.platform

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.util.Locale

data class Attachment(val name:String,val text:String="",val media:JSONObject?=null)
object AttachmentReader {
    private val inlineMedia=setOf("image/jpeg","image/png","image/webp","image/gif",
        "audio/webm","audio/ogg","audio/mp4","audio/mpeg","audio/wav",
        "video/mp4","video/webm","application/pdf")
    private val supportedImages = setOf("image/jpeg","image/png","image/webp","image/heic","image/heif","image/gif")
    private const val MAX_INLINE_BYTES = 3_600_000
    private const val MAX_IMAGE_INPUT_BYTES = 22_000_000
    private fun extensionMime(extension:String):String?=when(extension) {
        "jpg","jpeg" -> "image/jpeg"
        "png" -> "image/png"
        "webp" -> "image/webp"
        "gif" -> "image/gif"
        "heic" -> "image/heic"
        "heif" -> "image/heif"
        "mp4" -> "video/mp4"
        "webm" -> "video/webm"
        "mp3" -> "audio/mpeg"
        "m4a" -> "audio/mp4"
        "wav" -> "audio/wav"
        "ogg" -> "audio/ogg"
        "pdf" -> "application/pdf"
        else -> null
    }
    private val textExtensions=setOf("txt","md","markdown","csv","json","js","mjs",
        "ts","tsx","jsx","html","htm","css","py","sql","c","cc","cpp","h","hpp","kt","xml","yaml","yml")
    suspend fun read(context:Context,uri:Uri):Attachment=withContext(Dispatchers.IO){
        val resolver=context.contentResolver
        val name=resolver.query(uri,arrayOf(OpenableColumns.DISPLAY_NAME),null,null,null)
            ?.use { cursor -> if(cursor.moveToFirst())cursor.getString(0) else null }?:"lampiran"
        val reportedMime=resolver.getType(uri).orEmpty().lowercase(Locale.ROOT)
        val extension=name.substringAfterLast('.', "").lowercase(Locale.ROOT)
        val mime=if(reportedMime.isBlank() || reportedMime=="application/octet-stream")
            extensionMime(extension) ?: reportedMime else reportedMime
        val docx=extension=="docx"||mime=="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        val image=mime in supportedImages
        val media=mime in inlineMedia || image
        val limit=if(image)MAX_IMAGE_INPUT_BYTES else if(media||docx)MAX_INLINE_BYTES else 100_000
        val bytes=resolver.openInputStream(uri)?.use{it.readBounded(limit+1)}
            ?:throw IllegalArgumentException("Fail tidak boleh dibaca.")
        require(bytes.size<=limit) {
            when {
                image -> "Gambar melebihi had 22 MB untuk pengecilan. Pilih gambar lebih kecil."
                media -> "Lampiran melebihi had penghantaran terus 3.6 MB. Pilih klip atau fail lebih kecil."
                docx -> "Dokumen DOCX melebihi had 3.6 MB."
                else -> "Dokumen teks melebihi had 100 KB."
            }
        }
        when {
            docx -> Attachment(name,text=DocxTextExtractor.extract(bytes))
            image -> {
                val (imageMime,processed)=prepareImage(bytes,mime)
                Attachment(name,media=JSONObject().put("name",name)
                    .put("mimeType",imageMime).put("data",Base64.encodeToString(processed,Base64.NO_WRAP)))
            }
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

    /**
     * Camera photos frequently exceed the Netlify buffered payload cap.
     * Shrink *real image bytes* into the existing verified Gemini inlineData contract;
     * never silently truncate an image or send a fake attachment.
     */
    internal fun prepareImage(raw:ByteArray,mime:String):Pair<String,ByteArray> {
        if(raw.size<=MAX_INLINE_BYTES && mime in inlineMedia && mime.startsWith("image/"))
            return mime to raw
        require(mime!="image/gif") { "GIF animasi terlalu besar untuk dihantar terus (3.6 MB)." }
        require(mime in supportedImages) { "Format gambar tidak disokong." }
        val dimensions=BitmapFactory.Options().apply { inJustDecodeBounds=true }
        BitmapFactory.decodeByteArray(raw,0,raw.size,dimensions)
        require(dimensions.outWidth in 1..16_000 && dimensions.outHeight in 1..16_000) {
            "Dimensi gambar tidak disokong atau fail rosak."
        }
        var sample=1
        while(maxOf(dimensions.outWidth,dimensions.outHeight)/sample>2560)sample*=2
        val options=BitmapFactory.Options().apply { inSampleSize=sample; inPreferredConfig=Bitmap.Config.ARGB_8888 }
        val decoded=BitmapFactory.decodeByteArray(raw,0,raw.size,options)
            ?:throw IllegalArgumentException("Gambar tidak dapat dibaca atau format tidak disokong.")
        var image=decoded
        try {
            // JPEG/HEIC EXIF orientation must not be lost during recompression.
            val orientation=runCatching {
                ExifInterface(ByteArrayInputStream(raw))
                    .getAttributeInt(ExifInterface.TAG_ORIENTATION,ExifInterface.ORIENTATION_NORMAL)
            }.getOrDefault(ExifInterface.ORIENTATION_NORMAL)
            val angle=when(orientation) {
                ExifInterface.ORIENTATION_ROTATE_90 -> 90f
                ExifInterface.ORIENTATION_ROTATE_180 -> 180f
                ExifInterface.ORIENTATION_ROTATE_270 -> 270f
                else -> 0f
            }
            if(angle!=0f) {
                val rotated=Bitmap.createBitmap(image,0,0,image.width,image.height,
                    Matrix().apply{postRotate(angle)},true)
                if(rotated!==image){image.recycle();image=rotated}
            }
            if(image.hasAlpha()) {
                val opaque=Bitmap.createBitmap(image.width,image.height,Bitmap.Config.ARGB_8888)
                val canvas=Canvas(opaque)
                canvas.drawColor(Color.WHITE)
                canvas.drawBitmap(image,0f,0f,null)
                image.recycle();image=opaque
            }
            for(round in 0..4) {
                for(quality in intArrayOf(85,75,65,55)) {
                    val out=ByteArrayOutputStream()
                    check(image.compress(Bitmap.CompressFormat.JPEG,quality,out)){"Gambar gagal dimampatkan."}
                    val processed=out.toByteArray()
                    if(processed.size<=MAX_INLINE_BYTES)return "image/jpeg" to processed
                }
                if(round!=4) {
                    val smaller=Bitmap.createScaledBitmap(image,
                        maxOf(1,(image.width*.75f).toInt()),
                        maxOf(1,(image.height*.75f).toInt()),true)
                    if(smaller!==image){image.recycle();image=smaller}
                }
            }
            throw IllegalArgumentException("Gambar terlalu besar selepas dimampatkan. Cuba gambar lebih kecil.")
        } finally { if(!image.isRecycled)image.recycle() }
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
