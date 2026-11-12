package my.aksara.nativeapp.core.neural

import org.junit.Assert.*
import org.junit.Test

class NeuralMemoryPolicyTest {
    private val mib = 1024L * 1024
    private val light = NeuralModelCatalog.entries.first().model!!
    private fun device(available: Long = 1800 * mib) = NeuralDeviceSnapshot(
        totalRamBytes = 6_000_000_000L, availableRamBytes = available, lowMemory = false,
        supportedAbis = listOf("arm64-v8a"), availableStorageBytes = 10_000_000_000, sdkInt = 35,
        lowMemoryThresholdBytes = 216 * mib, javaHeapMaxBytes = 256 * mib)

    @Test fun sixGbPhoneCanExplicitlyTryLightBelowOldThreeGibGate() {
        val result = NeuralMemoryPolicy.assess(device(), light, 1024)
        assertTrue(result.canAttempt)
        assertNotNull(result.warning)
        assertEquals(1024, result.contextSize)
        assertEquals(112 * mib, result.kvCacheBytes)
        assertEquals(384 * mib, result.reserveBytes)
        assertTrue(result.minimumAvailableBytes < device().availableRamBytes)
        assertTrue(device().availableRamBytes < result.recommendedAvailableBytes)
    }
    @Test fun pressureAndThresholdRemainHardFailures() {
        assertFalse(NeuralMemoryPolicy.assess(device().copy(lowMemory = true), light, 1024).canAttempt)
        assertFalse(NeuralMemoryPolicy.assess(device(216 * mib), light, 1024).canAttempt)
        val highThreshold = device().copy(lowMemoryThresholdBytes = 1200 * mib)
        assertFalse(NeuralMemoryPolicy.assess(highThreshold, light, 1024).canAttempt)
    }
    @Test fun minimumBoundaryIsEnforcedWithoutRecommendingTheSameModelAsAnAlternative() {
        val estimate = NeuralMemoryPolicy.assess(device(), light, 1024)
        val blocked = NeuralMemoryPolicy.assess(device(estimate.minimumAvailableBytes - 1), light, 1024)
        assertFalse(blocked.canAttempt)
        assertFalse(blocked.hardFailure!!.contains("try Light or Balanced"))
        assertFalse(blocked.hardFailure.orEmpty().contains("Pilih Light"))
        assertTrue(NeuralMemoryPolicy.assess(device(estimate.minimumAvailableBytes), light, 1024).canAttempt)
    }
    @Test fun virtualRamIsNotAddedAndTotalRamIsNotAvailableRam() {
        val occupiedPhone = device(900 * mib).copy(totalRamBytes = 12_000_000_000L)
        assertFalse(NeuralMemoryPolicy.assess(occupiedPhone, light, 1024).canAttempt)
        assertFalse(NeuralMemoryPolicy.assess(device().copy(availableRamBytes = 7_000_000_000L), light, 1024).canAttempt)
        // A small ART heap cap cannot disqualify native mmap-backed inference.
        assertTrue(NeuralMemoryPolicy.assess(device().copy(javaHeapMaxBytes = 64 * mib), light, 1024).canAttempt)
    }
    @Test fun unsupportedAbiAndThermalPressureBlockLight() {
        assertFalse(NeuralMemoryPolicy.assess(device().copy(supportedAbis = listOf("x86_64")), light, 1024).canAttempt)
        assertFalse(NeuralMemoryPolicy.assess(device().copy(thermalStatus = 3), light, 1024).canAttempt)
    }
    @Test fun largerModelsRequireTheirEstimatedWorkingSet() {
        val balanced = NeuralModelCatalog.entries[1].model!!
        val advanced = NeuralModelCatalog.entries[2].model!!
        assertFalse(NeuralMemoryPolicy.assess(device(), balanced, 2048).canAttempt)
        assertFalse(NeuralMemoryPolicy.assess(device(6L shl 30).copy(totalRamBytes = 8L shl 30), advanced, 2048).canAttempt)
        assertTrue(NeuralMemoryPolicy.assess(device(10L shl 30).copy(totalRamBytes = 16L shl 30), advanced, 2048).canAttempt)
    }

    @Test fun requestedContextIsRespectedAndActualMemoryDeterminesEligibility() {
        val small = NeuralMemoryPolicy.assess(device(), light, 1024)
        val large = NeuralMemoryPolicy.assess(device(), light, 2048)
        assertEquals(2048, large.contextSize)
        assertEquals(small.kvCacheBytes * 2, large.kvCacheBytes)
        val limited = device(small.minimumAvailableBytes)
        assertTrue(NeuralMemoryPolicy.assess(limited, light, 1024).canAttempt)
        assertFalse(NeuralMemoryPolicy.assess(limited, light, 2048).canAttempt)
        val advanced = NeuralModelCatalog.entries[2].model!!
        // No fixed 10 GiB total-RAM lock when the actual available working set fits.
        val roomy = device(7L shl 30).copy(totalRamBytes = 8L shl 30)
        assertTrue(NeuralMemoryPolicy.assess(roomy, advanced, 1024).canAttempt)
    }
    @Test fun smallerQuantizationHasSameKvButSmallerWeightEstimate() {
        val q8 = NeuralMemoryPolicy.assess(device(), light, 1024)
        val q4 = NeuralMemoryPolicy.assess(device(), NeuralModelCatalog.entries.last().model!!, 1024)
        assertEquals(q8.kvCacheBytes, q4.kvCacheBytes)
        assertEquals(q8.modelBytes - q4.modelBytes, q8.minimumAvailableBytes - q4.minimumAvailableBytes)
    }
}
