package my.aksara.engine.voice

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.*
import android.os.Build
import android.media.audiofx.*
import android.util.Base64
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.*
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/** Same ephemeral-token broker, Gemini Live constrained socket and Aoede as the web. */
data class VoiceState(val phase:String="idle",val message:String="Belum connect lagi.",val startedAt:Long?=null,val mic:Boolean=true,val speaker:Boolean=true,val volume:Float=1f)
class LiveVoiceClient(private val context:Context,private val origin:String,private val identity:String):AutoCloseable {
    private val job=SupervisorJob();private val scope=CoroutineScope(job+Dispatchers.IO)
    private val client=OkHttpClient.Builder().connectTimeout(20,TimeUnit.SECONDS).readTimeout(0,TimeUnit.SECONDS).build()
    private val mutable=MutableStateFlow(VoiceState());val state=mutable.asStateFlow()
    private val running=AtomicBoolean(false)
    private var socket:WebSocket?=null;private var recorder:AudioRecord?=null;private var track:AudioTrack?=null
    private var echo:AcousticEchoCanceler?=null;private var noise:NoiseSuppressor?=null
    private var tokenCall:Call?=null;private var micJob:Job?=null
    private val audio=Channel<Pair<Int,ByteArray>>(128)
    private var generation=0
    private val manager=context.getSystemService(AudioManager::class.java)
    private var focus:AudioFocusRequest?=null
    private var previousAudioMode:Int?=null
    fun start(){
        if(!running.compareAndSet(false,true))return
        if(context.checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){fail("Izin mikrofon diperlukan.");return}
        mutable.value=mutable.value.copy(phase="connecting",message="Menyambung Gemini Live…")
        scope.launch {
            try {
                val call=client.newCall(Request.Builder().url(origin+"/.netlify/functions/bilik-antara-live-token").header("Origin",origin).post("{}".toRequestBody("application/json".toMediaType())).build());tokenCall=call
                val data=call.execute().use { response -> val body=JSONObject(response.body?.string().orEmpty());if(!response.isSuccessful)error(body.optString("error","HTTP ${response.code}"));body }
                if(!running.get())return@launch
                val token=data.getString("token");val model=data.getString("model")
                socket=client.newWebSocket(Request.Builder().url("wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token="+java.net.URLEncoder.encode(token,"UTF-8")).build(),object:WebSocketListener(){
                    override fun onOpen(ws:WebSocket,response:Response){
                        if(!running.get()){ws.close(1000,"Stopped");return}
                        val setup=JSONObject().put("model","models/$model").put("generationConfig",JSONObject().put("responseModalities",JSONArray().put("AUDIO")).put("speechConfig",JSONObject().put("voiceConfig",JSONObject().put("prebuiltVoiceConfig",JSONObject().put("voiceName","Aoede")))))
                            .put("systemInstruction",JSONObject().put("parts",JSONArray().put(JSONObject().put("text",identity))))
                            .put("realtimeInputConfig",JSONObject().put("automaticActivityDetection",JSONObject().put("startOfSpeechSensitivity","START_SENSITIVITY_HIGH").put("endOfSpeechSensitivity","END_SENSITIVITY_LOW").put("prefixPaddingMs",100).put("silenceDurationMs",1450)))
                            .put("contextWindowCompression",JSONObject().put("slidingWindow",JSONObject()))
                            .put("sessionResumption",JSONObject())
                        ws.send(JSONObject().put("setup",setup).toString())
                    }
                    override fun onMessage(ws:WebSocket,text:String){consume(text)}
                    override fun onMessage(ws:WebSocket,bytes:okio.ByteString){consume(bytes.utf8())}
                    override fun onFailure(ws:WebSocket,t:Throwable,response:Response?){if(running.get())fail("Sambungan Voice terputus. Cuba sambung semula.")}
                    override fun onClosed(ws:WebSocket,code:Int,reason:String){if(running.get())fail("Sesi Gemini Live tamat ($code).")}
                })
                delay(25_000)
                if(state.value.phase=="connecting")fail("Google belum confirm connection Voice.")
            }catch(e:Exception){if(running.get())fail(e.message?:"Voice gagal disambungkan.")}
        }
    }
    private fun consume(text:String){
        try {
            val data=JSONObject(text)
            if(data.has("error")){fail(data.getJSONObject("error").optString("message","Gemini Live gagal."));return}
            if(data.has("setupComplete")){
                scope.launch {try{startAudio();mutable.value=mutable.value.copy(phase="listening",message="Aku dengar. Kau boleh cakap.",startedAt=System.currentTimeMillis())}catch(e:Exception){fail(e.message?:"Audio gagal.")}}
            }
            if(data.has("goAway")){fail("Google meminta sesi diperbaharui. Sambung semula untuk teruskan.");return}
            val content=data.optJSONObject("serverContent")?:return
            if(content.optBoolean("interrupted")){generation++;track?.pause();track?.flush();track?.play();mutable.value=mutable.value.copy(phase="listening",message="Aku dengar.")}
            val parts=content.optJSONObject("modelTurn")?.optJSONArray("parts")?:JSONArray()
            for(i in 0 until parts.length()){
                val inline=parts.optJSONObject(i)?.optJSONObject("inlineData")?:continue
                val mime=inline.optString("mimeType")
                if(mime.startsWith("audio/pcm")){
                    val bytes=Base64.decode(inline.getString("data"),Base64.DEFAULT)
                    if(!audio.trySend(generation to bytes).isSuccess){fail("Barisan audio penuh. Sesi dihentikan untuk elak RAM bertambah.");return}
                    mutable.value=mutable.value.copy(phase="speaking",message="Aksara tengah jawab…")
                }
            }
            if(content.optBoolean("turnComplete"))mutable.value=mutable.value.copy(phase="listening",message="Aku dengar.")
        }catch(e:Exception){fail("Respons Voice tidak boleh dibaca.")}
    }
    @Suppress("MissingPermission") private fun startAudio(){
        if(!running.get()||recorder!=null)return
        val attrs=AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build()
        focus=AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT).setAudioAttributes(attrs).setOnAudioFocusChangeListener { change -> if(change==AudioManager.AUDIOFOCUS_LOSS||change==AudioManager.AUDIOFOCUS_LOSS_TRANSIENT)fail("Audio dijeda oleh Android.") }.build()
        check(manager.requestAudioFocus(focus!!)==AudioManager.AUDIOFOCUS_REQUEST_GRANTED){"Audio focus tidak diberikan."}
        previousAudioMode=manager.mode
        manager.mode=AudioManager.MODE_IN_COMMUNICATION
        routeVoiceToLoudspeaker()
        val input=AudioRecord.Builder().setAudioSource(MediaRecorder.AudioSource.VOICE_COMMUNICATION).setAudioFormat(AudioFormat.Builder().setSampleRate(16000).setEncoding(AudioFormat.ENCODING_PCM_16BIT).setChannelMask(AudioFormat.CHANNEL_IN_MONO).build()).setBufferSizeInBytes(maxOf(3200,AudioRecord.getMinBufferSize(16000,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT)*2)).build()
        check(input.state==AudioRecord.STATE_INITIALIZED){"AudioRecord tidak bersedia."};recorder=input
        if(AcousticEchoCanceler.isAvailable())echo=AcousticEchoCanceler.create(input.audioSessionId)?.apply{enabled=true}
        if(NoiseSuppressor.isAvailable())noise=NoiseSuppressor.create(input.audioSessionId)?.apply{enabled=true}
        val output=AudioTrack.Builder().setAudioAttributes(attrs).setAudioFormat(AudioFormat.Builder().setSampleRate(24000).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).setEncoding(AudioFormat.ENCODING_PCM_16BIT).build()).setBufferSizeInBytes(maxOf(4800,AudioTrack.getMinBufferSize(24000,AudioFormat.CHANNEL_OUT_MONO,AudioFormat.ENCODING_PCM_16BIT)*2)).setTransferMode(AudioTrack.MODE_STREAM).build()
        track=output;output.setVolume(state.value.volume);output.play()
        scope.launch {for((epoch,bytes) in audio){if(!running.get())break;if(epoch==generation&&state.value.speaker)output.write(bytes,0,bytes.size,AudioTrack.WRITE_BLOCKING)}}
        input.startRecording()
        micJob=scope.launch {
            val buffer=ByteArray(3200)
            while(running.get()&&isActive){
                val n=input.read(buffer,0,buffer.size,AudioRecord.READ_BLOCKING)
                if(n<0){if(running.get())fail("Bacaan mikrofon gagal ($n).");break}
                if(n>0&&state.value.mic)socket?.send(JSONObject().put("realtimeInput",JSONObject().put("audio",JSONObject().put("mimeType","audio/pcm;rate=16000").put("data",Base64.encodeToString(buffer,0,n,Base64.NO_WRAP)))).toString())
            }
        }
    }
    // Voice communication uses a different volume stream from Android media.
    // Explicit routing avoids inaudible earpiece playback on many handsets.
    @Suppress("DEPRECATION")
    private fun routeVoiceToLoudspeaker(){
        if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.S){
            val builtIn=manager.availableCommunicationDevices.firstOrNull{it.type==AudioDeviceInfo.TYPE_BUILTIN_SPEAKER}
            if(builtIn!=null&&manager.setCommunicationDevice(builtIn))return
        }
        manager.isSpeakerphoneOn=true
    }
    @Suppress("DEPRECATION")
    private fun restoreAudioRouting(){
        val original=previousAudioMode?:return
        if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.S)manager.clearCommunicationDevice()
        else manager.isSpeakerphoneOn=false
        manager.mode=original
        previousAudioMode=null
    }
    fun setMic(enabled:Boolean){mutable.value=mutable.value.copy(mic=enabled);if(!enabled)socket?.send("{\"realtimeInput\":{\"audioStreamEnd\":true}}")}
    fun setSpeaker(enabled:Boolean){mutable.value=mutable.value.copy(speaker=enabled);if(!enabled){generation++;track?.pause();track?.flush();track?.play()};track?.setVolume(if(enabled)state.value.volume else 0f)}
    fun setVolume(volume:Float){mutable.value=mutable.value.copy(volume=volume.coerceIn(0f,1f));if(state.value.speaker)track?.setVolume(state.value.volume)}
    private fun fail(message:String){close();mutable.value=mutable.value.copy(phase="error",message=message,startedAt=null)}
    override fun close(){
        running.set(false);tokenCall?.cancel();socket?.close(1000,"Sesi ditamatkan");socket=null
        micJob?.cancel();runCatching{recorder?.stop()};recorder?.release();recorder=null
        runCatching{track?.stop()};track?.release();track=null
        echo?.release();noise?.release();echo=null;noise=null
        focus?.let {manager.abandonAudioFocusRequest(it)};focus=null;restoreAudioRouting()
        audio.close();job.cancel()
        if(state.value.phase!="error")mutable.value=mutable.value.copy(phase="idle",message="Sesi ditamatkan.",startedAt=null)
    }
}
