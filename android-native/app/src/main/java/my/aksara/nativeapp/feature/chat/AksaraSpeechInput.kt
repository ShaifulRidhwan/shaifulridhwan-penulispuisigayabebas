package my.aksara.nativeapp.feature.chat

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat

/**
 * One-shot ms-MY dictation for the existing Chatbox composer.
 * Uses Android's *on-device* recognizer only. Never silently switches to cloud ASR.
 * Must be driven and destroyed on the main thread by its composing owner.
 */
internal class AksaraSpeechInput(private val context: Context) {
    var listening by mutableStateOf(false)
        private set
    var partial by mutableStateOf("")
        private set

    private var recognizer: SpeechRecognizer? = null

    fun start(onFinal: (String) -> Unit, onError: (String) -> Unit) {
        if (listening) return
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) !=
            PackageManager.PERMISSION_GRANTED) {
            onError("Izin mikrofon belum diberikan.")
            return
        }
        if (!SpeechRecognizer.isOnDeviceRecognitionAvailable(context)) {
            onError("Pengecaman suara lokal tidak tersedia pada peranti ini. Voice Live masih boleh digunakan.")
            return
        }
        dispose()
        val engine = try { SpeechRecognizer.createOnDeviceSpeechRecognizer(context) }
        catch (error: Exception) {
            onError("Enjin dikte lokal gagal dimulakan: ${error.message ?: "tidak tersedia"}")
            return
        }
        recognizer = engine
        engine.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) { listening = true }
            override fun onBeginningOfSpeech() = Unit
            override fun onRmsChanged(rmsdB: Float) = Unit
            override fun onBufferReceived(buffer: ByteArray?) = Unit
            override fun onEndOfSpeech() = Unit
            override fun onEvent(eventType: Int, params: Bundle?) = Unit

            override fun onPartialResults(partialResults: Bundle?) {
                partial = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    ?.firstOrNull().orEmpty()
            }

            override fun onResults(results: Bundle?) {
                val spoken = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    ?.firstOrNull()?.trim().orEmpty()
                dispose()
                if (spoken.isNotBlank()) onFinal(spoken)
                else onError("Tiada pertuturan dapat dikenal pasti.")
            }

            override fun onError(error: Int) {
                dispose()
                onError(when (error) {
                    SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT ->
                        "Tiada pertuturan dikesan. Cuba sekali lagi."
                    SpeechRecognizer.ERROR_RECOGNIZER_BUSY ->
                        "Mikrofon sedang digunakan oleh enjin suara lain."
                    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS ->
                        "Izin mikrofon tidak mencukupi."
                    else -> "Dikte suara terganggu (kod $error)."
                })
            }
        })
        val request = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ms-MY")
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "ms-MY")
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }
        try {
            listening = true
            engine.startListening(request)
        } catch (error: Exception) {
            dispose()
            onError("Tidak dapat mengaktifkan dikte: ${error.message ?: "ralat audio"}")
        }
    }

    fun stop() {
        recognizer?.stopListening()
        listening = false
        partial = ""
    }

    fun dispose() {
        recognizer?.cancel()
        recognizer?.destroy()
        recognizer = null
        listening = false
        partial = ""
    }
}
