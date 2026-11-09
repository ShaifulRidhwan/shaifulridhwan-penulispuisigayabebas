package my.aksara.nativeapp.feature.chat

import androidx.compose.ui.graphics.Color

/** This is pre-response processing, not access to hidden model reasoning. */
internal object ThinkingActivity {
    fun awaitingFirstReply(state: ChatState): Boolean {
        val last = state.messages.lastOrNull() ?: return false
        return state.busy && last.role == "assistant" && last.incomplete && last.text.isBlank()
    }
}

/** Voice status must come from the LiveVoiceClient state, not the Gemini text health check. */
internal enum class VoiceLinkState(val description: String, val tone: Color) {
    IDLE("Sedia", Color(0xffe6c58b)),
    CONNECTING("Menyambung", Color(0xff8bcafa)),
    LIVE("LIVE", Color(0xff65dfb2)),
    ERROR("Ralat sambungan", Color(0xffff878e));

    companion object {
        fun from(phase: String, ready: Boolean): VoiceLinkState = when {
            ready && phase in setOf("listening", "thinking", "speaking") -> LIVE
            phase in setOf("connecting", "reconnecting") -> CONNECTING
            phase == "error" -> ERROR
            else -> IDLE
        }
    }
}
