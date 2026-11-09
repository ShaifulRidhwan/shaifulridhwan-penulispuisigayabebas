package my.aksara.engine.voice

import android.media.AudioDeviceInfo
import org.junit.Assert.*
import org.junit.Test

class VoiceAudioPolicyTest {
    @Test fun captureFrameSizeAdaptsToDuplexRouting() {
        assertEquals(640,VoiceAudioPolicy.captureBytes(AudioDeviceInfo.TYPE_WIRED_HEADSET))
        assertEquals(640,VoiceAudioPolicy.captureBytes(AudioDeviceInfo.TYPE_USB_HEADSET))
        assertEquals(1920,VoiceAudioPolicy.captureBytes(AudioDeviceInfo.TYPE_BLUETOOTH_SCO))
        assertEquals(1280,VoiceAudioPolicy.captureBytes(null))
        assertEquals(1280,VoiceAudioPolicy.captureBytes(AudioDeviceInfo.TYPE_BUILTIN_SPEAKER))
    }
    @Test fun pushToTalkNeverCapturesWhenMicMutedOrButtonReleased() {
        assertTrue(VoiceAudioPolicy.captureAllowed(true,false,false))
        assertTrue(VoiceAudioPolicy.captureAllowed(true,true,true))
        assertFalse(VoiceAudioPolicy.captureAllowed(true,true,false))
        assertFalse(VoiceAudioPolicy.captureAllowed(false,true,true))
        assertFalse(VoiceAudioPolicy.captureAllowed(false,false,true))
    }
    @Test fun audioLevelIsNormalizedAndNeverClaimedSpeechProbability() {
        assertEquals(0f,VoiceAudioPolicy.rms(byteArrayOf(0,0,0,0),4),0.00001f)
        assertEquals(0f,VoiceAudioPolicy.rms(byteArrayOf(),0),0.00001f)
        assertTrue(VoiceAudioPolicy.rms(byteArrayOf(0,64,0,-64),4)>0.4f)
        assertEquals(0f,VoiceAudioPolicy.rms(byteArrayOf(1),1),0.00001f)
    }
}
