package my.aksara.nativeapp.feature.chat

/**
 * Lossless stream-to-frame aggregation. Mutable only on the owning chat coroutine.
 * It does not affect backend streaming, providers, Stop or saved transcripts.
 */
internal class StreamDeltaBuffer(private val publish:(String)->Unit) {
    private val pending=StringBuilder()
    fun append(text:String) { if (text.isNotEmpty()) pending.append(text) }
    fun flush() {
        if (pending.isEmpty()) return
        val batch=pending.toString()
        pending.setLength(0)
        publish(batch)
    }
}
