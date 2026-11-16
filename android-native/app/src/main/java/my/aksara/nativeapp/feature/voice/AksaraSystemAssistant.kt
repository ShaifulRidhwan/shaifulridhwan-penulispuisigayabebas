package my.aksara.nativeapp.feature.voice

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.service.voice.VoiceInteractionService
import android.service.voice.VoiceInteractionSession
import android.service.voice.VoiceInteractionSessionService
import android.view.View
import android.widget.TextView
import my.aksara.nativeapp.MainActivity

/**
 * Opt-in Android assistant role. The system controls which app is selected.
 * This service cannot silently replace the user's current assistant.
 */
class AksaraSystemAssistantService : VoiceInteractionService()

class AksaraAssistantSessionService : VoiceInteractionSessionService() {
    override fun onNewSession(args: Bundle?): VoiceInteractionSession =
        AksaraAssistantSession(this)
}

private class AksaraAssistantSession(private val sessionContext: Context) : VoiceInteractionSession(sessionContext) {
    override fun onCreateContentView(): View =
        TextView(sessionContext).apply {
            text = "Aksara A.I. · Membuka pembantu suara"
            textSize = 18f
            setPadding(30, 36, 30, 36)
        }

    override fun onShow(args: Bundle?, showFlags: Int) {
        super.onShow(args, showFlags)
        val intent = Intent(sessionContext, MainActivity::class.java).apply {
            action = AksaraAssistantSignals.ACTION_OPEN_VOICE
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        try {
            startAssistantActivity(intent)
            hide()
        } catch (_: Exception) {
            // Keep the system-provided session visible as a safe fallback.
            // Some OEMs restrict launching an Activity from assistant sessions.
        }
    }
}
