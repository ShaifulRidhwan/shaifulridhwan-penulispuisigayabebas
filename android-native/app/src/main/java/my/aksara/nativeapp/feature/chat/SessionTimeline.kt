package my.aksara.nativeapp.feature.chat

import my.aksara.nativeapp.core.storage.Message

/** Explicit session boundaries survive app restarts. Legacy flat archives stay intact as one session. */
data class ArchivedConversation(val startId: String, val messages: List<Message>) {
    val lastAt: Long get() = messages.lastOrNull()?.at ?: 0L
    val title: String get() = messages.firstOrNull { it.role == "user" && it.text.isNotBlank() }
        ?.text?.replace(Regex("\\s+"), " ")?.take(80) ?: "Perbualan suara"
}
fun groupSessions(archive: List<Message>, sessionStarts: List<String>): List<ArchivedConversation> {
    if (archive.isEmpty()) return emptyList()
    val starts = sessionStarts.toSet()
    val result = mutableListOf<ArchivedConversation>()
    var current = mutableListOf<Message>()
    fun flush() {
        if (current.isNotEmpty()) {
            result.add(ArchivedConversation(current.first().id, current.toList()))
            current = mutableListOf()
        }
    }
    archive.forEach { message ->
        if (message.id in starts && current.isNotEmpty()) flush()
        current.add(message)
    }
    flush()
    return result
}
