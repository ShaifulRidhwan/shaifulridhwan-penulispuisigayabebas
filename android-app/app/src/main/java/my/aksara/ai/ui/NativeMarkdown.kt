package my.aksara.ai.ui

import java.net.URI

enum class MarkdownKind { TEXT, HEADING, BULLET, QUOTE, CODE, TABLE, RULE, EMPTY }

data class NativeMarkdownBlock(
    val kind: MarkdownKind,
    val text: String = "",
    val level: Int = 0,
    val language: String = "",
    val cells: List<List<String>> = emptyList()
)

/** Strict text-only parser. Never executes HTML or downloads remote images. */
object NativeMarkdown {
    private val heading = Regex("""^\s{0,3}(#{1,6})\s+(.+)$""")
    private val bullet = Regex("""^(\s*)[-*+]\s+(.+)$""")
    private val number = Regex("""^(\s*)(\d{1,3})[.)]\s+(.+)$""")
    private val separator = Regex("""^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$""")
    private val divider = Regex("""^\s*(?:-{3,}|\*{3,}|_{3,})\s*$""")

    fun safeHttpsLink(value: String): String? {
        if (value.length !in 9..1024 || value.any { it.isWhitespace() || it.isISOControl() })
            return null
        return runCatching {
            val uri = URI(value)
            if (uri.scheme?.lowercase() != "https" ||
                uri.host.isNullOrBlank() || uri.rawUserInfo != null
            ) null else uri.toASCIIString()
        }.getOrNull()
    }

    fun parse(source: String): List<NativeMarkdownBlock> {
        val lines = source.replace("\r\n", "\n").take(120_000).lines()
        val out = mutableListOf<NativeMarkdownBlock>()
        val code = StringBuilder()
        val ticks = 96.toChar().toString().repeat(3)
        var inCode = false
        var codeMarker = ""
        var codeLanguage = ""
        var i = 0
        while (i < lines.size) {
            val line = lines[i].trimEnd()
            val trimmed = line.trimStart()
            val opens = when {
                trimmed.startsWith("~~~") -> "~~~"
                trimmed.startsWith(ticks) -> ticks
                else -> ""
            }
            if (inCode) {
                if (opens == codeMarker) {
                    out.add(NativeMarkdownBlock(MarkdownKind.CODE, code.toString().trimEnd('\n'),
                        language = codeLanguage))
                    code.clear()
                    inCode = false
                } else {
                    code.append(line).append('\n')
                }
                i++
                continue
            }
            if (opens.isNotBlank()) {
                inCode = true
                codeMarker = opens
                codeLanguage = trimmed.removePrefix(opens).trim().take(24)
                i++
                continue
            }
            if (trimmed.startsWith("|") && i + 1 < lines.size &&
                separator.matches(lines[i + 1].trim())
            ) {
                val rows = mutableListOf<List<String>>()
                rows.add(tableCells(trimmed))
                i += 2
                while (i < lines.size && lines[i].trimStart().startsWith("|") &&
                    rows.size < 41
                ) {
                    rows.add(tableCells(lines[i].trim()))
                    i++
                }
                out.add(NativeMarkdownBlock(MarkdownKind.TABLE, cells = rows))
                continue
            }
            val title = heading.matchEntire(line)
            val list = bullet.matchEntire(line)
            val numbered = number.matchEntire(line)
            out.add(
                when {
                    trimmed.isBlank() -> NativeMarkdownBlock(MarkdownKind.EMPTY)
                    title != null -> NativeMarkdownBlock(
                        MarkdownKind.HEADING, title.groupValues[2], title.groupValues[1].length
                    )
                    divider.matches(trimmed) -> NativeMarkdownBlock(MarkdownKind.RULE)
                    trimmed.startsWith("> ") ->
                        NativeMarkdownBlock(MarkdownKind.QUOTE, trimmed.drop(2))
                    list != null ->
                        NativeMarkdownBlock(MarkdownKind.BULLET, "•  " +
                            list.groupValues[2], level = list.groupValues[1].length / 2)
                    numbered != null -> NativeMarkdownBlock(
                        MarkdownKind.BULLET,
                        numbered.groupValues[2] + ".  " + numbered.groupValues[3],
                        level = numbered.groupValues[1].length / 2
                    )
                    else -> NativeMarkdownBlock(MarkdownKind.TEXT, line)
                }
            )
            i++
        }
        if (inCode) out.add(NativeMarkdownBlock(MarkdownKind.CODE,
            code.toString().trimEnd('\n'), language = codeLanguage))
        return out
    }

    private fun tableCells(line: String): List<String> =
        line.trim().trim('|').split('|').take(8).map { it.trim().take(450) }
}
