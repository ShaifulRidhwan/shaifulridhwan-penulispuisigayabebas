package my.aksara.nativeapp.feature.chat

import androidx.compose.foundation.Image
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.compose.ui.res.painterResource
import my.aksara.nativeapp.R

/** Restore the original cinematic Chat background, retaining full-bleed feathering and text contrast. */
@Composable internal fun ChatWallpaper(modifier: Modifier = Modifier) {
    BoxWithConstraints(modifier.background(Color(0xFF080C17))) {
        val wallpaper = painterResource(if (maxWidth > 760.dp) R.drawable.aksara_cinematic_desktop else R.drawable.aksara_cinematic_mobile)
        // Fill tall/rounded device edges without cropping the approved original composition.
        Image(wallpaper, null,
            Modifier.fillMaxSize().blur(24.dp), alignment = Alignment.Center, contentScale = ContentScale.Crop)
        Box(Modifier.fillMaxSize().background(Color(5,8,16,48)))
        Image(wallpaper, null,
            Modifier.fillMaxSize().blur(3.dp)
                .graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }
                .drawWithContent {
                    drawContent()
                    // Feather the fitted original into its blurred full-bleed extension.
                    drawRect(
                        Brush.verticalGradient(
                            0f to Color.Transparent,
                            .10f to Color.Transparent,
                            .25f to Color.White,
                            .75f to Color.White,
                            .90f to Color.Transparent,
                            1f to Color.Transparent
                        ),
                        blendMode = BlendMode.DstIn
                    )
                },
            alignment = Alignment.Center, contentScale = ContentScale.Fit)
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(
            0f to Color(0xA0040810), .18f to Color(0x33040810), .55f to Color(0x17040810), .86f to Color(0x47040810), 1f to Color(0xA0040810))))
    }
}
