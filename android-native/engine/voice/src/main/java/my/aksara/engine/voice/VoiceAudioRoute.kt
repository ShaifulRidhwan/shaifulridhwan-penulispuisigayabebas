package my.aksara.engine.voice

import android.media.AudioDeviceInfo

/**
 * Deterministic communication route preferences.
 * Only devices offered by AudioManager.availableCommunicationDevices may be selected.
 * setCommunicationDevice selects the matching INPUT automatically when available.
 */
object VoiceAudioRoute {
    private val wired = setOf(AudioDeviceInfo.TYPE_WIRED_HEADSET,
        AudioDeviceInfo.TYPE_WIRED_HEADPHONES, AudioDeviceInfo.TYPE_USB_HEADSET,
        AudioDeviceInfo.TYPE_USB_DEVICE, AudioDeviceInfo.TYPE_USB_ACCESSORY)
    private val wireless = setOf(AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
        AudioDeviceInfo.TYPE_BLE_HEADSET, AudioDeviceInfo.TYPE_HEARING_AID)

    fun accessory(type: Int): Boolean = type in wired || type in wireless
    fun wireless(type: Int): Boolean = type in wireless

    fun chooseType(available: List<Int>, current: Int?): Int? {
        if (current != null && accessory(current) && current in available) return current
        return available.firstOrNull { it in wired }
            ?: available.firstOrNull { it in wireless }
            ?: available.firstOrNull { it == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER }
            ?: available.firstOrNull { it == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE }
    }

    fun label(type: Int): String = when(type) {
        AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> "Bluetooth Hands-Free"
        AudioDeviceInfo.TYPE_BLE_HEADSET -> "Bluetooth LE"
        AudioDeviceInfo.TYPE_HEARING_AID -> "Alat pendengaran"
        AudioDeviceInfo.TYPE_WIRED_HEADSET -> "Earphone berwayar"
        AudioDeviceInfo.TYPE_WIRED_HEADPHONES -> "Headphone berwayar"
        AudioDeviceInfo.TYPE_USB_HEADSET, AudioDeviceInfo.TYPE_USB_DEVICE,
        AudioDeviceInfo.TYPE_USB_ACCESSORY -> "Audio USB"
        AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> "Speaker telefon"
        AudioDeviceInfo.TYPE_BUILTIN_EARPIECE -> "Earpiece telefon"
        AudioDeviceInfo.TYPE_BUILTIN_MIC -> "Mic telefon"
        else -> "Audio peranti"
    }

    fun mismatch(outputType: Int?, inputType: Int?): Boolean =
        outputType != null && wireless(outputType) && inputType != null &&
            inputType != AudioDeviceInfo.TYPE_BLUETOOTH_SCO &&
            inputType != AudioDeviceInfo.TYPE_BLE_HEADSET &&
            inputType != AudioDeviceInfo.TYPE_HEARING_AID
}
