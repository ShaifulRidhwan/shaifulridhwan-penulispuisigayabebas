package my.aksara.engine.voice

import android.media.AudioDeviceInfo
import org.junit.Assert.*
import org.junit.Test

class VoiceAudioRouteTest {
    @Test fun bluetoothHeadsetWinsOverPhoneLoudspeaker() {
        val devices=listOf(AudioDeviceInfo.TYPE_BUILTIN_SPEAKER,
            AudioDeviceInfo.TYPE_BLUETOOTH_SCO)
        assertEquals(AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
            VoiceAudioRoute.chooseType(devices,AudioDeviceInfo.TYPE_BUILTIN_SPEAKER))
    }
    @Test fun wiredEarphonesTakePriorityButRespectsSelectedAccessory() {
        val wired=AudioDeviceInfo.TYPE_WIRED_HEADSET
        val bt=AudioDeviceInfo.TYPE_BLUETOOTH_SCO
        assertEquals(wired,VoiceAudioRoute.chooseType(listOf(wired,bt),null))
        assertEquals(bt,VoiceAudioRoute.chooseType(listOf(wired,bt),bt))
        assertEquals(wired,VoiceAudioRoute.chooseType(listOf(wired,bt),wired))
    }
    @Test fun unavailableBluetoothFallsBackToDevice() {
        assertEquals(AudioDeviceInfo.TYPE_BUILTIN_SPEAKER,
            VoiceAudioRoute.chooseType(listOf(AudioDeviceInfo.TYPE_BUILTIN_SPEAKER),null))
        assertNull(VoiceAudioRoute.chooseType(emptyList(),null))
    }
    @Test fun unmatchedBluetoothMicrophoneRaisesTruthfulWarning() {
        assertTrue(VoiceAudioRoute.mismatch(AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
            AudioDeviceInfo.TYPE_BUILTIN_MIC))
        assertFalse(VoiceAudioRoute.mismatch(AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
            AudioDeviceInfo.TYPE_BLUETOOTH_SCO))
        assertFalse(VoiceAudioRoute.mismatch(AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
            AudioDeviceInfo.TYPE_BUILTIN_MIC))
    }
}
