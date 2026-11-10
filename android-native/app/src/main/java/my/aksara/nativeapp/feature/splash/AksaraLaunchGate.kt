package my.aksara.nativeapp.feature.splash

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import my.aksara.nativeapp.core.design.AksaraColors
import my.aksara.nativeapp.core.design.AksaraIcon
import my.aksara.nativeapp.core.design.AksaraText
import my.aksara.nativeapp.core.design.AksaraTypography

/**
 * Android 12+ draws the native dark launch window first. This short, in-app
 * continuation adds the existing Aksara identity and fades to the real chat.
 * Chat initialization runs behind it, with no API/provider wait and no login.
 * Saved state skips the intro when an Activity is recreated.
 */
@Composable
fun AksaraLaunchGate(
    initialIntro: Boolean = true,
    durationMillis: Long = 850L,
    content: @Composable () -> Unit
) {
    var showIntro by rememberSaveable { mutableStateOf(initialIntro) }
    LaunchedEffect(showIntro) {
        if (showIntro) {
            delay(durationMillis.coerceAtLeast(0L))
            showIntro = false
        }
    }
    Box(Modifier.fillMaxSize()) {
        content()
        AnimatedVisibility(
            visible = showIntro,
            enter = EnterTransition.None,
            exit = fadeOut(tween(240)),
            modifier = Modifier.fillMaxSize()
        ) {
            AksaraSplashContent()
        }
    }
}

/** The first visible Compose frame matches the Android system splash palette. */
@Composable
fun AksaraSplashContent() {
    val blocker = remember { MutableInteractionSource() }
    Box(
        Modifier.fillMaxSize()
            .testTag("aksara-splash-screen")
            .background(
                Brush.radialGradient(
                    listOf(Color(0xFF172237), Color(0xFF0B101B), Color(0xFF070911))
                )
            )
            .clickable(interactionSource = blocker, indication = null) {}
    ) {
        Column(
            Modifier.align(Alignment.Center).padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Box(
                Modifier.size(112.dp).background(
                    Brush.radialGradient(
                        listOf(Color(0x33E6C58B), Color(0x124D6B91), Color.Transparent)
                    ),
                    CircleShape
                ),
                contentAlignment = Alignment.Center
            ) {
                AksaraIcon("aksara", Modifier.size(76.dp), AksaraColors.gold)
            }
            Spacer(Modifier.height(22.dp))
            AksaraText(
                "AKSARA A.I.",
                size = 28f, line = 36f, weight = 700,
                family = AksaraTypography.heading
            )
            Spacer(Modifier.height(8.dp))
            AksaraText(
                "ANTARA AKSARA DAN CODE",
                size = 10.5f, line = 17f, weight = 600,
                tracking = 1.15f, color = Color(0xFFD4C6B2)
            )
        }
        Column(
            Modifier.align(Alignment.BottomCenter).padding(bottom = 56.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            AksaraText(
                "Memasuki Bilik Antara…",
                size = 11f, line = 18f, color = AksaraColors.muted
            )
            Spacer(Modifier.height(12.dp))
            AksaraText(
                "OLEH SHAIFUL RIDHWAN",
                size = 9f, line = 15f, weight = 600, tracking = .95f,
                color = Color(0xFF8E96A3)
            )
        }
    }
}
