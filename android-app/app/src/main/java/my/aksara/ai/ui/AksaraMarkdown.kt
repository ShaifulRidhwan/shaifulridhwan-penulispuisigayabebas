package my.aksara.ai.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val LinkIce = Color(0xFFB7CBFF)
private val CodeInk = Color(0xFFDAE5FF)
private val ContentInk = Color(0xFFF0F3FF)
private val tokenPattern = Regex(
    """(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_|\x60[^\x60\n]+\x60|\[[^\]\n]+\]\(https?://[^)\s]+\))"""
)

private fun formattedInline(value: String): AnnotatedString = buildAnnotatedString {
    var position = 0
    tokenPattern.findAll(value).forEach { match ->
        append(value.substring(position, match.range.first))
        val token = match.value
        when {
            (token.startsWith("**") && token.endsWith("**")) ||
                (token.startsWith("__") && token.endsWith("__")) -> {
                withStyle(SpanStyle(fontWeight = FontWeight.Bold)) {
                    append(token.drop(2).dropLast(2))
                }
            }
            token.firstOrNull()?.code == 96 && token.lastOrNull()?.code == 96 -> {
                withStyle(SpanStyle(fontFamily = FontFamily.Monospace, color = CodeInk)) {
                    append(token.drop(1).dropLast(1))
                }
            }
            (token.startsWith("*") && token.endsWith("*")) ||
                (token.startsWith("_") && token.endsWith("_")) -> {
                withStyle(SpanStyle(fontStyle = FontStyle.Italic)) {
                    append(token.drop(1).dropLast(1))
                }
            }
            token.startsWith("[") -> {
                val bracket = token.indexOf(']')
                val label = token.substring(1, bracket)
                val supplied = token.substring(bracket + 2, token.length - 1)
                val safe = NativeMarkdown.safeHttpsLink(supplied)
                if (safe == null) append(label)
                else withLink(
                    LinkAnnotation.Url(
                        safe,
                        TextLinkStyles(
                            style = SpanStyle(
                                color = LinkIce,
                                textDecoration = TextDecoration.Underline
                            )
                        )
                    )
                ) { append(label) }
            }
            else -> append(token)
        }
        position = match.range.last + 1
    }
    append(value.substring(position))
}

/**
 * Native, selectable text and real HTTPS links. No WebView or arbitrary HTML.
 * Code snippets and simple tables are supported rather than displayed raw.
 */
@Composable
fun MarkdownMessage(source: String) {
    val blocks = remember(source) { NativeMarkdown.parse(source) }
    val context = LocalContext.current
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        blocks.forEach { block ->
            when (block.kind) {
                MarkdownKind.EMPTY -> Spacer(Modifier.height(6.dp))
                MarkdownKind.RULE -> HorizontalDivider(
                    modifier = Modifier.padding(vertical = 7.dp),
                    color = Color(0x44FFFFFF)
                )
                MarkdownKind.CODE -> {
                    val shape = RoundedCornerShape(12.dp)
                    Column(
                        modifier = Modifier.fillMaxWidth()
                            .background(Color(0xEE0B1123), shape)
                            .border(1.dp, Color(0x44677EAC), shape)
                            .padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                block.language.ifBlank { "Kod" }.take(24),
                                color = Color(0xFFB4C8EF),
                                fontSize = 10.sp,
                                modifier = Modifier.padding(top = 13.dp)
                            )
                            TextButton(onClick = {
                                val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE)
                                    as ClipboardManager
                                clipboard.setPrimaryClip(
                                    ClipData.newPlainText("Kod AKSARA", block.text)
                                )
                            }) {
                                Text("Salin kod", color = LinkIce, fontSize = 11.sp)
                            }
                        }
                        Text(
                            block.text,
                            modifier = Modifier.fillMaxWidth()
                                .horizontalScroll(rememberScrollState())
                                .padding(bottom = 10.dp),
                            color = CodeInk,
                            fontSize = 12.sp,
                            lineHeight = 18.sp,
                            fontFamily = FontFamily.Monospace,
                            softWrap = false
                        )
                    }
                }
                MarkdownKind.TABLE -> {
                    val columns = block.cells.firstOrNull()?.size ?: 0
                    Row(
                        modifier = Modifier.fillMaxWidth()
                            .horizontalScroll(rememberScrollState())
                            .padding(vertical = 5.dp)
                    ) {
                        for (col in 0 until columns) {
                            Column(modifier = Modifier.width(160.dp)) {
                                block.cells.forEachIndexed { row, cells ->
                                    Text(
                                        formattedInline(cells.getOrElse(col) { "" }),
                                        color = ContentInk,
                                        style = MaterialTheme.typography.bodySmall,
                                        fontWeight = if (row == 0) FontWeight.Bold
                                            else FontWeight.Normal,
                                        modifier = Modifier.fillMaxWidth()
                                            .background(
                                                if (row == 0) Color(0xBB364568)
                                                else Color(0x77131C31)
                                            )
                                            .border(0.5.dp, Color(0x33B9CBFF))
                                            .padding(9.dp),
                                        maxLines = 5
                                    )
                                }
                            }
                        }
                    }
                }
                MarkdownKind.HEADING -> Text(
                    formattedInline(block.text),
                    color = ContentInk,
                    fontSize = when (block.level) {
                        1 -> 22.sp
                        2 -> 19.sp
                        3 -> 17.sp
                        else -> 15.sp
                    },
                    fontWeight = FontWeight.Bold,
                    lineHeight = 26.sp,
                    modifier = Modifier.padding(top = 5.dp, bottom = 3.dp)
                )
                MarkdownKind.QUOTE -> Text(
                    formattedInline("│  " + block.text),
                    color = Color(0xFFC8CAE8),
                    style = MaterialTheme.typography.bodyLarge,
                    modifier = Modifier.padding(start = 7.dp, top = 2.dp)
                )
                MarkdownKind.BULLET -> Text(
                    formattedInline(block.text),
                    color = ContentInk,
                    style = MaterialTheme.typography.bodyLarge,
                    modifier = Modifier.padding(start = (block.level * 12).coerceAtMost(36).dp)
                )
                MarkdownKind.TEXT -> Text(
                    formattedInline(block.text),
                    color = ContentInk,
                    style = MaterialTheme.typography.bodyLarge
                )
            }
        }
    }
}
