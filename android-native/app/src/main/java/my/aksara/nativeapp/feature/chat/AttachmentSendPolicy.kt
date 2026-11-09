package my.aksara.nativeapp.feature.chat

/** The input picker is category-specific; the reader still validates actual MIME and bytes. */
object AttachmentSendPolicy {
    fun mimeTypes(category: String): Array<String> = when (category) {
        "Foto" -> arrayOf("image/*")
        "Video" -> arrayOf("video/*")
        "Audio" -> arrayOf("audio/*")
        "Dokumen" -> arrayOf(
            "text/*", "application/pdf", "application/json",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/octet-stream"
        )
        else -> arrayOf("image/*", "video/*", "audio/*", "text/*", "application/pdf")
    }

    fun submissionText(draft: String, hasAttachments: Boolean): String {
        val typed = draft.trim()
        if (typed.isNotEmpty()) return typed
        return if (hasAttachments) "Sila analisis kandungan lampiran ini." else ""
    }
}
