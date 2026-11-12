package my.aksara.nativeapp.core.neural

import org.junit.Assert.*
import org.junit.Test

/** State-contract tests only. These do not pretend to execute JNI inference. */
class NeuralActivationStateTest {
    @Test fun installedOrPendingDoesNotEnableInferenceOrLaboratory() {
        val empty = NeuralActivationState()
        assertFalse(empty.canUse(true, false))
        val pending = empty.begin("light")
        assertNull(pending.loadedId)
        assertFalse(pending.canUse(true, false))
    }
    @Test fun successfulNativeConfirmationEnablesBothConsumersOnlyWhenIdle() {
        val active = NeuralActivationState().begin("light").unloaded().confirmed(true)
        assertEquals("light", active.loadedId)
        assertTrue(active.canUse(true, false))
        assertFalse(active.canUse(true, true))
        assertFalse(active.canUse(false, false))
    }
    @Test fun failedNativeLoadCannotBecomeActive() {
        try { NeuralActivationState().begin("light").confirmed(false); fail("Must reject false native status") }
        catch (_: IllegalStateException) { }
        assertNull(NeuralActivationState().begin("light").reconcile(false).loadedId)
    }
    @Test fun unloadCancellationAndRepeatedActivationReconcileWithNativeState() {
        val first = NeuralActivationState().begin("light").confirmed(true)
        val unloading = first.unloaded()
        assertFalse(unloading.canUse(true, false))
        val cancelled = first.begin("balanced").reconcile(false)
        assertNull(cancelled.loadedId)
        assertNull(cancelled.pendingId)
        val second = cancelled.begin("light").confirmed(true)
        assertTrue(second.canUse(true, false))
    }
    @Test fun failedVerificationPreservesAnExistingConfirmedModel() {
        val active = NeuralActivationState().begin("light").confirmed(true)
        val verification = active.begin("balanced")
        assertFalse(verification.canUse(true, false))
        val restored = verification.reconcile(true)
        assertEquals("light", restored.loadedId)
        assertTrue(restored.canUse(true, false))
    }
}
