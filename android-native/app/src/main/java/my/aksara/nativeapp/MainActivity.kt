package my.aksara.nativeapp

import android.os.Bundle
import android.content.Intent
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.IntentFilter
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import my.aksara.nativeapp.feature.voice.AksaraWakeWordStatus
import my.aksara.nativeapp.feature.voice.AksaraWakeWordService
import my.aksara.nativeapp.feature.voice.AksaraWakePermissionPolicy
import my.aksara.nativeapp.feature.voice.AksaraAssistantSignals
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
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
    private var assistantOpenCount by mutableIntStateOf(0)
    // The experimental listener lives in :wakeword. Never trust in-process
    // state from another Android process without the explicit relay.
    private val wakeReceiver=object:BroadcastReceiver() {
        override fun onReceive(context:Context?,intent:Intent?) {
            if(intent?.action!=AksaraAssistantSignals.ACTION_WAKE_STATUS) return
            AksaraWakeWordStatus.receiveStatus(
                intent.getBooleanExtra(AksaraAssistantSignals.EXTRA_ACTIVE,false),
                intent.getStringExtra(AksaraAssistantSignals.EXTRA_DIAGNOSTIC))
            if(intent.getBooleanExtra(AksaraAssistantSignals.EXTRA_ACTIVATED,false)) {
                AksaraCrashJournal.mark("wake-activation-broadcast")
                assistantOpenCount++
            }
        }
    }
    private val wakeMonitor=Handler(Looper.getMainLooper())
    private val verifyWakeProcess=object:Runnable {
        override fun run() {
            AksaraWakeWordStatus.checkHeartbeat()
            wakeMonitor.postDelayed(this,5_000L)
        }
    }
    private var perfStats: JankStats? = null
    // One-shot platform splash pulse; never hold the first application frame.
    private var startupPulse: AnimatorSet? = null
    override fun onCreate(savedInstanceState: Bundle?) {
        AksaraCrashJournal.mark("main-activity-onCreate")
        super.onCreate(savedInstanceState)
        ContextCompat.registerReceiver(this,wakeReceiver,
            IntentFilter(AksaraAssistantSignals.ACTION_WAKE_STATUS),
            ContextCompat.RECEIVER_NOT_EXPORTED)
        if (intent?.action == AksaraAssistantSignals.ACTION_OPEN_VOICE) assistantOpenCount++
        // The platform splash remains visible until the first app frame is ready.
        // Animate its exit, not a second artificial loading screen.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            splashScreen.setOnExitAnimationListener { provider ->
                val splash = provider
                val icon = provider.iconView
                if (icon != null) {
                    val pulseX = ObjectAnimator.ofFloat(icon, View.SCALE_X, 0.97f, 1.055f, 1.0f)
                    val pulseY = ObjectAnimator.ofFloat(icon, View.SCALE_Y, 0.94f, 1.10f, 1.0f)
                    val pulseAlpha = ObjectAnimator.ofFloat(icon, View.ALPHA, 0.86f, 1.0f, 1.0f)
                    startupPulse = AnimatorSet().apply {
                        playTogether(pulseX, pulseY, pulseAlpha)
                        duration = 410L
                        interpolator = DecelerateInterpolator()
                        start()
                    }
                }
                splash.animate().alpha(0f).setStartDelay(170L).setDuration(390L)
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
        setContent { AksaraApp(assistantStartToken = assistantOpenCount) }
        // Debug-only, explicit opt-in. Never record personal content or location.
        if (BuildConfig.DEBUG && intent?.getBooleanExtra("aksara_perf_trace", false) == true) {
            perfStats = JankStats.createAndTrack(window) { frame ->
                AksaraPerfFrames.accept(frame.isJank, frame.frameDurationUiNanos)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        AksaraCrashJournal.mark("main-activity-assistant-intent")
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent.action == AksaraAssistantSignals.ACTION_OPEN_VOICE) assistantOpenCount++
    }

    override fun onStop() {
        wakeMonitor.removeCallbacks(verifyWakeProcess)
        perfStats?.isTrackingEnabled = false
        // Without notifications, background wake-up has no reliable user-visible
        // handoff. Stop audio before Home/lock-screen on restrictive OEM builds;
        // the system default-assistant gesture remains available.
        if(AksaraWakeWordStatus.active) {
            val canNotify=runCatching {
                getSystemService(NotificationManager::class.java).areNotificationsEnabled()
            }.getOrDefault(false)
            if(!AksaraWakePermissionPolicy.mayContinueInBackground(canNotify)) {
                AksaraWakeWordStatus.lastFailure=
                    "Wake word dihentikan apabila app ke background kerana notifikasi dimatikan. Benarkan notifikasi untuk penggunaan background."
                runCatching { AksaraWakeWordService.stop(this) }
            }
        }
        super.onStop()
    }

    override fun onStart() {
        super.onStart()
        wakeMonitor.removeCallbacks(verifyWakeProcess)
        wakeMonitor.post(verifyWakeProcess)
        perfStats?.isTrackingEnabled = true
    }

    override fun onDestroy() {
        wakeMonitor.removeCallbacksAndMessages(null)
        try { unregisterReceiver(wakeReceiver) } catch (_:Exception) { }
        super.onDestroy()
    }
}
