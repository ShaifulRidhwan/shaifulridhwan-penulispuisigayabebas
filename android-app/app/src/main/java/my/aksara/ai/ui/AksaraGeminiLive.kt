package my.aksara.ai.ui

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.os.Handler
import android.os.Looper
import android.util.Base64
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import my.aksara.ai.data.GeminiLiveProtocol
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

/**
 * Owner-QA-only native Gemini Live. Uses server-minted one-use ephemeral tokens,
 * never embeds a provider API key, never forges web Origin. This feature cannot
 * connect until the separately gated mobile backend is deployed and configured.
 */
class AksaraGeminiLive(private val context: Context) {
    private val main = Handler(Looper.getMainLooper())
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val client = OkHttpClient.Builder()
        .pingInterval(20, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()

    private var socket: WebSocket? = null
    private var mic: AudioRecord? = null
    private var speaker: AudioTrack? = null
    private var micJob: Job? = null
    private var playJob: Job? = null
    private var playerQueue: Channel<ByteArray>? = null
    @Volatile private var running = false
    @Volatile private var micEnabled = true
    @Volatile private var speakerEnabled = true
    @Volatile private var generation = 0
    private var closed = false

    data class Credentials(val token: String, val model: String)

    private suspend fun fetchCredential(ownerToken: String): Credentials =
        withContext(Dispatchers.IO) {
            if (!ownerToken.matches(Regex("""^[A-Za-z0-9_-]{32,128}$"""))) {
                throw IOException("Token QA pemilik mesti 32 hingga 128 aksara.")
            }
            val url = URL(
                "https://shaifulridhwan-penulispuisigayabebas.netlify.app/" +
                    ".netlify/functions/bilik-antara-live-android"
            )
            val conn = url.openConnection() as HttpURLConnection
            try {
                conn.requestMethod = "POST"
                conn.connectTimeout = 12000
                conn.readTimeout = 22000
                conn.instanceFollowRedirects = false
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("Authorization", "Bearer " + ownerToken)
                conn.outputStream.use { it.write("""{"mode":"auto"}""".toByteArray()) }
                val status = conn.responseCode
                val input = if (status in 200..299) conn.inputStream else conn.errorStream
                val bytes = input?.use { stream ->
                    val output = ByteArrayOutputStream()
                    val buffer = ByteArray(2048)
                    while (true) {
                        val count = stream.read(buffer)
                        if (count < 0) break
                        if (output.size() + count > 4000) {
                            throw IOException("Respons broker Voice terlalu besar.")
                        }
                        output.write(buffer, 0, count)
                    }
                    output.toByteArray()
                } ?: byteArrayOf()
                val data = try { JSONObject(String(bytes, Charsets.UTF_8)) }
                    catch (_: Exception) {
                        if (status == 404) throw IOException(
                            "Backend Voice Android belum di-deploy di Netlify."
                        )
                        throw IOException("Respons broker Voice tidak sah (HTTP " + status + ").")
                    }
                if (status !in 200..299) {
                    throw IOException(data.optString("error").take(180)
                        .ifBlank { "Broker Voice belum tersedia (HTTP " + status + ")." })
                }
                val token = data.optString("token")
                val model = data.optString("model")
                if (!token.matches(Regex("""^auth_tokens/[A-Za-z0-9_-]{10,2048}$""")) ||
                    model !in GeminiLiveProtocol.supportedModels
                ) {
                    throw IOException("Broker mengeluarkan token atau model tidak sah.")
                }
                Credentials(token, model)
            } finally {
                conn.disconnect()
            }
        }

    @SuppressLint("MissingPermission")
    fun start(
        ownerToken: String,
        mode: String,
        onStatus: (String) -> Unit,
        onTranscript: (String, String) -> Unit
    ) {
        if (closed || running) return
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED
        ) {
            onStatus("Kebenaran mikrofon diperlukan untuk Voice Live.")
            return
        }
        running = true
        micEnabled = true
        val current = ++generation
        onStatus("Menyemak akses Voice Live…")
        scope.launch {
            try {
                val creds = fetchCredential(ownerToken)
                if (!running || generation != current) return@launch
                onStatus("Token sementara diterima. Menyambung Google Live…")
                val address = "wss://generativelanguage.googleapis.com/ws/" +
                    "google.ai.generativelanguage.v1beta.GenerativeService." +
                    "BidiGenerateContentConstrained?access_token=" +
                    URLEncoder.encode(creds.token, "UTF-8")
                val req = Request.Builder().url(address).build()
                socket = client.newWebSocket(req, object : WebSocketListener() {
                    override fun onOpen(webSocket: WebSocket, response: Response) {
                        if (!running || generation != current) return
                        val setup = runCatching {
                            GeminiLiveProtocol.setup(creds.model, mode)
                        }.getOrNull() ?: return
                        webSocket.send(setup)
                        main.post { if (running && generation == current)
                            onStatus("Sambungan dibuka. Menunggu pengesahan Google…") }
                    }
                    override fun onMessage(webSocket: WebSocket, text: String) {
                        if (!running || generation != current || text.length > 3_000_000) return
                        val frame = runCatching { JSONObject(text) }.getOrNull() ?: return
                        if (frame.has("setupComplete")) {
                            main.post {
                                if (running && generation == current) {
                                    onStatus("Gemini Live tersambung. Kau boleh bercakap.")
                                    startAudio(current, onStatus)
                                }
                            }
                        }
                        val server = frame.optJSONObject("serverContent") ?: return
                        fun transcript(kind: String, obj: JSONObject?) {
                            val value = obj?.optString("text")?.take(1000).orEmpty()
                            if (value.isNotBlank()) main.post {
                                if (running && generation == current)
                                    onTranscript(kind, value)
                            }
                        }
                        transcript("Kau", server.optJSONObject("inputTranscription"))
                        transcript("Aksara", server.optJSONObject("outputTranscription"))
                        if (server.optBoolean("interrupted")) {
                            playerQueue?.tryReceive()
                            runCatching { speaker?.pause(); speaker?.flush(); speaker?.play() }
                        }
                        val parts = server.optJSONObject("modelTurn")?.optJSONArray("parts")
                        if (parts != null) {
                            for (i in 0 until parts.length()) {
                                val inline = parts.optJSONObject(i)
                                    ?.optJSONObject("inlineData") ?: continue
                                val mime = inline.optString("mimeType")
                                if (!mime.startsWith("audio/pcm")) continue
                                val encoded = inline.optString("data")
                                if (encoded.length > 350000) continue
                                val audio = runCatching {
                                    Base64.decode(encoded, Base64.DEFAULT)
                                }.getOrNull() ?: continue
                                if (audio.size in 2..262144) playerQueue?.trySend(audio)
                            }
                        }
                    }
                    override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                        main.post {
                            if (running && generation == current) {
                                onStatus("Sambungan Live terganggu. Tekan Live untuk cuba semula.")
                                stop()
                            }
                        }
                    }
                    override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                        main.post {
                            if (running && generation == current) {
                                onStatus("Google Live menamatkan sambungan ($code).")
                                stop()
                            }
                        }
                    }
                })
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                if (running && generation == current) {
                    onStatus((e.message ?: "Voice Live gagal.").take(180))
                    stop()
                }
            }
        }
    }

    @SuppressLint("MissingPermission")
    private fun startAudio(activeId: Int, onStatus: (String) -> Unit) {
        if (!running || generation != activeId) return
        if (mic != null) return
        try {
            val inputMin = AudioRecord.getMinBufferSize(
                16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT
            )
            val outputMin = AudioTrack.getMinBufferSize(
                24000, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT
            )
            if (inputMin <= 0 || outputMin <= 0) throw IOException(
                "Format audio PCM tidak disokong pada peranti."
            )
            mic = AudioRecord(
                MediaRecorder.AudioSource.VOICE_RECOGNITION, 16000,
                AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT,
                maxOf(inputMin, 3200)
            )
            if (mic?.state != AudioRecord.STATE_INITIALIZED) {
                throw IOException("Mikrofon gagal dimulakan.")
            }
            speaker = AudioTrack(
                AudioManager.STREAM_MUSIC, 24000,
                AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT,
                maxOf(outputMin, 8192), AudioTrack.MODE_STREAM
            )
            if (speaker?.state != AudioTrack.STATE_INITIALIZED) {
                throw IOException("Output audio gagal dimulakan.")
            }
            speaker?.play()
            mic?.startRecording()
            val queue = Channel<ByteArray>(capacity = 24)
            playerQueue = queue
            playJob = scope.launch(Dispatchers.IO) {
                for (audio in queue) {
                    if (!running || generation != activeId) break
                    if (speakerEnabled) {
                        runCatching {
                            speaker?.write(audio, 0, audio.size, AudioTrack.WRITE_BLOCKING)
                        }
                    }
                }
            }
            startMicCapture(activeId)

        } catch (_: SecurityException) {
            onStatus("Akses mikrofon telah ditarik balik oleh Android.")
            stop()
        } catch (e: Exception) {
            onStatus((e.message ?: "Sesi audio gagal.").take(150))
            stop()
        }
    }


    private fun startMicCapture(activeId: Int) {
        if (!running || !micEnabled || generation != activeId) return
        micJob?.cancel()
        micJob = scope.launch(Dispatchers.IO) {
            val buffer = ByteArray(640) // 20ms of mono, 16kHz, 16-bit PCM.
            while (isActive && running && micEnabled && generation == activeId) {
                val n = mic?.read(buffer, 0, buffer.size) ?: -1
                if (n < 0) break
                if (n > 0) {
                    val ws = socket ?: break
                    if (ws.queueSize() > 1_000_000) continue
                    val pcm = Base64.encodeToString(buffer, 0, n, Base64.NO_WRAP)
                    ws.send(GeminiLiveProtocol.microphone(pcm))
                }
            }
        }
    }

    @SuppressLint("MissingPermission")
    fun setMic(enabled: Boolean) {
        if (micEnabled == enabled) return
        micEnabled = enabled
        // Muting stops audio capture at the Android AudioRecord service.
        if (!enabled) {
            runCatching { mic?.stop() }
            micJob?.cancel()
            micJob = null
        } else if (running) {
            runCatching {
                mic?.startRecording()
                startMicCapture(generation)
            }.onFailure { stop() }
        }
    }
    fun setSpeaker(enabled: Boolean) {
        speakerEnabled = enabled
        if (!enabled) {
            runCatching { speaker?.pause(); speaker?.flush() }
        } else {
            runCatching { speaker?.play() }
        }
    }

    fun stop() {
        running = false
        generation++
        micJob?.cancel()
        playJob?.cancel()
        runCatching { mic?.stop() }
        runCatching { mic?.release() }
        mic = null
        runCatching { speaker?.pause(); speaker?.flush(); speaker?.release() }
        speaker = null
        playerQueue?.close()
        playerQueue = null
        socket?.close(1000, "Ditutup oleh pengguna")
        socket = null
    }
    fun close() {
        closed = true
        stop()
        scope.coroutineContext[kotlinx.coroutines.Job]?.cancel()
        client.dispatcher.executorService.shutdown()
        client.connectionPool.evictAll()
    }
}
