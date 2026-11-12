package my.aksara.nativeapp.core.neural

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import android.os.StatFs
import java.io.File
import java.security.MessageDigest

/**
 * PR #321 capability and model-install contracts.
 * Memory snapshots and engineering estimates never imply a successful native load.
 */
data class NeuralDeviceSnapshot(
    val totalRamBytes: Long,
    val availableRamBytes: Long,
    val lowMemory: Boolean,
    val supportedAbis: List<String>,
    val availableStorageBytes: Long,
    val sdkInt: Int,
    val thermalStatus: Int = 0,
    val lowMemoryThresholdBytes: Long = 0,
    val javaHeapUsedBytes: Long = 0,
    val javaHeapMaxBytes: Long = 0,
    val nativeHeapAllocatedBytes: Long = 0,
    val processPssBytes: Long = 0
)

object NeuralDeviceCapabilityProbe {
    fun inspect(context: Context): NeuralDeviceSnapshot {
        val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val info = ActivityManager.MemoryInfo()
        manager.getMemoryInfo(info)
        val storage = StatFs(context.filesDir.absolutePath)
        return NeuralDeviceSnapshot(
            totalRamBytes = info.totalMem,
            availableRamBytes = info.availMem,
            lowMemory = info.lowMemory,
            supportedAbis = Build.SUPPORTED_ABIS.toList(),
            availableStorageBytes = storage.availableBytes,
            sdkInt = Build.VERSION.SDK_INT,
            thermalStatus = (context.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager).currentThermalStatus,
            lowMemoryThresholdBytes = info.threshold,
            javaHeapUsedBytes = Runtime.getRuntime().let { it.totalMemory() - it.freeMemory() },
            javaHeapMaxBytes = Runtime.getRuntime().maxMemory(),
            nativeHeapAllocatedBytes = android.os.Debug.getNativeHeapAllocatedSize(),
            processPssBytes = android.os.Debug.getPss() * 1024

        )
    }
}

data class NeuralModelDescriptor(
    val id: String,
    val runtime: String,
    val sha256: String,
    val minAvailableRamBytes: Long,
    val license: String,
    val downloadUrl: String,
    val sizeBytes: Long = 0L,
    val name: String = id,
    val parameters: String = "",
    val quantization: String = "",
    val sourceRevision: String = ""
) {
    fun validate(): Boolean =
        id.matches(Regex("[a-zA-Z0-9._-]{1,100}")) &&
        sha256.matches(Regex("[0-9a-fA-F]{64}")) &&
        downloadUrl.startsWith("https://") &&
        license.isNotBlank() && minAvailableRamBytes > 0L &&
        runtime in setOf("llama.cpp", "litert-lm")
}

sealed interface NeuralInferenceEvent {
    data class Token(val text: String) : NeuralInferenceEvent
    data class Failure(val reason: String) : NeuralInferenceEvent
    data object Completed : NeuralInferenceEvent
}

interface NeuralRuntime {
    val isLoaded: Boolean
    suspend fun load(model: File): Result<Unit>
    suspend fun generate(prompt: String, onEvent: (NeuralInferenceEvent) -> Unit)
    fun cancel()
    suspend fun unload()
}

/** Explicitly unavailable until a verified native runtime is integrated. */
class UnavailableNeuralRuntime : NeuralRuntime {
    override val isLoaded: Boolean = false
    override suspend fun load(model: File): Result<Unit> =
        Result.failure(IllegalStateException("Native inference runtime is not installed"))
    override suspend fun generate(prompt: String, onEvent: (NeuralInferenceEvent) -> Unit) {
        onEvent(NeuralInferenceEvent.Failure("On-device model runtime unavailable"))
    }
    override fun cancel() = Unit
    override suspend fun unload() = Unit
}

object NeuralModelIntegrity {
    fun verifySha256(file: File, expectedHex: String, checkpoint: () -> Unit = {}): Boolean {
        if (!expectedHex.matches(Regex("[0-9a-fA-F]{64}")) || !file.isFile) return false
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().buffered().use { stream ->
            val buffer = ByteArray(64 * 1024)
            while (true) {
                checkpoint()
                val n = stream.read(buffer)
                if (n < 0) break
                digest.update(buffer, 0, n)
            }
        }
        val actual = digest.digest().joinToString("") { "%02x".format(it) }
        return MessageDigest.isEqual(
            actual.lowercase().toByteArray(Charsets.US_ASCII),
            expectedHex.lowercase().toByteArray(Charsets.US_ASCII)
        )
    }
}

/** Compatibility callers receive only safety failures; warnings permit an explicit attempt. */
fun NeuralDeviceSnapshot.loadingIssue(model: NeuralModelDescriptor): String? =
    NeuralMemoryPolicy.assess(this, model, 2048).hardFailure
