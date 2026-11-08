package my.aksara.engine.voice

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.*
import android.media.audiofx.AcousticEchoCanceler
import android.media.audiofx.NoiseSuppressor
import android.os.Build
import android.util.Base64
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import kotlin.random.Random

data class VoiceState(
    val phase: String = "idle",
    val message: String = "Belum connect lagi.",
    val startedAt: Long? = null,
    val mic: Boolean = true,
    val speaker: Boolean = true,
    val volume: Float = 1f,
    val ready: Boolean = false,
    val reconnectAttempt: Int = 0
)

/**
 * One user session, several short-lived Gemini sockets. Every token request,
 * callback, audio channel and microphone capture belongs to a unique epoch.
 * A recovery NEVER replays captured microphone data or submitted model turns.
 */
class LiveVoiceClient(
    private val context: Context,
    private val origin: String,
    identity: String
) : AutoCloseable {
    private var instructions = identity
    private var supervisor = SupervisorJob()
    private var scope = CoroutineScope(supervisor + Dispatchers.IO)
    private val http = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.SECONDS)
        .pingInterval(20, TimeUnit.SECONDS)
        .build()
    private val mutable = MutableStateFlow(VoiceState())
    val state = mutable.asStateFlow()
    private val running = AtomicBoolean(false)
    private val epoch = AtomicInteger(0)
    private val playbackGeneration = AtomicInteger(0)
    private val queuedPackets = AtomicInteger(0)
    private var attempts = 0
    private var connectedAt = 0L
    private var lastServerEventAt = 0L
    private var thinkingSince = 0L
    private var completedTurn = false
    private var languageDrift = false
    private var foreignLanguageRequested = false
    private var resumptionHandle = ""
    private var socket: WebSocket? = null
    private var tokenCall: Call? = null
    private var connectJob: Job? = null
    private var retryJob: Job? = null
    private var microphoneJob: Job? = null
    private var playbackJob: Job? = null
    private var watchdogJob: Job? = null
    private var packetQueue = Channel<Pair<Int, ByteArray>>(128)
    private var recorder: AudioRecord? = null
    private var outputTrack: AudioTrack? = null
    private var echo: AcousticEchoCanceler? = null
    private var noise: NoiseSuppressor? = null
    private val manager = context.getSystemService(AudioManager::class.java)
    private var focus: AudioFocusRequest? = null
    private var previousMode: Int? = null

    private fun active(id: Int) = running.get() && epoch.get() == id

    @Synchronized fun start() {
        if (!running.compareAndSet(false, true)) return
        if (context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            running.set(false)
            mutable.value = mutable.value.copy(phase = "error", message = "Izin mikrofon diperlukan.", ready = false)
            return
        }
        if (!supervisor.isActive) {
            supervisor = SupervisorJob()
            scope = CoroutineScope(supervisor + Dispatchers.IO)
        }
        attempts = 0
        resumptionHandle = ""
        mutable.value = mutable.value.copy(phase = "connecting", message = "Menyambung Gemini Live…", startedAt = null, ready = false)
        connect()
    }

    /** A style or thinking-mode change is a user-authorized fresh setup, not a new conversation timer. */
    @Synchronized fun updateIdentity(value: String) {
        if (instructions == value) return
        instructions = value
        resumptionHandle = ""
        if (!running.get()) return
        epoch.incrementAndGet() // old callbacks are invalid immediately
        retryJob?.cancel()
        tearDownTransport()
        attempts = 0
        mutable.value = mutable.value.copy(phase = "reconnecting", message = "Menyelaraskan gaya suara…", ready = false)
        connect()
    }

    @Synchronized private fun connect() {
        if (!running.get()) return
        val id = epoch.incrementAndGet()
        mutable.value = mutable.value.copy(
            phase = if (state.value.startedAt == null) "connecting" else "reconnecting",
            message = if (state.value.startedAt == null) "Menyambung Gemini Live…" else "Menyambung suara semula…",
            ready = false, reconnectAttempt = attempts
        )
        connectJob = scope.launch {
            try {
                val call = http.newCall(
                    Request.Builder().url(origin + "/.netlify/functions/bilik-antara-live-token")
                        .header("Origin", origin)
                        .post("{}".toRequestBody("application/json".toMediaType())).build()
                )
                synchronized(this@LiveVoiceClient) { if (active(id)) tokenCall = call else call.cancel() }
                val tokenResult = call.execute().use { response ->
                    val body = runCatching { JSONObject(response.body?.string().orEmpty()) }.getOrDefault(JSONObject())
                    if (!response.isSuccessful) {
                        val seconds = VoiceRecoveryPolicy.retryAfterSeconds(
                            response.header("Retry-After"), body.optLong("retryAfterSeconds", 0L))
                        throw TokenFailure(response.code, body.optString("error", "HTTP " + response.code), seconds)
                    }
                    body
                }
                if (!active(id)) return@launch
                val token = tokenResult.getString("token")
                val model = tokenResult.getString("model").removePrefix("models/")
                val url = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=" +
                    java.net.URLEncoder.encode(token, "UTF-8")
                val ws = http.newWebSocket(Request.Builder().url(url).build(), object : WebSocketListener() {
                    override fun onOpen(webSocket: WebSocket, response: Response) {
                        if (!active(id)) { webSocket.close(1000, "Stale"); return }
                        val setup = JSONObject()
                            .put("model", "models/" + model)
                            .put("generationConfig", JSONObject().put("responseModalities", JSONArray().put("AUDIO"))
                                .put("speechConfig", JSONObject().put("voiceConfig", JSONObject()
                                    .put("prebuiltVoiceConfig", JSONObject().put("voiceName", "Aoede")))))
                            .put("systemInstruction", JSONObject().put("parts", JSONArray().put(JSONObject()
                                .put("text", instructions))))
                            .put("realtimeInputConfig", JSONObject().put("automaticActivityDetection", JSONObject()
                                .put("startOfSpeechSensitivity", "START_SENSITIVITY_HIGH")
                                .put("endOfSpeechSensitivity", "END_SENSITIVITY_LOW")
                                .put("prefixPaddingMs", 100)
                                .put("silenceDurationMs", 1450)))
                            .put("contextWindowCompression", JSONObject().put("slidingWindow", JSONObject()))
                            .put("sessionResumption", if (resumptionHandle.isNotBlank())
                                JSONObject().put("handle", resumptionHandle) else JSONObject())
                        // Unsupported locale hints must not break the actual Live API.
                        // outputAudioTranscription is optional; ms-MY input languageCodes is NOT forced.
                        setup.put("outputAudioTranscription", JSONObject())
                        if (!webSocket.send(JSONObject().put("setup", setup).toString())) {
                            recover(id, "Gemini Live tidak menerima setup.", true)
                        }
                    }
                    override fun onMessage(webSocket: WebSocket, text: String) { consume(text, id) }
                    override fun onMessage(webSocket: WebSocket, bytes: okio.ByteString) { consume(bytes.utf8(), id) }
                    override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                        val status = response?.code
                        if (status == 401 || status == 403 || status == 400) {
                            recover(id, "Gemini Live menolak akses atau model (HTTP " + status + ").", false)
                        } else recover(id, "Sambungan Voice terputus: " + (t.message ?: "transport"), true,
                            if (status == 429) VoiceRecoveryPolicy.retryAfterSeconds(response?.header("Retry-After"), 0L) else 0L)
                    }
                    override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                        if (code == 1000 && !active(id)) return
                        recover(id, "Gemini Live menutup sambungan (" + code + ").", code != 1008)
                    }
                })
                synchronized(this@LiveVoiceClient) {
                    if (active(id)) socket = ws else ws.close(1000, "Stale")
                }
                scope.launch {
                    delay(25_000)
                    if (active(id) && !state.value.ready) recover(id, "Gemini Live tidak mengesahkan setup.", true)
                }
            } catch (e: CancellationException) { /* invalidated token request */ }
            catch (e: TokenFailure) {
                if (e.status in setOf(400, 401, 403, 404)) recover(id, "Token Voice ditolak (HTTP " + e.status + "): " + e.message, false)
                else recover(id, "Token Voice gagal (HTTP " + e.status + ").", true,
                    if (e.status == 429) e.retryAfter else 0L)
            } catch (e: Exception) {
                if (active(id)) recover(id, VoiceBackendFailure.message(e, origin), true)
            }
        }
    }

    private data class TokenFailure(val status: Int, override val message: String, val retryAfter: Long) : IOException(message)

    private fun consume(text: String, id: Int) {
        if (!active(id)) return
        try {
            val data = JSONObject(text)
            if (data.has("error")) {
                val details = data.getJSONObject("error")
                val code = details.optInt("code", 0)
                recover(id, "Gemini Live: " + details.optString("message", "Ralat model."),
                    code !in setOf(400, 401, 403, 404))
                return
            }
            if (data.has("sessionResumptionUpdate")) {
                val update = data.getJSONObject("sessionResumptionUpdate")
                if (update.optBoolean("resumable") && update.optString("newHandle").isNotBlank())
                    resumptionHandle = update.optString("newHandle")
                else if (update.has("resumable") && !update.optBoolean("resumable")) resumptionHandle = ""
            }
            if (data.has("goAway")) {
                // Renew with a new token; the server-supplied handle is used only when eligible.
                recover(id, "Google meminta sesi Live diperbaharui.", true)
                return
            }
            if (data.has("setupComplete")) {
                scope.launch {
                    if (!active(id)) return@launch
                    try {
                        prepareAudio(id)
                        if (active(id)) {
                            connectedAt = System.currentTimeMillis()
                            lastServerEventAt = connectedAt
                            mutable.value = mutable.value.copy(
                                phase = "listening", message = "Aku dengar. Kau boleh cakap.",
                                startedAt = mutable.value.startedAt ?: connectedAt, ready = true
                            )
                            startWatchdog(id)
                            delay(30_000)
                            if (active(id) && state.value.ready) synchronized(this@LiveVoiceClient) { attempts = 0 }
                        }
                    } catch (e: Exception) {
                        recover(id, "Audio tidak dapat dimulakan: " + (e.message ?: "tidak diketahui"), false)
                    }
                }
                return
            }
            val content = data.optJSONObject("serverContent") ?: return
            lastServerEventAt = System.currentTimeMillis()
            if (content.optBoolean("interrupted")) {
                playbackGeneration.incrementAndGet()
                outputTrack?.pause(); outputTrack?.flush(); outputTrack?.play()
                completedTurn = false
                thinkingSince = 0
                mutable.value = mutable.value.copy(phase = "listening", message = "Aku dengar.")
            }
            val transcript = content.optJSONObject("inputTranscription")?.optString("text").orEmpty()
            if (transcript.contains(Regex("(?i)\\b(?:sepanyol|spanish|español|terjemah|translate)\\b")))
                foreignLanguageRequested = true
            val spoken = content.optJSONObject("outputTranscription")?.optString("text").orEmpty()
            if (!foreignLanguageRequested && spoken.isNotBlank() && suspectSpanish(spoken)) languageDrift = true
            val turn = content.optJSONObject("modelTurn")
            if (turn != null) {
                if (thinkingSince == 0L) thinkingSince = System.currentTimeMillis()
                if (state.value.phase != "speaking") mutable.value = mutable.value.copy(
                    phase = "thinking", message = "Aksara sedang memproses jawapan…")
                val parts = turn.optJSONArray("parts") ?: JSONArray()
                for (i in 0 until parts.length()) {
                    val item = parts.optJSONObject(i)?.optJSONObject("inlineData") ?: continue
                    if (!item.optString("mimeType").startsWith("audio/pcm")) continue
                    val packet = Base64.decode(item.getString("data"), Base64.DEFAULT)
                    queuedPackets.incrementAndGet()
                    if (!packetQueue.trySend(playbackGeneration.get() to packet).isSuccess) {
                        queuedPackets.decrementAndGet()
                        recover(id, "Barisan audio Gemini Live sesak.", true)
                        return
                    }
                    mutable.value = mutable.value.copy(phase = "speaking", message = "Aksara tengah jawab…")
                }
            }
            if (content.optBoolean("turnComplete")) {
                completedTurn = true
                thinkingSince = 0L
                if (languageDrift) {
                    languageDrift = false
                    foreignLanguageRequested = false
                    resumptionHandle = "" // Do not restore drifted language context.
                    recover(id, "Bahasa respons tersasar; memulihkan Bahasa Melayu.", true)
                } else {
                    foreignLanguageRequested = false
                    finishPlaybackIfReady(id)
                }
            }
        } catch (e: Exception) {
            if (active(id)) recover(id, "Paket Gemini Live tidak dapat diproses: " + (e.message ?: ""), true)
        }
    }

    private fun suspectSpanish(text: String): Boolean {
        return VoiceRecoveryPolicy.suspectSpanish(text)
    }

    private fun finishPlaybackIfReady(id: Int) {
        if (active(id) && completedTurn && queuedPackets.get() == 0) {
            mutable.value = mutable.value.copy(phase = "listening", message = "Aku dengar.")
        }
    }

    @Suppress("MissingPermission")
    @Synchronized private fun prepareAudio(id: Int) {
        if (!active(id) || recorder != null) return
        packetQueue = Channel(128)
        queuedPackets.set(0)
        completedTurn = false
        playbackGeneration.incrementAndGet()
        val attrs = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build()
        focus = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
            .setAudioAttributes(attrs).setOnAudioFocusChangeListener { change ->
                if (change == AudioManager.AUDIOFOCUS_LOSS) {
                    recover(id, "Audio focus dibatalkan oleh Android.", false)
                }
            }.build()
        check(manager.requestAudioFocus(focus!!) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) { "Audio focus ditolak." }
        previousMode = manager.mode
        manager.mode = AudioManager.MODE_IN_COMMUNICATION
        routeToSpeaker()
        val minInput = AudioRecord.getMinBufferSize(16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
        check(minInput > 0) { "Format mikrofon 16 kHz tidak disokong." }
        val input = AudioRecord.Builder().setAudioSource(MediaRecorder.AudioSource.VOICE_COMMUNICATION)
            .setAudioFormat(AudioFormat.Builder().setSampleRate(16000)
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT).setChannelMask(AudioFormat.CHANNEL_IN_MONO).build())
            .setBufferSizeInBytes(maxOf(3200, minInput * 2)).build()
        check(input.state == AudioRecord.STATE_INITIALIZED) { "AudioRecord gagal." }
        recorder = input
        if (AcousticEchoCanceler.isAvailable()) echo = AcousticEchoCanceler.create(input.audioSessionId)?.apply { enabled = true }
        if (NoiseSuppressor.isAvailable()) noise = NoiseSuppressor.create(input.audioSessionId)?.apply { enabled = true }
        val minOutput = AudioTrack.getMinBufferSize(24000, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT)
        check(minOutput > 0) { "PCM 24 kHz tidak disokong." }
        val playbackAttrs = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build()
        val playback = AudioTrack.Builder().setAudioAttributes(playbackAttrs)
            .setAudioFormat(AudioFormat.Builder().setSampleRate(24000)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO).setEncoding(AudioFormat.ENCODING_PCM_16BIT).build())
            .setBufferSizeInBytes(maxOf(4800, minOutput * 2)).setTransferMode(AudioTrack.MODE_STREAM).build()
        check(playback.state == AudioTrack.STATE_INITIALIZED) { "AudioTrack gagal." }
        outputTrack = playback
        playback.setVolume(if (state.value.speaker) state.value.volume else 0f)
        playback.play()
        playbackJob = scope.launch {
            for ((packetGeneration, bytes) in packetQueue) {
                if (!active(id)) break
                try {
                    if (packetGeneration == playbackGeneration.get() && state.value.speaker) {
                        var offset = 0
                        while (offset < bytes.size && active(id) && packetGeneration == playbackGeneration.get()) {
                            val count = playback.write(bytes, offset, bytes.size - offset, AudioTrack.WRITE_BLOCKING)
                            if (count <= 0) throw IOException("AudioTrack write: " + count)
                            offset += count
                        }
                    }
                } catch (e: Exception) {
                    if (active(id)) recover(id, "Main balik audio terhenti.", true)
                    break
                } finally {
                    queuedPackets.updateAndGet { current -> (current - 1).coerceAtLeast(0) }
                    finishPlaybackIfReady(id)
                }
            }
        }
        input.startRecording()
        microphoneJob = scope.launch {
            val frame = ByteArray(3200)
            var rejected = 0
            while (active(id) && isActive) {
                val n = input.read(frame, 0, frame.size, AudioRecord.READ_BLOCKING)
                if (n < 0) { if (active(id)) recover(id, "AudioRecord read: " + n, true); break }
                if (n > 0 && state.value.mic) {
                    val packet = JSONObject().put("realtimeInput", JSONObject()
                        .put("audio", JSONObject().put("mimeType", "audio/pcm;rate=16000")
                            .put("data", Base64.encodeToString(frame, 0, n, Base64.NO_WRAP)))).toString()
                    val sent = socket?.send(packet) == true
                    if (sent) rejected = 0 else if (++rejected >= 3) {
                        recover(id, "Gemini Live tidak menerima audio mikrofon.", true)
                        break
                    }
                }
            }
        }
    }

    private fun startWatchdog(id: Int) {
        watchdogJob?.cancel()
        watchdogJob = scope.launch {
            while (active(id)) {
                delay(5000)
                // Silence/listening and normal output buffering must NEVER trigger recovery.
                // Only an acknowledged but abandoned model turn is suspect.
                if (active(id) && state.value.phase == "thinking" && thinkingSince > 0L &&
                    queuedPackets.get() == 0 && System.currentTimeMillis() - thinkingSince > 95_000 &&
                    System.currentTimeMillis() - lastServerEventAt > 95_000) {
                    recover(id, "Giliran Gemini Live tidak selesai selepas sambungan senyap.", true)
                    break
                }
            }
        }
    }

    @Synchronized private fun recover(id: Int, why: String, retryable: Boolean, retryAfterSeconds: Long = 0L) {
        if (!active(id)) return
        if (!retryable) { endWithError(why); return }
        val next = attempts + 1
        if (next > 3) { endWithError("Sambungan Voice gagal dipulihkan selepas tiga cubaan. " + why); return }
        attempts = next
        val invalidated = epoch.incrementAndGet()
        tearDownTransport()
        mutable.value = mutable.value.copy(phase = "reconnecting", message = why, ready = false, reconnectAttempt = next)
        val base = VoiceRecoveryPolicy.backoffMs(next, Random.nextLong(0, 250))
        // Honor server Retry-After; never switch credentials to bypass quota.
        val delayMs = maxOf(base, retryAfterSeconds.coerceAtLeast(0L).coerceAtMost(86_400L) * 1000L)
        retryJob?.cancel()
        retryJob = scope.launch {
            delay(delayMs)
            if (running.get() && epoch.get() == invalidated) connect()
        }
    }

    @Synchronized private fun endWithError(why: String) {
        close()
        mutable.value = mutable.value.copy(phase = "error", message = why, ready = false)
    }

    @Synchronized private fun tearDownTransport() {
        tokenCall?.cancel(); tokenCall = null
        connectJob?.cancel(); connectJob = null
        watchdogJob?.cancel(); watchdogJob = null
        socket?.close(1000, "Transport renewed"); socket = null
        microphoneJob?.cancel(); microphoneJob = null
        runCatching { recorder?.stop() }; recorder?.release(); recorder = null
        echo?.release(); echo = null
        noise?.release(); noise = null
        playbackGeneration.incrementAndGet()
        packetQueue.close()
        playbackJob?.cancel(); playbackJob = null
        runCatching { outputTrack?.pause(); outputTrack?.flush(); outputTrack?.stop() }
        outputTrack?.release(); outputTrack = null
        queuedPackets.set(0)
        focus?.let { manager.abandonAudioFocusRequest(it) }; focus = null
        restoreRouting()
        completedTurn = false
        thinkingSince = 0L
        languageDrift = false
        foreignLanguageRequested = false
    }

    @Suppress("DEPRECATION") private fun routeToSpeaker() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val builtIn = manager.availableCommunicationDevices
                .firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER }
            if (builtIn != null && manager.setCommunicationDevice(builtIn)) return
        }
        manager.isSpeakerphoneOn = true
    }
    @Suppress("DEPRECATION") private fun restoreRouting() {
        val old = previousMode ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) manager.clearCommunicationDevice()
        else manager.isSpeakerphoneOn = false
        manager.mode = old
        previousMode = null
    }

    fun setMic(enabled: Boolean) {
        mutable.value = mutable.value.copy(mic = enabled)
        if (!enabled) socket?.send("{\"realtimeInput\":{\"audioStreamEnd\":true}}")
    }
    fun setSpeaker(enabled: Boolean) {
        mutable.value = mutable.value.copy(speaker = enabled)
        if (!enabled) {
            playbackGeneration.incrementAndGet()
            outputTrack?.pause(); outputTrack?.flush(); outputTrack?.play()
        }
        outputTrack?.setVolume(if (enabled) state.value.volume else 0f)
    }
    fun setVolume(volume: Float) {
        mutable.value = mutable.value.copy(volume = volume.coerceIn(0f, 1f))
        outputTrack?.setVolume(if (state.value.speaker) state.value.volume else 0f)
    }

    @Synchronized override fun close() {
        epoch.incrementAndGet()
        running.set(false)
        retryJob?.cancel(); retryJob = null
        tearDownTransport()
        supervisor.cancel()
        attempts = 0
        resumptionHandle = ""
        languageDrift = false
        foreignLanguageRequested = false
        mutable.value = mutable.value.copy(phase = "idle", message = "Sesi ditamatkan.",
            startedAt = null, ready = false, reconnectAttempt = 0)
    }
}
