package my.aksara.engine.voice

import android.media.AudioDeviceInfo
import kotlin.math.sqrt

/**
 * P2 low-latency microphone and duplex route policy. Actual endpointing remains
 * the Gemini Live server's responsibility. RMS is an advisory level, not ASR
 * confidence or proof of speech language/content.
 */
object VoiceAudioPolicy {
    const val MIC_RATE_HZ=16_000
    const val PLAYBACK_RATE_HZ=24_000

    /** 20-60ms at 16 kHz PCM16 mono, versus the old fixed 100ms capture frame. */
    fun captureBytes(routeType:Int?):Int = when(routeType){
        AudioDeviceInfo.TYPE_BLUETOOTH_SCO,AudioDeviceInfo.TYPE_BLE_HEADSET,
        AudioDeviceInfo.TYPE_HEARING_AID -> 1920 // 60 ms for HFP packet jitter
        AudioDeviceInfo.TYPE_USB_HEADSET,AudioDeviceInfo.TYPE_WIRED_HEADSET -> 640 // 20 ms
        else -> 1280 // 40 ms speaker, earpiece or unknown
    }

    fun captureAllowed(micEnabled:Boolean,pushToTalk:Boolean,pressed:Boolean):Boolean =
        micEnabled && (!pushToTalk || pressed)

    /** PCM16 RMS normalized to [0..1]; neither ASR probability nor VAD certification. */
    fun rms(bytes:ByteArray,count:Int):Float {
        val length=(count.coerceIn(0,bytes.size)/2)
        if(length==0)return 0f
        var squares=0.0
        for(i in 0 until length){
            val a=bytes[i*2].toInt() and 255
            val b=bytes[i*2+1].toInt()
            val sample=((b shl 8) or a).toShort().toInt()
            val normalized=sample/32768.0
            squares+=normalized*normalized
        }
        return sqrt(squares/length).toFloat().coerceIn(0f,1f)
    }
}
