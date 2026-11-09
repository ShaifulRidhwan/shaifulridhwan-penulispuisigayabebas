package my.aksara.nativeapp.feature.chat

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import dev.chrisbanes.haze.*
import my.aksara.nativeapp.core.design.*

/**
 * One dialog visual contract for native overlays. Mirrors the connection and
 * Portal panels: modal backdrop, central glass, tint, border, blur and gutters.
 * Long content scrolls inside the card, never turns into a full-screen page.
 */
internal object AksaraModalStyle {
    val radius = 19.dp
    val blur = 4.dp
    val border = Color(244, 217, 176, 94)
    val scrim = Color(2, 6, 13, 64)
    val side = 21.dp
}

/** Shared, centered Liquid Glass shell for Search Hub and Settings. */
@Composable
internal fun AksaraGlassModal(
    onClose: () -> Unit,
    preferredHeight: Dp,
    content: @Composable BoxScope.() -> Unit
) {
    val margins = aksaraDeviceMargins()
    val haze = LocalBackdrop.current
    val modalBackdrop = remember { HazeState() }
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val availableHeight = maxHeight
        Box(
            Modifier.fillMaxSize()
                .hazeSource(modalBackdrop)
                .hazeEffect(haze, HazeStyle(
                    tints = emptyList(),
                    backgroundColor = Color(0xff070911),
                    blurRadius = 14.dp,
                    noiseFactor = 0f
                ))
                .background(AksaraModalStyle.scrim)
                .clickable(onClick = onClose)
        )
        CompositionLocalProvider(LocalBackdrop provides modalBackdrop) {
            AksaraGlassSurface(
                Modifier.align(Alignment.Center)
                    .padding(horizontal = AksaraModalStyle.side)
                    .widthIn(max = 600.dp)
                    .fillMaxWidth()
                    .heightIn(max = availableHeight - maxOf(
                        28.dp, margins.top + margins.bottom + 16.dp
                    ))
                    .height(minOf(preferredHeight, availableHeight - 60.dp))
                    .testTag("aksara-glass-modal")
                    .clickable(enabled = false) {},
                radius = AksaraModalStyle.radius,
                blur = AksaraModalStyle.blur,
                brush = DialogGradient,
                border = AksaraModalStyle.border
            ) {
                content()
            }
        }
    }
}
