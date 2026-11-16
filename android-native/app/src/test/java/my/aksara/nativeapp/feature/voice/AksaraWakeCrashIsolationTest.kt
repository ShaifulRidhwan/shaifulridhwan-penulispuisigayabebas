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
    @Test fun neverShareMicrophoneUntilWorkerReleaseIsAcknowledged() {
        assertFalse(AksaraWakeAudioHandoff.canStartOtherRecognizer(true,false,false))
        assertFalse(AksaraWakeAudioHandoff.canStartOtherRecognizer(true,true,false))
        assertFalse(AksaraWakeAudioHandoff.canStartOtherRecognizer(false,true,false))
        assertFalse(AksaraWakeAudioHandoff.canStartOtherRecognizer(false,false,false))
        assertTrue(AksaraWakeAudioHandoff.canStartOtherRecognizer(false,false,true))
    }

    @Test fun chatAndVoiceBothWaitForCrossProcessRelease() {
        val chat=readMainSource("java/my/aksara/nativeapp/feature/chat/AksaraScreen.kt")
        val releaseWait="snapshotFlow { AksaraWakeWordStatus.canStartOtherAudio }.first { it }"
        assertTrue("chat mic and Voice should await the isolated worker release",
            chat.split(releaseWait).size>=3)
        assertTrue(chat.contains("micHandoffPending=true"))
        assertTrue(chat.contains("voiceHandoffPending=value"))
        assertTrue(chat.contains("Wake word tidak mengesahkan pelepasan mikrofon"))
    }

    private fun readMainSource(path:String):String {
        // Gradle Test.workDir can be the module root or the Android project root.
        return listOf(File("src/main/$path"),File("app/src/main/$path"))
            .firstOrNull { it.isFile }?.readText()
            ?: error("Expected Android main source not found: $path")
    }

    @Test fun abnormalExitDiagnosticsDistinguishCrashFromNormalExit() {
        assertTrue(AksaraExitDiagnostics.interestingReason(
            android.app.ApplicationExitInfo.REASON_CRASH))
        assertTrue(AksaraExitDiagnostics.interestingReason(
            android.app.ApplicationExitInfo.REASON_CRASH_NATIVE))
        assertTrue(AksaraExitDiagnostics.interestingReason(
            android.app.ApplicationExitInfo.REASON_LOW_MEMORY))
        assertFalse(AksaraExitDiagnostics.interestingReason(
            android.app.ApplicationExitInfo.REASON_EXIT_SELF))
    }

    @Test fun staleIsolatedWorkerIsDetected() {
        assertTrue(AksaraWakeLivenessPolicy.expired(true,1_000L,16_001L))
        assertFalse(AksaraWakeLivenessPolicy.expired(true,1_000L,15_999L))
        assertFalse(AksaraWakeLivenessPolicy.expired(false,1_000L,40_000L))
        assertFalse(AksaraWakeLivenessPolicy.expired(true,0L,40_000L))
    }

    @Test fun microphoneWorkerIsInSeparateAndroidProcess() {
        val manifest=readMainSource("AndroidManifest.xml")
        val service=Regex("""<service\s+android:name="\.feature\.voice\.AksaraWakeWordService"([\s\S]*?)/>""")
            .find(manifest)?.value.orEmpty()
        assertTrue("experimental recognizer must be isolated from Chatbox process",
            service.contains("android:process=\":wakeword\""))
        assertTrue(service.contains("android:exported=\"false\""))
        assertTrue(service.contains("android:foregroundServiceType=\"microphone\""))
    }

    @Test fun statusBridgeUsesBroadcastAndNotCrossProcessSharedFlow() {
        val code=readMainSource("java/my/aksara/nativeapp/feature/voice/AksaraWakeWordService.kt")
        val activity=readMainSource("java/my/aksara/nativeapp/MainActivity.kt")
        assertTrue(code.contains("broadcastStatus(false,activated=true)"))
        assertTrue(code.contains("sendBroadcast(Intent(AksaraAssistantSignals.ACTION_WAKE_STATUS)"))
        assertTrue(activity.contains("ContextCompat.registerReceiver(this,wakeReceiver"))
        assertTrue(activity.contains("AksaraWakeWordStatus.checkHeartbeat()"))
    }
}
