package my.aksara.nativeapp

import android.os.Bundle
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
    override fun onCreate(savedInstanceState: Bundle?) {
        setTheme(R.style.Theme_Aksara)
        super.onCreate(savedInstanceState)
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
