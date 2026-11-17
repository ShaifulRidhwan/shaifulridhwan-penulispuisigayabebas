package my.aksara.nativeapp.feature.chat

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognitionSupport
import android.speech.RecognitionSupportCallback
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import java.util.Locale
import my.aksara.nativeapp.AksaraCrashJournal

/** No silent network fallback: the user explicitly consents before SYSTEM is used. */
internal enum class AksaraSpeechMode { LOCAL, SYSTEM_MALAY, SYSTEM_AUTO }
internal enum class AksaraSpeechAlternative { SYSTEM_CONSENT, AUTO_LANGUAGE, MODEL_DOWNLOAD }

internal object AksaraSpeechPolicy {
    fun isMalay(tag: String): Boolean = Locale.forLanguageTag(tag).language == "ms"

    fun preferredMalay(tags: Collection<String>): String? =
        tags.firstOrNull { it.equals("ms-MY", ignoreCase = true) }
            ?: tags.firstOrNull { isMalay(it) }

    fun alternative(mode: AksaraSpeechMode, error: Int): AksaraSpeechAlternative? =
        when (error) {
            SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED ->
                when(mode) {
                    AksaraSpeechMode.LOCAL -> AksaraSpeechAlternative.SYSTEM_CONSENT
                    AksaraSpeechMode.SYSTEM_MALAY -> AksaraSpeechAlternative.AUTO_LANGUAGE
                    AksaraSpeechMode.SYSTEM_AUTO -> null
                }
            SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE ->
                if(mode == AksaraSpeechMode.LOCAL) AksaraSpeechAlternative.MODEL_DOWNLOAD
                else null
            else -> null
        }

    fun message(error: Int): String = when(error) {
        SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT ->
            "Tiada pertuturan dikesan. Cuba sekali lagi."
        SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED ->
            "Bahasa Melayu tidak disokong oleh enjin pengecaman suara yang dipilih."
        SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE ->
            "Model Bahasa Melayu belum tersedia pada peranti."
        SpeechRecognizer.ERROR_RECOGNIZER_BUSY ->
            "Enjin suara sedang digunakan. Tamatkan Voice atau wake word dahulu."
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS ->
            "Izin mikrofon tidak mencukupi."
        SpeechRecognizer.ERROR_TOO_MANY_REQUESTS ->
            "Terlalu banyak cubaan suara. Cuba semula selepas sebentar."
        SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT ->
            "Pengecaman sistem menghadapi masalah rangkaian."
        SpeechRecognizer.ERROR_AUDIO -> "Android tidak dapat membaca audio mikrofon."
        SpeechRecognizer.ERROR_SERVER_DISCONNECTED ->
            "Servis pengecaman suara Android terputus."
        else -> "Pengecaman suara gagal (Android $error)."
    }
}

/**
 * One microphone owner for Chatbox dictation. LOCAL stays offline. SYSTEM may
 * transfer audio to the user's configured recognizer and is NEVER selected
 * until the owner explicitly approves it in the Chatbox UI.
 */
internal class AksaraSpeechInput(private val context: Context) {
    var listening by mutableStateOf(false)
        private set
    var partial by mutableStateOf("")
        private set
    var currentMode by mutableStateOf(AksaraSpeechMode.LOCAL)
        private set

    private var recognizer: SpeechRecognizer? = null

    private fun request(mode: AksaraSpeechMode): Intent =
        Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            if(mode != AksaraSpeechMode.SYSTEM_AUTO) {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ms-MY")
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "ms-MY")
            }
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE,
                mode == AksaraSpeechMode.LOCAL)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }

    fun start(
        mode: AksaraSpeechMode = AksaraSpeechMode.LOCAL,
        onFinal: (String) -> Unit,
        onError: (String) -> Unit,
        onAlternative: (AksaraSpeechAlternative) -> Unit
    ) {
        AksaraCrashJournal.mark("speech-${mode.name.lowercase()}-requested")
        if(listening) return
        if(ContextCompat.checkSelfPermission(context,Manifest.permission.RECORD_AUDIO) !=
            PackageManager.PERMISSION_GRANTED) {
            onError("Izin mikrofon belum diberikan.")
            return
        }
        if(mode == AksaraSpeechMode.LOCAL &&
            !SpeechRecognizer.isOnDeviceRecognitionAvailable(context)) {
            onAlternative(AksaraSpeechAlternative.SYSTEM_CONSENT)
            return
        }
        if(mode != AksaraSpeechMode.LOCAL &&
            !SpeechRecognizer.isRecognitionAvailable(context)) {
            onError("Tiada servis dikte sistem pada Android. Cuba Voice Chat.")
            return
        }

        dispose()
        currentMode=mode
        val engine=try {
            if(mode == AksaraSpeechMode.LOCAL)
                SpeechRecognizer.createOnDeviceSpeechRecognizer(context)
            else SpeechRecognizer.createSpeechRecognizer(context)
        } catch (error: Exception) {
            onError("Servis pengecaman tidak tersedia: ${error.message ?: "cuba Voice Chat"}")
            return
        }
        recognizer=engine
        val intent=request(mode)
        AksaraCrashJournal.mark("speech-engine-created")
        engine.setRecognitionListener(object: RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) { if(recognizer===engine) listening=true }
            override fun onBeginningOfSpeech()=Unit
            override fun onRmsChanged(rmsdB: Float)=Unit
            override fun onBufferReceived(buffer: ByteArray?)=Unit
            override fun onEndOfSpeech()=Unit
            override fun onEvent(eventType: Int,params: Bundle?)=Unit
            override fun onPartialResults(results: Bundle?) {
                if(recognizer===engine) partial=results
                    ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    ?.firstOrNull().orEmpty()
            }
            override fun onResults(results: Bundle?) {
                if(recognizer!==engine) return
                AksaraCrashJournal.mark("speech-results-received")
                val spoken=results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    ?.firstOrNull()?.trim().orEmpty()
                dispose()
                if(spoken.isNotBlank()) onFinal(spoken)
                else onError("Tiada perkataan dikenali. Cuba semula.")
            }
            override fun onError(error: Int) {
                if(recognizer!==engine) return
                AksaraCrashJournal.mark("speech-error-$error")
                dispose()
                val alternative=AksaraSpeechPolicy.alternative(mode,error)
                if(alternative!=null) onAlternative(alternative)
                else onError(AksaraSpeechPolicy.message(error))
            }
        })
        listening=true
        fun listen() {
            if(recognizer!==engine) return
            AksaraCrashJournal.mark("speech-engine-start-listening")
            try { engine.startListening(intent) }
            catch(error:Exception) {
                dispose()
                onError("Tidak dapat memulakan dikte: ${error.message ?: "servis tidak tersedia"}")
            }
        }
        // Query installed languages on Android 13+ before starting an unavailable
        // offline recognizer. If an OEM does not implement this API, the regular
        // listener still receives a precise error instead of a generic code 12.
        if(mode==AksaraSpeechMode.LOCAL && Build.VERSION.SDK_INT>=33) {
            try {
                engine.checkRecognitionSupport(intent,context.mainExecutor,
                    object: RecognitionSupportCallback {
                        override fun onSupportResult(support: RecognitionSupport) {
                            if(recognizer!==engine) return
                            val installed=AksaraSpeechPolicy.preferredMalay(
                                support.installedOnDeviceLanguages)
                            if(installed!=null) {
                                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE,installed)
                                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE,installed)
                                listen()
                            } else {
                                val downloadable=AksaraSpeechPolicy.preferredMalay(
                                    support.supportedOnDeviceLanguages+
                                        support.pendingOnDeviceLanguages)
                                dispose()
                                onAlternative(if(downloadable!=null)
                                    AksaraSpeechAlternative.MODEL_DOWNLOAD
                                else AksaraSpeechAlternative.SYSTEM_CONSENT)
                            }
                        }
                        override fun onError(error: Int) { listen() }
                    })
            } catch(_:Exception) { listen() }
        } else listen()
    }

    /** Explicit action for offline models that Android reports as downloadable. */
    fun requestOfflineMalayDownload(onResult: (String)->Unit) {
        if(Build.VERSION.SDK_INT<33 ||
            !SpeechRecognizer.isOnDeviceRecognitionAvailable(context)) {
            onResult("Muat turun model lokal tidak disokong Android ini.")
            return
        }
        val engine=try { SpeechRecognizer.createOnDeviceSpeechRecognizer(context) }
        catch(_:Exception) { onResult("Enjin lokal tidak tersedia.");return }
        try {
            engine.triggerModelDownload(request(AksaraSpeechMode.LOCAL))
            onResult("Permintaan model Bahasa Melayu dihantar kepada Android. Semak tetapan bahasa suara, kemudian cuba mic semula.")
        } catch(_:Exception) {
            onResult("Android tidak menyediakan muat turun model Melayu. Gunakan dikte sistem atau Voice Chat.")
        } finally { engine.destroy() }
    }

    fun stop() {
        try { recognizer?.stopListening() }
        catch(_:Exception) { dispose() }
        // Results may arrive asynchronously after stopListening.
    }

    fun dispose() {
        val old=recognizer
        recognizer=null
        listening=false
        partial=""
        // OEM RecognitionService implementations may throw on teardown. Never
        // allow a failed cancel/destroy to terminate the entire Chatbox.
        try { old?.cancel() } catch(_:Exception) { }
        try { old?.destroy() } catch(_:Exception) { }
    }
}
