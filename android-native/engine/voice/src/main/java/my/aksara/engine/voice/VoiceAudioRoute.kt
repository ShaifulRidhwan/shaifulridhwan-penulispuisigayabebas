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
        // Keep the current route only if it can support bidirectional voice.
        // Wired HEADPHONES or generic USB media outputs may have no microphone,
        // and must not outrank an available Bluetooth / wired call headset.
        val duplexWired = setOf(AudioDeviceInfo.TYPE_WIRED_HEADSET,
            AudioDeviceInfo.TYPE_USB_HEADSET)
        if (current != null && current in available &&
            (current in duplexWired || wireless(current))) return current
        return available.firstOrNull { it in duplexWired }
            ?: available.firstOrNull { it in wireless }
            ?: available.firstOrNull { it in wired }
            ?: available.firstOrNull { it == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER }
            ?: available.firstOrNull { it == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE }
    }

    /** Request the microphone of the chosen duplex accessory, never a random media-only output. */
    fun preferredMicrophoneType(outputType: Int?, inputTypes: List<Int>): Int? {
        val duplex = outputType != null && (wireless(outputType) ||
            outputType == AudioDeviceInfo.TYPE_WIRED_HEADSET ||
            outputType == AudioDeviceInfo.TYPE_USB_HEADSET)
        return outputType?.takeIf { duplex && it in inputTypes }
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
        outputType != null && (wireless(outputType) ||
            outputType == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP) && inputType != null &&
            !wireless(inputType)

    /** Compare observed capture/playback against the chosen communication accessory. */
    fun observedWarning(selectedType: Int?, inputType: Int?, outputType: Int?): String? {
        if (selectedType != null && wireless(selectedType)) {
            if (outputType == null || inputType == null)
                return "Laluan Bluetooth belum dapat disahkan pada input dan output."
            if (!wireless(outputType))
                return "Bluetooth dipilih tetapi suara sebenar masih keluar melalui peranti lain."
            if (!wireless(inputType))
                return "Suara melalui Bluetooth, tetapi mikrofon sebenar bukan mikrofon Bluetooth."
        }
        if (outputType == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP)
            return "Bluetooth media digunakan tanpa laluan panggilan dua hala yang disahkan."
        if (outputType != null && wireless(outputType) && inputType == null)
            return "Output Bluetooth disahkan; mikrofon sebenar belum disahkan."
        if (mismatch(outputType,inputType))
            return "Audio keluar melalui Bluetooth, tetapi mikrofon masih pada peranti lain."
        return null
    }
}
