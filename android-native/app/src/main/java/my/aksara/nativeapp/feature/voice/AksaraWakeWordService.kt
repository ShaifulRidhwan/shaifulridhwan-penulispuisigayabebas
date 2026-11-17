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
import android.os.SystemClock
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import kotlinx.coroutines.flow.MutableSharedFlow
import my.aksara.nativeapp.MainActivity
import my.aksara.nativeapp.AksaraCrashJournal

internal object AksaraHotwordMatcher {
    // A minimal common romanized variant when the device's offline model is English.
    private val pattern = Regex("(^|[^\\p{L}])(?:aksara|akshara|ak sara)([^\\p{L}]|$)",RegexOption.IGNORE_CASE)
    fun matches(transcript: String): Boolean = pattern.containsMatchIn(transcript)
}

internal enum class AksaraWakeReadiness {
    MIC_REQUIRED, READY_WITHOUT_NOTIFICATIONS, READY
}

internal object AksaraWakePermissionPolicy {
    fun evaluate(microphoneGranted: Boolean, notificationsAllowed: Boolean): AksaraWakeReadiness =
        when {
            !microphoneGranted -> AksaraWakeReadiness.MIC_REQUIRED
            !notificationsAllowed -> AksaraWakeReadiness.READY_WITHOUT_NOTIFICATIONS
            else -> AksaraWakeReadiness.READY
        }

    fun mayContinueInBackground(notificationsAllowed: Boolean): Boolean = notificationsAllowed
}

/** In-process rendezvous for an already-visible chat UI. No recording is persisted. */
internal object AksaraAssistantSignals {
    const val ACTION_OPEN_VOICE = "my.aksara.nativeapp.action.OPEN_ASSISTANT_VOICE"
    const val ACTION_WAKE_STATUS = "my.aksara.nativeapp.action.WAKE_STATUS"
    const val EXTRA_ACTIVE = "active"
    const val EXTRA_DIAGNOSTIC = "diagnostic"
    const val EXTRA_ACTIVATED = "activated"
    val requests = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
}

/** Guard against isolated-process death without asking Android for hidden process state. */
internal object AksaraWakeLivenessPolicy {
    fun expired(active:Boolean,lastSignalMs:Long,nowMs:Long,maxAgeMs:Long=15_000L):Boolean =
        active && lastSignalMs>0L && nowMs-lastSignalMs>maxAgeMs
}

/**
 * Cross-process microphone ownership.
 * stopService() is ASYNCHRONOUS: only the worker's onDestroy(false) relay
 * confirms its SpeechRecognizer has released the mic. A timeout must NEVER
 * grant microphone ownership to a new recognizer.
 */
internal object AksaraWakeAudioHandoff {
    fun canStartOtherRecognizer(active:Boolean,stopping:Boolean,released:Boolean):Boolean =
        !active && !stopping && released
}

internal object AksaraWakeWordStatus {
    var active by mutableStateOf(false)
        internal set
    var stopPending by mutableStateOf(false)
        private set
    var released by mutableStateOf(true)
        private set
    var lastFailure by mutableStateOf<String?>(null)
        internal set
    private var lastSignalMs = 0L
    val canStartOtherAudio: Boolean
        get() = AksaraWakeAudioHandoff.canStartOtherRecognizer(active,stopPending,released)

    internal fun requestStart() {
        active=true
        stopPending=false
        released=false
        lastFailure=null
        lastSignalMs=SystemClock.elapsedRealtime()
    }
    internal fun startFailed() {
        active=false
        stopPending=false
        released=true
        lastSignalMs=0L
    }
    internal fun requestStop() {
        if(!released) {
            stopPending=true
            // A wake worker may still own the microphone after stopService().
            active=true
        }
    }
    internal fun receiveStatus(isActive:Boolean,diagnostic:String?) {
        // A delayed 'active' heartbeat must not cancel an in-progress stop.
        if(!isActive) {
            active=false
            stopPending=false
            released=true
            lastSignalMs=0L
        } else if(!stopPending) {
            active=true
            released=false
            lastSignalMs=SystemClock.elapsedRealtime()
        }
        if(!diagnostic.isNullOrBlank()) lastFailure=diagnostic
    }
    internal fun checkHeartbeat(maxAgeMs:Long=15_000L) {
        if(AksaraWakeLivenessPolicy.expired(active,lastSignalMs,
            SystemClock.elapsedRealtime(),maxAgeMs)) {
            active=false
            stopPending=false
            released=false // Worker death is NOT a verified microphone release.
            lastSignalMs=0L
            lastFailure="Enjin wake word tidak memberi respons. Dikte disekat sehingga servis dihentikan dan mikrofon dilepaskan."
        }
    }
    fun dismissFailure() { lastFailure=null }
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
            AksaraWakeWordStatus.requestStart()
            try {
                ContextCompat.startForegroundService(
                    context, Intent(context, AksaraWakeWordService::class.java)
                        .setAction(ACTION_START))
            } catch(error:Exception) {
                AksaraWakeWordStatus.startFailed()
                throw error
            }
        }

        fun stop(context: Context) {
            // Never start a stopped foreground microphone service from background.
            // stopService is valid even when the app is not visible.
            AksaraWakeWordStatus.requestStop()
            try {
                val wasRunning=context.stopService(Intent(context, AksaraWakeWordService::class.java))
                if(!wasRunning) AksaraWakeWordStatus.receiveStatus(false,null)
            } catch(error:Exception) {
                // A stopped/denied service is a Voice error, not a fatal Chat crash.
                AksaraWakeWordStatus.lastFailure=
                    "Android menolak penghentian wake word: ${error.javaClass.simpleName}."
            }
        }
    }

    private val main = Handler(Looper.getMainLooper())
    private var engine: SpeechRecognizer? = null
    private var stopped = false
    private var consecutiveErrors = 0
    private var defaultLocaleTried = false
    private val heartbeat = object:Runnable {
        override fun run() {
            if(!stopped) {
                broadcastStatus(true)
                main.postDelayed(this,5_000L)
            }
        }
    }
    private fun broadcastStatus(active:Boolean,reason:String?=null,activated:Boolean=false) {
        try {
            sendBroadcast(Intent(AksaraAssistantSignals.ACTION_WAKE_STATUS)
                .setPackage(packageName)
                .putExtra(AksaraAssistantSignals.EXTRA_ACTIVE,active)
                .putExtra(AksaraAssistantSignals.EXTRA_DIAGNOSTIC,reason)
                .putExtra(AksaraAssistantSignals.EXTRA_ACTIVATED,activated))
        } catch (_:Exception) { /* The owner Activity may no longer be visible. */ }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        AksaraCrashJournal.mark("wake-worker-onStartCommand")
        if(intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }
        if(AksaraWakeWordStatus.active) return START_NOT_STICKY
        // All operations here may be rejected by an OEM. Do not crash the entire
        // app or allow startForegroundService() to exceed its startup deadline.
        try {
            if(intent?.action != ACTION_START) {
                failWakeWord("Arahan mengaktifkan wake word tidak sah.")
                return START_NOT_STICKY
            }
            val micGranted=ContextCompat.checkSelfPermission(
                this,Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED
            val notificationsAllowed=runCatching {
                getSystemService(NotificationManager::class.java).areNotificationsEnabled()
            }.getOrDefault(false)
            if(AksaraWakePermissionPolicy.evaluate(micGranted,notificationsAllowed) ==
                AksaraWakeReadiness.MIC_REQUIRED) {
                failWakeWord("Izin mikrofon belum diberikan. Tekan mic untuk meminta izin dalam aplikasi.")
                return START_NOT_STICKY
            }
            if(!SpeechRecognizer.isOnDeviceRecognitionAvailable(this)) {
                failWakeWord("Enjin suara lokal tidak tersedia pada Android ini. Gunakan Voice Chat.")
                return START_NOT_STICKY
            }
            createChannels()
            startForeground(NOTIFICATION_ID,listeningNotification(),
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
            stopped=false
            consecutiveErrors=0
            defaultLocaleTried=false
            AksaraWakeWordStatus.lastFailure=null
            AksaraWakeWordStatus.active=true
            broadcastStatus(true)
            main.removeCallbacks(heartbeat)
            main.postDelayed(heartbeat,5_000L)
            scheduleListening(0L)
        } catch(error: Exception) {
            failWakeWord(when(error) {
                is SecurityException -> "Android menolak akses mikrofon ketika servis bermula. Aktifkan daripada Chatbox yang terbuka."
                else -> "Servis wake word tidak dapat bermula: ${error.javaClass.simpleName}."
            })
        }
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

    private var pendingListen:Runnable?=null

    private fun scheduleListening(waitMs: Long) {
        // Never clear the entire Handler queue here. That used to cancel the
        // five-second liveness heartbeat every time recognition was scheduled,
        // making the main process report a false worker death at ~15-20 s.
        pendingListen?.let { main.removeCallbacks(it) }
        pendingListen=null
        if(stopped) return
        val task=object:Runnable {
            override fun run() {
                pendingListen=null
                if(!stopped) listenOnce()
            }
        }
        pendingListen=task
        main.postDelayed(task,waitMs)
    }

    private fun listenOnce() {
        if (stopped) return
        AksaraCrashJournal.mark("wake-worker-listenOnce")
        try { engine?.destroy() } catch (_: Exception) { }
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
                    if(engine === recognizer && !stopped) inspect(partialResults)
                }

                override fun onResults(results: Bundle?) {
                    if(engine !== recognizer || stopped) return
                    if (!inspect(results)) {
                        consecutiveErrors = 0
                        scheduleListening(700L)
                    }
                }

                override fun onError(error: Int) {
                    if (stopped || engine !== recognizer) return
                    if (error == SpeechRecognizer.ERROR_NO_MATCH ||
                        error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
                        consecutiveErrors = 0
                        scheduleListening(950L)
                    } else {
                        when(error) {
                            SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED -> {
                                if(!defaultLocaleTried) {
                                    defaultLocaleTried=true
                                    consecutiveErrors=0
                                    // The device has no offline ms-MY model. Try its default
                                    // local language ONCE, never switch to cloud recognition.
                                    scheduleListening(600L)
                                } else failWakeWord("Wake word lokal tidak serasi dengan model bahasa pada peranti. Gunakan gestur pembantu Android atau Voice Chat.")
                            }
                            SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE ->
                                failWakeWord("Model suara lokal belum dipasang. Cuba pasang model luar talian melalui tetapan Android.")
                            SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS ->
                                failWakeWord("Izin mikrofon wake word ditolak oleh Android.")
                            SpeechRecognizer.ERROR_TOO_MANY_REQUESTS ->
                                failWakeWord("Android mengehadkan cubaan suara berulang. Wake word dihentikan untuk jimat bateri.")
                            else -> {
                                consecutiveErrors++
                                if(consecutiveErrors>=4) failWakeWord(
                                    "Enjin wake word tidak stabil (Android $error). Gunakan gestur pembantu.")
                                else scheduleListening((1600L*consecutiveErrors).coerceAtMost(7000L))
                            }
                        }
                    }
                }
            })
            recognizer.startListening(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                    RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                if(!defaultLocaleTried) putExtra(RecognizerIntent.EXTRA_LANGUAGE,"ms-MY")
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS,true)
                putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE,true)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS,1)
            })
        } catch (_: Exception) {
            consecutiveErrors++
            if(consecutiveErrors>=4) failWakeWord(
                "Android tidak dapat memulakan enjin wake word lokal.")
            else scheduleListening(2000L*consecutiveErrors)
        }
    }

    private fun failWakeWord(reason:String) {
        stopped=true
        AksaraWakeWordStatus.active=false
        AksaraWakeWordStatus.lastFailure=reason
        broadcastStatus(false,reason)
        try { stopSelf() } catch (_: Exception) { }
    }

    /** Returns true only if this recognition cycle has activated the assistant. */
    private fun inspect(bundle: Bundle?): Boolean {
        if (stopped) return false
        val candidates = bundle?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION).orEmpty()
        if (candidates.none { AksaraHotwordMatcher.matches(it) }) return false
        stopped = true
        main.removeCallbacksAndMessages(null)
        try { engine?.cancel(); engine?.destroy() } catch (_: Exception) { }
        engine = null
        AksaraWakeWordStatus.active = false
        // This service runs in :wakeword. In-process SharedFlow does not cross
        // process boundaries; deliver activation via same-package broadcast.
        broadcastStatus(false,activated=true)
        try {
            val manager=getSystemService(NotificationManager::class.java)
            // POST_NOTIFICATIONS is optional for the foreground service, but
            // a heads-up activation notification is only possible if allowed.
            if(manager.areNotificationsEnabled()) {
                manager.notify(ACTIVATION_ID, Notification.Builder(this, ACTIVATION_CHANNEL)
                    .setSmallIcon(android.R.drawable.ic_btn_speak_now)
                    .setContentTitle("Aksara dengar panggilan kau")
                    .setContentText("Buka pembantu suara")
                    .setContentIntent(openVoiceIntent())
                    .setAutoCancel(true)
                    .build())
            } else {
                AksaraWakeWordStatus.lastFailure=
                    "Panggilan dikesan, tetapi notifikasi disekat. Hidupkan notifikasi Aksara untuk pengaktifan ketika di background."
            }
        } catch (_: Exception) {
            AksaraWakeWordStatus.lastFailure=
                "Panggilan dikesan, tetapi Android tidak membenarkan notifikasi pengaktifan."
        }
        stopSelf()
        return true
    }

    override fun onDestroy() {
        AksaraCrashJournal.mark("wake-worker-onDestroy")
        stopped = true
        main.removeCallbacksAndMessages(null)
        try { engine?.cancel(); engine?.destroy() } catch (_: Exception) { }
        engine = null
        AksaraWakeWordStatus.active = false
        broadcastStatus(false)
        super.onDestroy()
    }
}
