package my.aksara.nativeapp.feature.chat

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.draw.blur
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import my.aksara.nativeapp.R

/**
 * PR #314: locked user-supplied wallpaper 96371.png.
 *
 * Gold woman LEFT, blue Codex RIGHT, dark empty CENTER. Never Crop the sharp
 * foreground image. ContentScale.Fit protects both characters on 20:9, 19.5:9,
 * compact, foldable and landscape viewports. A blurred duplicate only fills
 * letterboxed margins; it is not a substitute for the full original artwork.
 * No regeneration, animation, subject repositioning or bitmap scaling at build.
 */
@Composable internal fun ChatWallpaper(modifier: Modifier = Modifier) {
    BoxWithConstraints(modifier.background(Color(0xFF050B19))) {
        val wallpaper = painterResource(R.drawable.aksara_duality_v2)
        // The blurred layer is allowed to Crop because it is a decorative extension.
        Image(
            painter = wallpaper, contentDescription = null,
            modifier = Modifier.fillMaxSize().blur(22.dp),
            contentScale = ContentScale.Crop
        )
        // This full-resolution foreground ALWAYS shows the complete composition.
        Image(
            painter = wallpaper, contentDescription = null,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Fit
        )
        // Shared chat contrast treatment with minimal tint over the central ink.
        Box(
            Modifier.fillMaxSize().background(
                Brush.verticalGradient(
                    0f to Color(0x26040810),
                    .28f to Color(0x12040810),
                    .70f to Color(0x08040810),
                    1f to Color(0x53040810)
                )
            )
        )
    }
}
