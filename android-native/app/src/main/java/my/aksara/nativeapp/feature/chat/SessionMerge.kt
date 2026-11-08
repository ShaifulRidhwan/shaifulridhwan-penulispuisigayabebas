package my.aksara.nativeapp.feature.chat

import my.aksara.nativeapp.core.storage.Message

/**
 * Clearing the visible chat must never delete the encrypted archive.
 * Updated streaming bubbles replace their earlier version by stable id.
 */
fun mergeSessionArchive(archive:List<Message>,current:List<Message>):List<Message> {
    val byId=LinkedHashMap<String,Message>()
    (archive+current).forEach { message -> byId[message.id]=message }
    return byId.values.toList().takeLast(200)
}
