package my.aksara.nativeapp.feature.chat

import androidx.compose.foundation.Image
import androidx.compose.ui.draw.blur
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import my.aksara.nativeapp.R

/** Immersive chat artwork: blurred full-bleed underlay removes Fit letterboxing, while the locked foreground preserves both celestial bodies and the full gown. */
@Composable internal fun ChatWallpaper(modifier: Modifier = Modifier) {
    Box(modifier.background(Color(0xFF080C17))) {
        // Fill tall/rounded device edges without cropping the approved original composition.
        Image(painterResource(R.drawable.aksara_chat_wallpaper), null,
            Modifier.fillMaxSize().blur(28.dp), alignment = Alignment.Center, contentScale = ContentScale.Crop)
        Box(Modifier.fillMaxSize().background(Color(5,8,16,48)))
        Image(painterResource(R.drawable.aksara_chat_wallpaper), null,
            Modifier.fillMaxSize(), alignment = Alignment.Center, contentScale = ContentScale.Fit)
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(
            0f to Color(0xA0040810), .18f to Color(0x33040810), .55f to Color(0x17040810), .86f to Color(0x47040810), 1f to Color(0xA0040810))))
    }
}
