package my.aksara.nativeapp.feature.chat

import androidx.compose.foundation.Image
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

/** Chat-only static artwork. Fit retains both celestial bodies and the full gown. */
@Composable internal fun ChatWallpaper(modifier: Modifier = Modifier) {
    Box(modifier.background(Color(0xFF080C17))) {
        Image(painterResource(R.drawable.aksara_chat_wallpaper), null,
            Modifier.fillMaxSize(), alignment = Alignment.Center, contentScale = ContentScale.Fit)
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(
            0f to Color(0x55040810), .45f to Color(0x22040810), 1f to Color(0x88040810))))
    }
}
