package my.aksara.nativeapp.core.design

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.*
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.drawscope.*
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.*
import androidx.compose.ui.text.font.*
import androidx.compose.ui.unit.*
import androidx.compose.ui.layout.ContentScale
import dev.chrisbanes.haze.*
import my.aksara.nativeapp.R

object AksaraColors {
    val text = Color(0xfffff4e4)
    val gold = Color(0xffe6c58b)
    val muted = Color(0xffb9c1cd)
    val border = Color(244, 225, 192, 79)
}
object AksaraTypography {
    val body = FontFamily(Font(R.font.dm_sans, weight = FontWeight.Normal), Font(R.font.dm_sans, weight = FontWeight.Medium), Font(R.font.dm_sans, weight = FontWeight.SemiBold), Font(R.font.dm_sans, weight = FontWeight.Bold))
    val heading = FontFamily(Font(R.font.space_grotesk, weight = FontWeight.Normal), Font(R.font.space_grotesk, weight = FontWeight.SemiBold))
    fun style(size: Float = 14f, line: Float = size * 1.6f, weight: Int = 400, color: Color = AksaraColors.text) = TextStyle(
        color = color, fontFamily = body, fontSize = size.sp, lineHeight = line.sp, fontWeight = FontWeight(weight),
        platformStyle = PlatformTextStyle(includeFontPadding = false))
}
object AksaraSpacing { val shellSide = 7.dp; val shellBottom = 7.dp; val headerTop = 10.dp; val dialogPadding = 15.dp }
@Composable fun AksaraText(text: String, modifier: Modifier = Modifier, size: Float = 14f, line: Float = size * 1.6f,
    weight: Int = 400, color: Color = AksaraColors.text, tracking: Float = 0f) {
    BasicText(text, modifier, style = AksaraTypography.style(size, line, weight, color).copy(letterSpacing = tracking.sp))
}
val LocalBackdrop = staticCompositionLocalOf<HazeState> { error("Backdrop source missing") }
val GlassGradient: Brush get() = Brush.linearGradient(listOf(Color(255,247,224,9), Color(125,167,205,5)))
val DialogGradient: Brush get() = Brush.linearGradient(listOf(Color(23,31,45,92), Color(9,14,24,110)))
@Composable fun AksaraGlassSurface(modifier: Modifier = Modifier, radius: Dp = 13.dp, blur: Dp = 2.dp,
    brush: Brush = GlassGradient, border: Color = AksaraColors.border, shape: Shape = RoundedCornerShape(radius), content: @Composable BoxScope.() -> Unit) {
    val haze = LocalBackdrop.current
    Box(modifier.clip(shape).hazeEffect(haze, HazeStyle(tints=emptyList(), backgroundColor = Color(0xff070911), blurRadius = blur, noiseFactor = 0f))
        .background(brush).border(1.dp, border, shape), content = content)
}
@Composable fun AksaraButton(label: String, onClick: () -> Unit, modifier: Modifier = Modifier, icon: String? = null,
    size: Float = 12f, height: Dp = 44.dp, radius: Dp = 13.dp, enabled: Boolean = true, contentColor: Color = AksaraColors.text) {
    AksaraGlassSurface(modifier.graphicsLayer { alpha=if(enabled)1f else .6f }.height(height).clip(RoundedCornerShape(radius)).clickable(enabled = enabled, onClick = onClick), radius) {
        Row(Modifier.align(Alignment.Center).padding(horizontal = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            if (icon != null) AksaraIcon(icon, Modifier.size(if(size<10) 15.dp else 18.dp), contentColor)
            if (label.isNotEmpty()) AksaraText(label, size = size, line = size*1.4f, weight = 500, color = contentColor)
        }
    }
}
@Composable fun AksaraBackground(modifier: Modifier = Modifier) {
    BoxWithConstraints(modifier) {
        Image(painterResource(if(maxWidth>760.dp) R.drawable.aksara_cinematic_desktop else R.drawable.aksara_cinematic_mobile), null,
            Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color(3,6,12,33), .30f to Color(4,7,13,46), .55f to Color(3,6,13,82), 1f to Color(3,5,10,156))))
    }
}
private val iconPaths = mapOf(
    "send" to listOf("m5 12 14-9-3.6 18L11 13l-6-1Z", "m11 13 8-10"),
    "attach" to listOf("m21.4 11.6-8.9 9a6.4 6.4 0 0 1-9.1-9.1L13 1.9a4.3 4.3 0 0 1 6.1 6.1l-9.5 9.5a2.2 2.2 0 0 1-3.1-3.1l8.6-8.6"),
    "brain" to listOf("M12 20V5a3 3 0 0 0-5.8-.9A3.7 3.7 0 0 0 3.5 9a3.4 3.4 0 0 0 .1 5.4A3.6 3.6 0 0 0 6.8 19 3 3 0 0 0 12 20Zm0 0V5a3 3 0 0 1 5.8-.9A3.7 3.7 0 0 1 20.5 9a3.4 3.4 0 0 1-.1 5.4A3.6 3.6 0 0 1 17.2 19 3 3 0 0 1 12 20Z", "M5.5 9h3l2 2.1v3.2M18.5 9h-3l-2 2.1v3.2M6.2 15.5h2.6m6.4 0h2.6"),
    "terminal" to listOf("M5 5H19Q21 5 21 7V17Q21 19 19 19H5Q3 19 3 17V7Q3 5 5 5Z", "m7 9 3 3-3 3m6 0h4"),
    "code" to listOf("M7 7h10v10H7ZM10 10h4v4h-4ZM9 3v4m6-4v4M9 17v4m6-4v4M3 9h4m-4 6h4m10-6h4m-4 6h4"),
    "network" to listOf("M5 5.5 12 12l7-7M12 12l7.3 7M12 12 4.8 18.5", "m12 7.2 1.25 3.55L16.8 12l-3.55 1.25L12 16.8l-1.25-3.55L7.2 12l3.55-1.25Z"),
    "grid" to listOf("M4 4h6v6H4ZM14 4h6v6h-6ZM4 14h6v6H4ZM14 14h6v6h-6Z"),
    "voice" to listOf("M3 10v4m4-7v10m5-13v16m5-13v10m4-7v4"),
    "mic" to listOf("M9 6a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0ZM5 11v1a7 7 0 0 0 14 0v-1M12 19v3m-4 0h8"),
    "close" to listOf("m6 6 12 12M6 18 18 6"),
    "book" to listOf("M4 5.5c3-1.5 5.5-1.5 8 .2 2.5-1.7 5-1.7 8-.2V19c-3-1.5-5.5-1.5-8 .2-2.5-1.7-5-1.7-8-.2zM12 5.7v13.5"),
    "shield" to listOf("M12 2 4 5v6c0 5.4 3.6 9.4 8 11 4.4-1.6 8-5.6 8-11V5l-8-3Z", "m9 12 2 2 4-4"),
    "end" to listOf("M4 8q8-7 16 0v6h-4v-4q-4-2-8 0v4H4Z"),
    "speaker" to listOf("M4 9h4l5-4v14l-5-4H4ZM17 8a6 6 0 0 1 0 8M20 5a10 10 0 0 1 0 14")
)
@Composable fun AksaraIcon(name: String, modifier: Modifier = Modifier.size(20.dp), color: Color = AksaraColors.gold) {
    val paths = remember(name) { iconPaths[name].orEmpty().map { PathParser().parsePathString(it).toPath() } }
    Canvas(modifier) { scale(size.width/24f, size.height/24f, pivot = Offset.Zero) { paths.forEach { drawPath(it, color, style = Stroke(1.5f, cap = StrokeCap.Round, join = StrokeJoin.Round)) } } }
}
