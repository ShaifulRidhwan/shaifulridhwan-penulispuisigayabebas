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
 * Android owns role selection. No default-assistant takeover without user consent.
 * This remains separate from the experimental microphone foreground service.
 */
class AksaraSystemAssistantService : VoiceInteractionService()

class AksaraAssistantSessionService : VoiceInteractionSessionService() {
    override fun onNewSession(args: Bundle?): VoiceInteractionSession =
        AksaraAssistantSession(this)
}

private class AksaraAssistantSession(private val sessionContext: Context) :
    VoiceInteractionSession(sessionContext) {

    private var activityLaunchRequested = false

    private fun assistantIntent() = Intent(sessionContext, MainActivity::class.java).apply {
        action = AksaraAssistantSignals.ACTION_OPEN_VOICE
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or
            Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }

    override fun onCreateContentView(): View =
        TextView(sessionContext).apply {
            text = "Aksara A.I.\nTekan untuk buka Voice Chat"
            textSize = 18f
            setPadding(30, 36, 30, 36)
            setOnClickListener { launchAssistant() }
        }

    override fun onPrepareShow(args: Bundle?, showFlags: Int) {
        super.onPrepareShow(args, showFlags)
        // The activity supplies our actual Live UI. Avoid racing two system
        // windows on assistant invocation, especially on Xiaomi/HyperOS.
        setUiEnabled(false)
    }

    override fun onShow(args: Bundle?, showFlags: Int) {
        super.onShow(args, showFlags)
        launchAssistant()
    }

    private fun launchAssistant() {
        if(activityLaunchRequested) return
        try {
            startAssistantActivity(assistantIntent())
            activityLaunchRequested = true
            // Do not synchronously hide a session while the system is still
            // attaching the assistant Activity. OEM transitions may race.
        } catch (_: Exception) {
            activityLaunchRequested = false
            // If the OEM refuses an assistant Activity, restore the tappable
            // system-provided session instead of crashing or disappearing.
            try { setUiEnabled(true) } catch (_: Exception) { }
        }
    }

    override fun onHide() {
        activityLaunchRequested = false
        super.onHide()
    }
}
