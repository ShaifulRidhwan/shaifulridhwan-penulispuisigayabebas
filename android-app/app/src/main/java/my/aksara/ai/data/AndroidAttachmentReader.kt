package my.aksara.ai.data

import android.content.ContentResolver
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.util.Locale

/** Files exist in memory for one request only; no raw attachments enter ChatStore. */
data class AttachmentDraft(
    val names: List<String>,
    val media: List<ChatMedia>,
    val documentText: String,
    val documentName: String
) {
    val displayName: String get() = names.joinToString(", ")
}

object AttachmentRules {
    const val MAX_MEDIA_BYTES = 3_400_000
    val supportedMedia = setOf(
        "image/jpeg", "image/png", "image/webp", "image/gif",
        "video/mp4", "video/webm",
        "audio/mpeg", "audio/wav", "audio/mp4", "audio/ogg", "audio/webm",
        "application/pdf"
    )
    val supportedText = setOf("text/plain", "text/markdown", "text/csv")
    fun normalizeMime(mime: String, name: String): String {
        val clean = mime.substringBefore(";").trim().lowercase(Locale.ROOT)
        val ext = name.substringAfterLast(".", "").lowercase(Locale.ROOT)
        if (ext in listOf("txt", "md", "csv")) {
            return when (ext) {
                "md" -> "text/markdown"
                "csv" -> "text/csv"
                else -> "text/plain"
            }
        }
        return clean
    }
}

class AndroidAttachmentReader(private val resolver: ContentResolver) {
    suspend fun load(uris: List<Uri>): AttachmentDraft = withContext(Dispatchers.IO) {
        if (uris.isEmpty() || uris.size > 3) {
            throw IOException("Pilih antara satu hingga tiga fail sahaja.")
        }
        val names = mutableListOf<String>()
        val media = mutableListOf<ChatMedia>()
        val documents = mutableListOf<String>()
        var totalBytes = 0
        for (uri in uris) {
            val queried = resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
            val original = queried?.use { cursor ->
                if (cursor.moveToFirst()) cursor.getString(0) else null
            } ?: "lampiran"
            val name = original.replace(Regex("""[\r\n<>]"""), "_").take(100)
            val mime = AttachmentRules.normalizeMime(
                resolver.getType(uri) ?: "application/octet-stream", name
            )
            if (mime !in AttachmentRules.supportedMedia &&
                mime !in AttachmentRules.supportedText
            ) throw IOException("Format $mime belum disokong.")
            val remaining = AttachmentRules.MAX_MEDIA_BYTES - totalBytes
            val bytes = resolver.openInputStream(uri)?.use { input ->
                val output = ByteArrayOutputStream()
                val buffer = ByteArray(8192)
                while (true) {
                    val amount = input.read(buffer)
                    if (amount == -1) break
                    if (output.size() + amount > remaining) {
                        throw IOException("Jumlah lampiran melebihi 3.4 MB.")
                    }
                    output.write(buffer, 0, amount)
                }
                output.toByteArray()
            } ?: throw IOException("Fail '$name' tidak dapat dibaca.")
            totalBytes += bytes.size
            if (bytes.isEmpty()) throw IOException("Fail '$name' kosong.")
            names.add(name)
            if (mime in AttachmentRules.supportedText) {
                val string = bytes.toString(Charsets.UTF_8)
                if (string.length > 100_000) throw IOException("Teks fail terlalu panjang.")
                documents.add("[FAIL: $name]\n$string")
            } else {
                media.add(
                    ChatMedia(
                        mimeType = mime,
                        data = Base64.encodeToString(bytes, Base64.NO_WRAP),
                        name = name
                    )
                )
            }
        }
        val combined = documents.joinToString("\n\n")
        if (combined.length > 100_000) throw IOException("Dokumen melebihi had konteks.")
        AttachmentDraft(
            names = names,
            media = media,
            documentText = combined,
            documentName = names.joinToString(", ").take(100)
        )
    }
}
