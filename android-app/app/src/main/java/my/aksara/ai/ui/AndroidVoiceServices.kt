package my.aksara.ai.ui

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale

/**
 * Turn-based voice: microphone -> Android speech recognizer -> AKSARA text API
 * -> Android TTS. It is NOT Gemini Live and never spoofs browser credentials.
 * Microphone is started by an explicit user action, not in the background.
 */
class AndroidVoiceServices(private val context: Context) {
    private val main = Handler(Looper.getMainLooper())
    private var recognizer: SpeechRecognizer? = null
    private var voice: TextToSpeech? = null
    private var closed = false
    private var recording = false
    private var voiceReady = false

    fun initializeSpeaker(onStatus: (Boolean, String) -> Unit) {
        if (voice != null || closed) return
        voice = TextToSpeech(context) { result ->
            main.post {
                if (closed) return@post
                val engine = voice
                if (result != TextToSpeech.SUCCESS || engine == null) {
                    voiceReady = false
                    onStatus(false, "Suara bacaan Android tidak tersedia.")
                    return@post
                }
                val malay = Locale.forLanguageTag("ms-MY")
                val availability = engine.isLanguageAvailable(malay)
                val selectedLanguage = if (availability >= TextToSpeech.LANG_AVAILABLE) {
                    malay
                } else Locale.getDefault()
                val resultLanguage = engine.setLanguage(selectedLanguage)
                voiceReady = resultLanguage >= TextToSpeech.LANG_AVAILABLE
                onStatus(
                    voiceReady,
                    when {
                        !voiceReady -> "Enjin bacaan suara belum tersedia."
                        availability >= TextToSpeech.LANG_AVAILABLE ->
                            "Suara Bahasa Melayu tersedia"
                        else -> "Suara Melayu tiada; guna bahasa peranti."
                    }
                )
            }
        }
    }

    fun listen(
        onStage: (String, Boolean) -> Unit,
        onPartial: (String) -> Unit,
        onFinal: (String) -> Unit,
        onError: (String) -> Unit
    ) {
        if (closed || recording) return
        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            onError("Peranti tiada perkhidmatan pengecaman suara yang serasi.")
            return
        }
        stopSpeaking()
        if (recognizer == null) {
            recognizer = SpeechRecognizer.createSpeechRecognizer(context)
        }
        val service = recognizer ?: return
        recording = true
        service.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {
                if (recording) onStage("Sedang mendengar…", true)
            }
            override fun onBeginningOfSpeech() {
                if (recording) onStage("Aku dengar. Teruskan bercakap…", true)
            }
            override fun onRmsChanged(rmsdB: Float) {}
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() {
                if (recording) onStage("Memproses suara…", true)
            }
            override fun onError(code: Int) {
                if (!recording) return
                recording = false
                onStage("Mikrofon dimatikan", false)
                val message = when (code) {
                    SpeechRecognizer.ERROR_NO_MATCH,
                    SpeechRecognizer.ERROR_SPEECH_TIMEOUT ->
                        "Tak dapat mendengar dengan jelas. Cuba lagi."
                    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS ->
                        "Kebenaran mikrofon belum diberikan."
                    SpeechRecognizer.ERROR_NETWORK,
                    SpeechRecognizer.ERROR_NETWORK_TIMEOUT ->
                        "Perkhidmatan suara memerlukan sambungan Internet."
                    SpeechRecognizer.ERROR_RECOGNIZER_BUSY ->
                        "Mikrofon sedang digunakan. Cuba semula."
                    else -> "Pengecaman suara gagal (kod " + code + ")."
                }
                onError(message)
            }
            override fun onResults(results: Bundle?) {
                if (!recording) return
                recording = false
                onStage("Mikrofon dimatikan", false)
                val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    ?.firstOrNull()?.trim().orEmpty()
                if (text.isBlank()) onError("Tak dapat mengenal pasti ayat kau.")
                else onFinal(text.take(12_000))
            }
            override fun onPartialResults(partials: Bundle?) {
                if (!recording) return
                val text = partials
                    ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    ?.firstOrNull().orEmpty()
                if (text.isNotBlank()) onPartial(text.take(400))
            }
            override fun onEvent(eventType: Int, params: Bundle?) {}
        })
        try {
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(
                    RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                    RecognizerIntent.LANGUAGE_MODEL_FREE_FORM
                )
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ms-MY")
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "ms-MY")
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            }
            service.startListening(intent)
            onStage("Mikrofon aktif. Sila bercakap…", true)
        } catch (error: Exception) {
            recording = false
            onStage("Mikrofon dimatikan", false)
            onError("Tak dapat membuka pengecaman suara pada peranti ini.")
        }
    }

    fun cancelListening() {
        recording = false
        runCatching { recognizer?.cancel() }
    }

    fun stopSpeaking() {
        runCatching { voice?.stop() }
    }

    fun speak(markdown: String, onFinished: () -> Unit): Boolean {
        val engine = voice ?: return false
        if (closed || !voiceReady) return false
        val parts = VoiceSpokenText.segments(markdown)
        if (parts.isEmpty()) return false
        val prefix = "aksara-" + SystemClock.elapsedRealtime()
        engine.stop()
        engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(id: String?) {}
            override fun onDone(id: String?) {
                if (id == prefix + "-" + parts.lastIndex) {
                    main.post { if (!closed) onFinished() }
                }
            }
            override fun onError(id: String?) {
                if (id == prefix + "-" + parts.lastIndex) {
                    main.post { if (!closed) onFinished() }
                }
            }
        })
        parts.forEachIndexed { index, part ->
            engine.speak(
                part,
                if (index == 0) TextToSpeech.QUEUE_FLUSH else TextToSpeech.QUEUE_ADD,
                null,
                prefix + "-" + index
            )
        }
        return true
    }

    fun close() {
        closed = true
        cancelListening()
        recognizer?.destroy()
        recognizer = null
        voice?.stop()
        voice?.shutdown()
        voice = null
        voiceReady = false
    }
}
