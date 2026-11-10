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
    @Test fun mediaOnlyCurrentRouteDoesNotBlockDuplexBluetoothHeadset() {
        val headphones = AudioDeviceInfo.TYPE_WIRED_HEADPHONES
        val bluetooth = AudioDeviceInfo.TYPE_BLUETOOTH_SCO
        assertEquals(bluetooth,
            VoiceAudioRoute.chooseType(listOf(headphones,bluetooth),headphones))
        val usbMedia = AudioDeviceInfo.TYPE_USB_DEVICE
        assertEquals(bluetooth,
            VoiceAudioRoute.chooseType(listOf(usbMedia,bluetooth),usbMedia))
        assertEquals(headphones, VoiceAudioRoute.chooseType(listOf(headphones),headphones))
    }
    @Test fun unavailableBluetoothFallsBackToDevice() {
        assertEquals(AudioDeviceInfo.TYPE_BUILTIN_SPEAKER,
            VoiceAudioRoute.chooseType(listOf(AudioDeviceInfo.TYPE_BUILTIN_SPEAKER),null))
        assertNull(VoiceAudioRoute.chooseType(emptyList(),null))
    }
    @Test fun bluetoothDuplexUsesItsRealInputWhenOffered() {
        val bt=AudioDeviceInfo.TYPE_BLUETOOTH_SCO
        assertEquals(bt, VoiceAudioRoute.preferredMicrophoneType(bt,
            listOf(AudioDeviceInfo.TYPE_BUILTIN_MIC,bt)))
        assertNull(VoiceAudioRoute.preferredMicrophoneType(bt,
            listOf(AudioDeviceInfo.TYPE_BUILTIN_MIC)))
    }
    @Test fun mediaOnlyHeadphonesNeverHijackCaptureDevice() {
        assertNull(VoiceAudioRoute.preferredMicrophoneType(
            AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
            listOf(AudioDeviceInfo.TYPE_BUILTIN_MIC)))
        assertEquals(AudioDeviceInfo.TYPE_WIRED_HEADSET,
            VoiceAudioRoute.preferredMicrophoneType(AudioDeviceInfo.TYPE_WIRED_HEADSET,
                listOf(AudioDeviceInfo.TYPE_WIRED_HEADSET,AudioDeviceInfo.TYPE_BUILTIN_MIC)))
    }
    @Test fun bluetoothMediaOutputCannotPassAsDuplex() {
        val a2dp=AudioDeviceInfo.TYPE_BLUETOOTH_A2DP
        val phone=AudioDeviceInfo.TYPE_BUILTIN_MIC
        assertTrue(VoiceAudioRoute.mismatch(a2dp,phone))
        assertNotNull(VoiceAudioRoute.observedWarning(null,phone,a2dp))
        assertNotNull(VoiceAudioRoute.observedWarning(
            AudioDeviceInfo.TYPE_BLUETOOTH_SCO,phone,AudioDeviceInfo.TYPE_BUILTIN_SPEAKER))
        assertNotNull(VoiceAudioRoute.observedWarning(
            AudioDeviceInfo.TYPE_BLUETOOTH_SCO,null,null))
        assertNull(VoiceAudioRoute.observedWarning(AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
            AudioDeviceInfo.TYPE_BLUETOOTH_SCO,AudioDeviceInfo.TYPE_BLUETOOTH_SCO))
    }
    @Test fun duplexHeadsetHasPriorityOverMediaOnlyWiredHeadphones() {
        assertEquals(AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
            VoiceAudioRoute.chooseType(listOf(AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
                AudioDeviceInfo.TYPE_BLUETOOTH_SCO),null))
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
