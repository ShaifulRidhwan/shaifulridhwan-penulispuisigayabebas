package my.aksara.nativeapp.feature.voice

import org.junit.Assert.assertEquals
import org.junit.Test

class AksaraWakePermissionPolicyTest {
    @Test fun missingMicMustBlockRecording() {
        assertEquals(AksaraWakeReadiness.MIC_REQUIRED,
            AksaraWakePermissionPolicy.evaluate(false,false))
        assertEquals(AksaraWakeReadiness.MIC_REQUIRED,
            AksaraWakePermissionPolicy.evaluate(false,true))
    }

    @Test fun deniedNotificationsNeverBlockForegroundWakeWord() {
        assertEquals(AksaraWakeReadiness.READY_WITHOUT_NOTIFICATIONS,
            AksaraWakePermissionPolicy.evaluate(true,false))
        assertEquals(AksaraWakeReadiness.READY,
            AksaraWakePermissionPolicy.evaluate(true,true))
    }
}
