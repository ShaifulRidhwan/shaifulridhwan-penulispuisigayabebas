package my.aksara.ai.ui

import android.os.Build
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.matchParentSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import my.aksara.ai.R
import kotlin.math.roundToInt

/**
 * Web reference: backdrop-filter blur(3px) on chat bubbles and blur(8-18px)
 * on composer / drawers; translucent dark panel plus warm amber hairline.
 *
 * Compose blur is a SURFACE blur, not a browser backdrop-filter. To reproduce
 * the part of the scene that is behind the glass without a WebView, this draws
 * an offset second copy of the same original wallpaper under a clipped tint.
 * The image's pixel location matches its root scene position.
 *
 * On Android 12+ the wallpaper layer is GPU-blurred. Older devices get a
 * translucent dark fallback; no misleading assertion about platform support.
 * This technique frosts original STATIC wallpaper, not moving chat content.
 */
val AksaraGlassViewport = staticCompositionLocalOf { IntSize.Zero }
object AksaraGlassColors {
    val Gold = Color(0xFFEAC17C)
    val Bright = Color(0xFFFFF1D6)
    val Muted = Color(0xFFD7CBB6)
    val Hairline = Color(0x88EACA96)
    val Base = Color(0x66101923)
}

@Composable
fun AksaraGlassPanel(
    modifier: Modifier = Modifier,
    shape: Shape = RoundedCornerShape(20.dp),
    blurRadius: Dp = 10.dp,
    tint: Color = AksaraGlassColors.Base,
    border: Color = AksaraGlassColors.Hairline,
    content: @Composable BoxScope.() -> Unit
) {
    val viewport = AksaraGlassViewport.current
    val density = LocalDensity.current
    var origin by remember { mutableStateOf(IntOffset.Zero) }
    val width = with(density) { viewport.width.toDp() }
    val height = with(density) { viewport.height.toDp() }

    Box(
        modifier = modifier
            .onGloballyPositioned { c ->
                val p = c.positionInRoot()
                val next = IntOffset(p.x.roundToInt(), p.y.roundToInt())
                if (next != origin) origin = next
            }
            .clip(shape)
            .border(1.dp, border, shape)
    ) {
        if (viewport.width > 0 && viewport.height > 0 && Build.VERSION.SDK_INT >= 31) {
            Image(
                painter = painterResource(R.drawable.aksara_bilik_background),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .matchParentSize()
                    .wrapContentSize(align = Alignment.TopStart, unbounded = true)
                    .offset { IntOffset(-origin.x, -origin.y) }
                    .size(width, height)
                    .blur(blurRadius)
            )
        }
        Box(
            Modifier.matchParentSize().background(
                Brush.linearGradient(
                    listOf(
                        tint.copy(alpha = (tint.alpha * 0.87f).coerceIn(0f, 1f)),
                        tint,
                        tint.copy(alpha = (tint.alpha * 1.13f).coerceIn(0f, 1f))
                    )
                )
            )
        )
        content()
    }
}
