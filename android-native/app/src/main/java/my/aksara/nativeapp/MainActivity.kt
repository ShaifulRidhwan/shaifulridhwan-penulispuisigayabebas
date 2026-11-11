package my.aksara.nativeapp

import android.os.Bundle
import android.os.Build
import android.view.animation.DecelerateInterpolator
import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.view.View
import androidx.metrics.performance.JankStats
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import my.aksara.nativeapp.feature.chat.AksaraApp

class MainActivity : ComponentActivity() {
    private var perfStats: JankStats? = null
    private var startupPulse: AnimatorSet? = null
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // The platform splash remains visible until the first app frame is ready.
        // Animate its exit, not a second artificial loading screen.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            splashScreen.setOnExitAnimationListener { provider ->
                val splash = provider.view
                val icon = provider.iconView
                if (icon != null) {
                    val pulseX = ObjectAnimator.ofFloat(icon, View.SCALE_X, 0.94f, 1.10f, 1.0f)
                    val pulseY = ObjectAnimator.ofFloat(icon, View.SCALE_Y, 0.94f, 1.10f, 1.0f)
                    val pulseAlpha = ObjectAnimator.ofFloat(icon, View.ALPHA, 0.72f, 1.0f, 1.0f)
                    startupPulse = AnimatorSet().apply {
                        playTogether(pulseX, pulseY, pulseAlpha)
                        duration = 340L
                        interpolator = DecelerateInterpolator()
                        start()
                    }
                }
                splash.animate().alpha(0f).setStartDelay(140L).setDuration(340L)
                    .setInterpolator(DecelerateInterpolator())
                    .withEndAction {
                        startupPulse?.cancel()
                        startupPulse = null
                        provider.remove()
                    }.start()
            }
        }
        setTheme(R.style.Theme_Aksara)
        enableEdgeToEdge()
        WindowCompat.getInsetsController(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
        setContent { AksaraApp() }
        // Debug-only, explicit opt-in. Never record personal content or location.
        if (BuildConfig.DEBUG && intent?.getBooleanExtra("aksara_perf_trace", false) == true) {
            perfStats = JankStats.createAndTrack(window) { frame ->
                AksaraPerfFrames.accept(frame.isJank, frame.frameDurationUiNanos)
            }
        }
    }

    override fun onStop() {
        perfStats?.isTrackingEnabled = false
        super.onStop()
    }

    override fun onStart() {
        super.onStart()
        perfStats?.isTrackingEnabled = true
    }
}
