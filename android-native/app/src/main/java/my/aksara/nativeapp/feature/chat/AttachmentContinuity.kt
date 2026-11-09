package my.aksara.nativeapp.feature.chat

import org.json.JSONArray
import java.util.Locale

/** Retained media bytes/file receipts stay in RAM, never in chat history, logs or SharedPreferences. */
internal data class ActiveAttachment(
    val names: List<String>,
    val documentText: String,
    val documentName: String,
    val mediaJson: String,
    val receiptsJson: String,
    val sinceMs: Long
) {
    val hasReceipts get() = JSONArray(receiptsJson).length() > 0
}
internal object AttachmentContinuity {
    const val FILE_RECEIPT_SAFE_MS = 2L * 60 * 60 * 1000 + 45L * 60 * 1000
    private val generic = Regex("""(?i)\b(?:lampiran|fail|file|attachment|yang tadi|sebelum ini|tadi tu|yang aku hantar|yang dah hantar|that file|uploaded|kandungan tadi)\b""")
    private val audio = Regex("""(?i)\b(?:audio|lagu|lirik|musik|muzik|melodi|nyanyian|transkrip|transkripsi|chorus|korus|lyrics|song|melankolik)\b""")
    private val image = Regex("""(?i)\b(?:gambar|foto|imej|photo|picture|image|visual|poster|potret)\b""")
    private val video = Regex("""(?i)\b(?:video|klip|rakaman|scene|adegan)\b""")
    private val document = Regex("""(?i)\b(?:dokumen|pdf|docx|word|csv|json|teks|buku|halaman|perenggan|jadual|document|spreadsheet)\b""")
    fun references(question: String, names: List<String>): Boolean {
        val text = question.trim()
        if (text.isBlank()) return false
        if (generic.containsMatchIn(text)) return true
        val extensions = names.map { it.substringAfterLast('.', "").lowercase(Locale.ROOT) }
        return (extensions.any { it in setOf("mp3","m4a","wav","ogg","flac","aac") } && audio.containsMatchIn(text)) ||
            (extensions.any { it in setOf("jpg","jpeg","png","webp","heic","heif","gif") } && image.containsMatchIn(text)) ||
            (extensions.any { it in setOf("mp4","webm","mov") } && video.containsMatchIn(text)) ||
            (extensions.any { it in setOf("pdf","docx","txt","md","csv","json","xml","html","kt","py") } && document.containsMatchIn(text))
    }
    fun receiptValid(context: ActiveAttachment, nowMs: Long): Boolean =
        !context.hasReceipts || nowMs >= context.sinceMs &&
            nowMs - context.sinceMs < FILE_RECEIPT_SAFE_MS
    fun manifest(names: List<String>): String =
        names.take(4).joinToString(", ") { it.replace(Regex("""[\[\]]"""),"").replace(Regex("""\s+""")," ").trim().take(100) }
}
