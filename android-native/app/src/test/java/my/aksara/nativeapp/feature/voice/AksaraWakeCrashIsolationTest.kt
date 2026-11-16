package my.aksara.nativeapp.feature.voice

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Structural safety regression: a third-party recognizer must not be able to
 * terminate the Chatbox process, and a dead worker must not leave a fake
 * "listening" indicator indefinitely.
 */
class AksaraWakeCrashIsolationTest {
    @Test fun staleIsolatedWorkerIsDetected() {
        assertTrue(AksaraWakeLivenessPolicy.expired(true,1_000L,16_001L))
        assertFalse(AksaraWakeLivenessPolicy.expired(true,1_000L,15_999L))
        assertFalse(AksaraWakeLivenessPolicy.expired(false,1_000L,40_000L))
        assertFalse(AksaraWakeLivenessPolicy.expired(true,0L,40_000L))
    }

    @Test fun microphoneWorkerIsInSeparateAndroidProcess() {
        val manifest=File("app/src/main/AndroidManifest.xml").readText()
        val service=Regex("""<service\s+android:name="\.feature\.voice\.AksaraWakeWordService"([\s\S]*?)/>""")
            .find(manifest)?.value.orEmpty()
        assertTrue("experimental recognizer must be isolated from Chatbox process",
            service.contains("""android:process=":wakeword""""))
        assertTrue(service.contains("""android:exported="false""""))
        assertTrue(service.contains("""android:foregroundServiceType="microphone""""))
    }

    @Test fun statusBridgeUsesBroadcastAndNotCrossProcessSharedFlow() {
        val code=File("app/src/main/java/my/aksara/nativeapp/feature/voice/AksaraWakeWordService.kt").readText()
        val activity=File("app/src/main/java/my/aksara/nativeapp/MainActivity.kt").readText()
        assertTrue(code.contains("broadcastStatus(false,activated=true)"))
        assertTrue(code.contains("sendBroadcast(Intent(AksaraAssistantSignals.ACTION_WAKE_STATUS)"))
        assertTrue(activity.contains("ContextCompat.registerReceiver(this,wakeReceiver"))
        assertTrue(activity.contains("AksaraWakeWordStatus.checkHeartbeat()"))
    }
}
