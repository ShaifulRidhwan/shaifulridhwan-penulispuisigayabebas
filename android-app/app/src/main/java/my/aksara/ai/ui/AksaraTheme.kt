package my.aksara.ai.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Night = Color(0xFF080D1A)
private val Accent = Color(0xFFEAC17C)
private val Violet = Color(0xFFF0CD9A)

private val AksaraColors = darkColorScheme(
    primary = Accent,
    onPrimary = Night,
    secondary = Violet,
    background = Night,
    onBackground = Color(0xFFFFF2DC),
    surface = Color(0xFF14151D),
    onSurface = Color(0xFFF8EAD4),
    surfaceVariant = Color(0xFF2B2829),
    onSurfaceVariant = Color(0xFFE2CEB4)
)

@Composable
fun AksaraTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = AksaraColors, content = content)
}
