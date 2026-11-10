package my.aksara.nativeapp

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioManager
import android.os.SystemClock
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import my.aksara.engine.voice.LiveVoiceClient
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.File

/** Real Live handshake and platform audio lifecycle. No acoustic-quality claim. */
class LiveVoiceLifecycleTest {
    @Test fun realLiveSessionInitializesAudioAndRestoresModeOnClose() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        assertEquals("CI must explicitly grant the microphone permission", PackageManager.PERMISSION_GRANTED,
            context.checkSelfPermission(Manifest.permission.RECORD_AUDIO))
        val declaredPermissions = context.packageManager.getPackageInfo(
            context.packageName, PackageManager.GET_PERMISSIONS).requestedPermissions.orEmpty().toList()
        assertTrue("Voice routing requires MODIFY_AUDIO_SETTINGS in AndroidManifest",
            Manifest.permission.MODIFY_AUDIO_SETTINGS in declaredPermissions)
        val manager = context.getSystemService(AudioManager::class.java)
        val initialMode = manager.mode
        val before = manager.activeRecordingConfigurations.size
        ActivityScenario.launch(MainActivity::class.java).use {
            val client = LiveVoiceClient(context, BuildConfig.API_ORIGIN,
                "Berbual dalam Bahasa Melayu santai. Ini ujian kitar hayat audio; tunggu pengguna bercakap.")
            val start = SystemClock.elapsedRealtime()
            try {
                client.start()
                val deadline = start + 75000
                while (!client.state.value.ready && client.state.value.phase != "error" && SystemClock.elapsedRealtime() < deadline) {
                    SystemClock.sleep(100)
                }
                assertTrue("Real Live initialization failed: " + client.state.value.message, client.state.value.ready)
                val initializedMs = SystemClock.elapsedRealtime() - start
                SystemClock.sleep(300)
                client.close()
                SystemClock.sleep(1000)
                assertEquals("idle", client.state.value.phase)
                assertFalse(client.state.value.ready)
                assertNull(client.state.value.startedAt)
                assertEquals("AudioManager mode must be restored", initialMode, manager.mode)
                assertTrue("Microphone capture must end", manager.activeRecordingConfigurations.size <= before)
                val report = JSONObject().put("initializedMs", initializedMs)
                    .put("closedPhase", client.state.value.phase).put("restoredAudioMode", manager.mode)
                    .put("recordingConfigurationsAfter", manager.activeRecordingConfigurations.size)
                    .put("limitation", "Software emulator audio; no physical microphone, Bluetooth, ASR or acoustic-quality result")
                File(context.getExternalFilesDir(null), "live-audio-lifecycle.json").writeText(report.toString(2))
                println("AKSARA_LIVE_LIFECYCLE=" + report)
            } finally {
                client.close()
            }
        }
    }
}
