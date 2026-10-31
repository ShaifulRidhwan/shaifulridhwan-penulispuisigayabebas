package my.aksara.ai.ui

/** Text safe for system speech playback. No HTML execution or URL requests. */
object VoiceSpokenText {
    private val fence = 96.toChar().toString().repeat(3)
    fun clean(markdown: String): String = markdown
        .replace(Regex("(?s)" + Regex.escape(fence) + ".*?" + Regex.escape(fence)),
            " Bahagian kod boleh dibaca dalam chat. ")
        .replace(Regex("""(?s)~~~.*?~~~"""), " Bahagian kod boleh dibaca dalam chat. ")
        .replace(Regex("""!\[([^\]]*)\]\([^)]+\)"""), "$1")
        .replace(Regex("""\[([^\]]+)\]\(https?://[^)\s]+\)"""), "$1")
        .replace(Regex("""https?://\S+"""), "")
        .replace(Regex("""(?m)^\s{0,3}#{1,6}\s+"""), "")
        .replace(Regex("""(?m)^\s*>\s*"""), "")
        .replace(Regex("""(?m)^\s*[-*]\s+"""), "")
        .replace(Regex("""(?m)^\s*\d+[.)]\s+"""), "")
        .replace(Regex("[" + 96.toChar() + "*_~]"), "")
        .replace(Regex("""[ \t]+"""), " ")
        .replace(Regex("""\n{2,}"""), "\n")
        .trim().take(7_000)

    fun segments(markdown: String, chunkSize: Int = 1800): List<String> {
        val text = clean(markdown)
        if (text.isBlank()) return emptyList()
        val chunks = mutableListOf<String>()
        var index = 0
        while (index < text.length) {
            val end = minOf(index + chunkSize, text.length)
            val split = if (end == text.length) end else {
                val last = text.lastIndexOfAny(charArrayOf('.', '?', '!', '\n', ' '), end - 1)
                if (last > index + chunkSize / 2) last + 1 else end
            }
            chunks.add(text.substring(index, split).trim())
            index = split
        }
        return chunks.filter { it.isNotBlank() }
    }
}
