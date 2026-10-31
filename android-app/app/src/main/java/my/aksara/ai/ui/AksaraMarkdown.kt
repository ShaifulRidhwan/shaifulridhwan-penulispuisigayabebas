package my.aksara.ai.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private enum class BlockKind { TEXT, HEADING, BULLET, QUOTE, CODE, EMPTY }
private data class MarkdownBlock(val kind: BlockKind, val text: String)
private val tokenPattern = Regex(
    """(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_|\x60[^\x60\n]+\x60|\[[^\]\n]+\]\(https?://[^)\s]+\))"""
)
private val numbered = Regex("""^\s*\d+[.)]\s+""")
private val fence = 96.toChar().toString().repeat(3)

private fun markdownBlocks(source: String): List<MarkdownBlock> {
    val out = mutableListOf<MarkdownBlock>()
    val code = StringBuilder()
    var codeOpen = false
    source.replace("\r\n", "\n").lines().forEach { raw ->
        val line = raw.trimEnd()
        if (line.trimStart().startsWith(fence) || line.trimStart().startsWith("~~~")) {
            if (codeOpen) {
                out.add(MarkdownBlock(BlockKind.CODE, code.toString().trimEnd('\n')))
                code.clear()
            }
            codeOpen = !codeOpen
        } else if (codeOpen) {
            code.append(line).append('\n')
        } else {
            val t = line.trimStart()
            out.add(
                when {
                    t.isBlank() -> MarkdownBlock(BlockKind.EMPTY, "")
                    t.startsWith("# ") || t.startsWith("## ") || t.startsWith("### ") ->
                        MarkdownBlock(BlockKind.HEADING, t.trimStart('#', ' '))
                    t.startsWith("> ") -> MarkdownBlock(BlockKind.QUOTE, t.removePrefix("> "))
                    t.startsWith("- ") || t.startsWith("* ") ->
                        MarkdownBlock(BlockKind.BULLET, "•  " + t.drop(2))
                    numbered.containsMatchIn(t) -> MarkdownBlock(BlockKind.BULLET, t)
                    else -> MarkdownBlock(BlockKind.TEXT, line)
                }
            )
        }
    }
    if (codeOpen) out.add(MarkdownBlock(BlockKind.CODE, code.toString().trimEnd('\n')))
    return out
}

private fun formattedInline(value: String): AnnotatedString = buildAnnotatedString {
    var offset = 0
    tokenPattern.findAll(value).forEach { match ->
        append(value.substring(offset, match.range.first))
        val token = match.value
        when {
            (token.startsWith("**") && token.endsWith("**")) ||
                (token.startsWith("__") && token.endsWith("__")) -> {
                withStyle(SpanStyle(fontWeight = FontWeight.Bold)) {
                    append(token.substring(2, token.length - 2))
                }
            }
            (token.startsWith("*") && token.endsWith("*")) ||
                (token.startsWith("_") && token.endsWith("_")) -> {
                withStyle(SpanStyle(fontStyle = androidx.compose.ui.text.font.FontStyle.Italic)) {
                    append(token.substring(1, token.length - 1))
                }
            }
            token.firstOrNull() == 96.toChar() -> {
                withStyle(
                    SpanStyle(
                        fontFamily = FontFamily.Monospace,
                        color = Color(0xFFBED5FF)
                    )
                ) { append(token.substring(1, token.length - 1)) }
            }
            token.startsWith("[") -> {
                val end = token.indexOf(']')
                val label = token.substring(1, end)
                val url = token.substring(end + 2, token.length - 1)
                withStyle(
                    SpanStyle(
                        color = Color(0xFFB9CBFF),
                        textDecoration = TextDecoration.Underline
                    )
                ) { append(label) }
                append(" ($url)")
            }
            else -> append(token)
        }
        offset = match.range.last + 1
    }
    append(value.substring(offset))
}

/** Safe native renderer; never executes HTML or remote content. */
@Composable
fun MarkdownMessage(source: String) {
    val blocks = remember(source) { markdownBlocks(source) }
    Column {
        blocks.forEach { block ->
            when (block.kind) {
                BlockKind.EMPTY -> Spacer(Modifier.height(7.dp))
                BlockKind.CODE -> Text(
                    text = block.text,
                    modifier = Modifier
                        .background(Color(0xFF090F20), RoundedCornerShape(10.dp))
                        .padding(12.dp),
                    color = Color(0xFFD1DEFF),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 12.sp,
                    lineHeight = 18.sp
                )
                BlockKind.HEADING -> Text(
                    formattedInline(block.text),
                    color = Color(0xFFF3F5FF),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                BlockKind.QUOTE -> Text(
                    formattedInline("│  " + block.text),
                    color = Color(0xFFC8CAE8),
                    style = MaterialTheme.typography.bodyLarge
                )
                BlockKind.TEXT, BlockKind.BULLET -> Text(
                    formattedInline(block.text),
                    color = Color(0xFFF0F3FF),
                    style = MaterialTheme.typography.bodyLarge
                )
            }
        }
    }
}
