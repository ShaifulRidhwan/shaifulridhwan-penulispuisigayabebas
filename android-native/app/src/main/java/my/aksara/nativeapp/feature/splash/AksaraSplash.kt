package my.aksara.nativeapp.feature.splash

import androidx.compose.runtime.Composable

/**
 * Legacy entry points kept binary/source-compatible with old visual fixtures.
 * No animation, logo, timer, overlay or tap interception is mounted at startup.
 * Android 12+ still owns its mandatory, minimum-duration system launch window.
 */
@Composable
fun AksaraLaunchGate(
    initialIntro: Boolean = true,
    reducedMotion: Boolean = false,
    content: @Composable () -> Unit
) {
    content()
}

@Composable
fun AksaraSplashContent(progress: Float = 1f, reducedMotion: Boolean = false) {
    // Intentionally empty. The application enters the main chat immediately.
}
