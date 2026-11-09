package my.aksara.nativeapp.feature.chat

import my.aksara.nativeapp.core.storage.Message
import java.util.UUID

/**
 * A branch is a new independent, append-only encrypted conversation.
 * Original message IDs and archived answers are never mutated or overwritten.
 * Raw attachment bytes and signed receipts deliberately do not belong to Message.
 */
internal object ChatBranching {
    fun prefix(
        conversation: List<Message>,
        messageId: String,
        includeSelected: Boolean,
        newId: () -> String = { UUID.randomUUID().toString() }
    ): List<Message>? {
        val index = conversation.indexOfFirst { it.id == messageId }
        if (index < 0 || conversation[index].incomplete) return null
        val end = index + if (includeSelected) 1 else 0
        return conversation.take(end).map { it.copy(id = newId()) }
    }

    fun editable(message: Message): Boolean =
        message.role == "user" && !message.incomplete &&
            !message.text.contains("[Lampiran: ")

    fun questionForRegeneration(conversation: List<Message>, answerId: String): Message? {
        val answerIndex = conversation.indexOfFirst { it.id == answerId }
        if (answerIndex <= 0) return null
        val answer = conversation[answerIndex]
        if (answer.role != "assistant" || answer.incomplete) return null
        return conversation.subList(0, answerIndex).lastOrNull { editable(it) }
    }
}
