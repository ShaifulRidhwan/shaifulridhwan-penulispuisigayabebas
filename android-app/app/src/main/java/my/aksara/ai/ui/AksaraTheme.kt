package my.aksara.ai.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Night = Color(0xFF080D1A)
private val Accent = Color(0xFFA8BFFF)
private val Violet = Color(0xFFC3A7FF)

private val AksaraColors = darkColorScheme(
    primary = Accent,
    onPrimary = Night,
    secondary = Violet,
    background = Night,
    onBackground = Color(0xFFF0F3FF),
    surface = Color(0xFF11192C),
    onSurface = Color(0xFFE7ECFF),
    surfaceVariant = Color(0xFF1F2A44),
    onSurfaceVariant = Color(0xFFB9C4DE)
)

@Composable
fun AksaraTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = AksaraColors, content = content)
}
