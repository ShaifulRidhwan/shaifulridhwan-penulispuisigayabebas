package my.aksara.nativeapp.feature.voice

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import kotlinx.coroutines.flow.MutableSharedFlow
import my.aksara.nativeapp.MainActivity

internal object AksaraHotwordMatcher {
    private val pattern = Regex("(^|[^\\p{L}])aksara([^\\p{L}]|$)", RegexOption.IGNORE_CASE)
    fun matches(transcript: String): Boolean = pattern.containsMatchIn(transcript)
}

/** In-process rendezvous for an already-visible chat UI. No recording is persisted. */
internal object AksaraAssistantSignals {
    const val ACTION_OPEN_VOICE = "my.aksara.nativeapp.action.OPEN_ASSISTANT_VOICE"
    val requests = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
}

/** Visible opt-in state only; this is not a boot-started or hidden microphone. */
internal object AksaraWakeWordStatus {
    var active by mutableStateOf(false)
        internal set
}

/**
 * Experimental local-only wake-word adapter.
 *
 * Requires explicit activation from a visible Activity and user-granted mic permission.
 * Android on-device SpeechRecognizer is NOT a continuous DSP hotword engine: OEMs may
 * throttle recognition, and screen-off behavior is not guaranteed. Replace this adapter
 * with a pinned local KWS model for robust always-on use.
 */
class AksaraWakeWordService : Service() {
    companion object {
        const val ACTION_START = "my.aksara.nativeapp.action.WAKE_START"
        const val ACTION_STOP = "my.aksara.nativeapp.action.WAKE_STOP"
        private const val CHANNEL = "aksara_wake_local"
        private const val ACTIVATION_CHANNEL = "aksara_assistant_activation"
        private const val NOTIFICATION_ID = 7241
        private const val ACTIVATION_ID = 7242

        fun start(context: Context) {
            ContextCompat.startForegroundService(
                context, Intent(context, AksaraWakeWordService::class.java).setAction(ACTION_START))
        }

        fun stop(context: Context) {
            context.startService(Intent(context, AksaraWakeWordService::class.java)
                .setAction(ACTION_STOP))
        }
    }

    private val main = Handler(Looper.getMainLooper())
    private var engine: SpeechRecognizer? = null
    private var stopped = false
    private var consecutiveErrors = 0

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }
        if (AksaraWakeWordStatus.active) return START_NOT_STICKY
        if (intent?.action != ACTION_START ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) !=
                PackageManager.PERMISSION_GRANTED ||
            !SpeechRecognizer.isOnDeviceRecognitionAvailable(this)) {
            stopSelf()
            return START_NOT_STICKY
        }
        createChannels()
        try {
            startForeground(NOTIFICATION_ID, listeningNotification(),
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
        } catch (_: Exception) {
            stopSelf()
            return START_NOT_STICKY
        }
        stopped = false
        consecutiveErrors = 0
        AksaraWakeWordStatus.active = true
        scheduleListening(0L)
        return START_NOT_STICKY
    }

    private fun createChannels() {
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(CHANNEL,
            "Aksara · Pendengaran lokal", NotificationManager.IMPORTANCE_LOW))
        manager.createNotificationChannel(NotificationChannel(ACTIVATION_CHANNEL,
            "Aksara · Panggilan pembantu", NotificationManager.IMPORTANCE_HIGH))
    }

    private fun openVoiceIntent(): PendingIntent {
        val intent = Intent(this, MainActivity::class.java).apply {
            action = AksaraAssistantSignals.ACTION_OPEN_VOICE
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or
                Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        return PendingIntent.getActivity(this, 7242, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    private fun listeningNotification(): Notification {
        val stopIntent = PendingIntent.getService(this, 7241,
            Intent(this, AksaraWakeWordService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        return Notification.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle("Aksara · Wake Word")
            .setContentText("Mendengar sebutan Aksara secara lokal")
            .setContentIntent(openVoiceIntent())
            .setOngoing(true)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Hentikan", stopIntent)
            .build()
    }

    private fun scheduleListening(waitMs: Long) {
        main.removeCallbacksAndMessages(null)
        if (stopped) return
        main.postDelayed({ if (!stopped) listenOnce() }, waitMs)
    }

    private fun listenOnce() {
        if (stopped) return
        engine?.destroy()
        engine = null
        try {
            val recognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(this)
            engine = recognizer
            recognizer.setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) = Unit
                override fun onBeginningOfSpeech() = Unit
                override fun onRmsChanged(rmsdB: Float) = Unit
                override fun onBufferReceived(buffer: ByteArray?) = Unit
                override fun onEndOfSpeech() = Unit
                override fun onEvent(eventType: Int, params: Bundle?) = Unit

                override fun onPartialResults(partialResults: Bundle?) {
                    inspect(partialResults)
                }

                override fun onResults(results: Bundle?) {
                    if (!inspect(results)) {
                        consecutiveErrors = 0
                        scheduleListening(700L)
                    }
                }

                override fun onError(error: Int) {
                    if (stopped) return
                    if (error == SpeechRecognizer.ERROR_NO_MATCH ||
                        error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
                        consecutiveErrors = 0
                        scheduleListening(950L)
                    } else {
                        consecutiveErrors++
                        // No runaway retry loops if Android or another mic session refuses us.
                        if (consecutiveErrors >= 6) stopSelf()
                        else scheduleListening((1500L * consecutiveErrors).coerceAtMost(7500L))
                    }
                }
            })
            recognizer.startListening(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                    RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ms-MY")
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            })
        } catch (_: Exception) {
            consecutiveErrors++
            if (consecutiveErrors >= 6) stopSelf()
            else scheduleListening(2000L * consecutiveErrors)
        }
    }

    /** Returns true only if this recognition cycle has activated the assistant. */
    private fun inspect(bundle: Bundle?): Boolean {
        if (stopped) return false
        val candidates = bundle?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION).orEmpty()
        if (candidates.none { AksaraHotwordMatcher.matches(it) }) return false
        stopped = true
        main.removeCallbacksAndMessages(null)
        engine?.cancel()
        engine?.destroy()
        engine = null
        AksaraWakeWordStatus.active = false
        // Active chat handles this directly. Background Android restricts arbitrary
        // Activity launches; use an explicit user-tappable notification instead.
        AksaraAssistantSignals.requests.tryEmit(Unit)
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(ACTIVATION_ID, Notification.Builder(this, ACTIVATION_CHANNEL)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle("Aksara dengar panggilan kau")
            .setContentText("Buka pembantu suara")
            .setContentIntent(openVoiceIntent())
            .setAutoCancel(true)
            .build())
        stopSelf()
        return true
    }

    override fun onDestroy() {
        stopped = true
        main.removeCallbacksAndMessages(null)
        engine?.cancel()
        engine?.destroy()
        engine = null
        AksaraWakeWordStatus.active = false
        super.onDestroy()
    }
}
