package my.aksara.nativeapp.core.nexus.kernel

import android.app.ActivityManager
import android.content.Context
import android.os.PowerManager
import java.util.concurrent.atomic.AtomicLong

/**
 * Adaptive admission control uses app-visible Android signals, not fake CPU figures.
 * Parallelism is reduced under low RAM / battery saver. 1..2 tasks, never unlimited.
 */
internal data class KernelResources(
    val parallelism: Int, val lowMemory: Boolean, val powerSave: Boolean,
    val availableRamMb: Long, val processHeapMb: Long
)
internal object KernelResourceGovernor {
    fun snapshot(context: Context): KernelResources {
        val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
        val details = ActivityManager.MemoryInfo()
        runCatching { manager?.getMemoryInfo(details) }
        val power = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        val saver = runCatching { power?.isPowerSaveMode == true }.getOrDefault(false)
        val lowRam = details.lowMemory ||
            (details.availMem > 0 && details.availMem < 512L * 1024L * 1024L)
        val heapMb = (Runtime.getRuntime().totalMemory() -
            Runtime.getRuntime().freeMemory()).coerceAtLeast(0L) / 1_048_576L
        return KernelResources(
            if (lowRam || saver) 1 else 2,
            lowRam, saver, details.availMem.coerceAtLeast(0L) / 1_048_576L,
            heapMb)
    }
}

internal data class KernelTelemetrySnapshot(
    val executions: Long, val success: Long, val failures: Long,
    val cancellations: Long, val totalDurationMs: Long,
    val maxDurationMs: Long, val lastParallelism: Int,
    val lastAvailableRamMb: Long
)
internal class KernelTelemetry {
    private val executions = AtomicLong()
    private val success = AtomicLong()
    private val failures = AtomicLong()
    private val cancellations = AtomicLong()
    private val totalMs = AtomicLong()
    private val maxMs = AtomicLong()
    @Volatile private var parallel = 1
    @Volatile private var ramMb = 0L

    fun configure(resources: KernelResources) {
        parallel = resources.parallelism
        ramMb = resources.availableRamMb
    }
    fun record(durationMs: Long, outcome: KernelStatus?) {
        executions.incrementAndGet()
        when (outcome) {
            KernelStatus.COMPLETED -> success.incrementAndGet()
            KernelStatus.FAILED, KernelStatus.SKIPPED -> failures.incrementAndGet()
            else -> cancellations.incrementAndGet()
        }
        totalMs.addAndGet(durationMs.coerceAtLeast(0L))
        maxMs.accumulateAndGet(durationMs.coerceAtLeast(0L), java.lang.Long::max)
    }
    fun snapshot(): KernelTelemetrySnapshot = KernelTelemetrySnapshot(
        executions.get(), success.get(), failures.get(), cancellations.get(),
        totalMs.get(), maxMs.get(), parallel, ramMb)
}

/** Backend owns multi-model routing; Nexus never fabricates a provider fallback. */
internal data class KernelProviderHealth(
    val available: Boolean, val sources: List<String>, val status: String
)
internal object KernelProviderPolicy {
    fun assess(statuses: List<Pair<String, String>>): KernelProviderHealth {
        val online = statuses.filter { (_, state) ->
            val normalized = state.lowercase(java.util.Locale.ROOT)
            (normalized.contains("online") || normalized.contains("connected") ||
                normalized.contains("ready")) &&
                !normalized.contains("offline") && !normalized.contains("disconnected") &&
                !normalized.contains("unavailable")
        }.map { it.first.take(40) }
        return KernelProviderHealth(online.isNotEmpty(), online.take(5),
            if (online.isEmpty()) "Provider tidak disahkan tersedia"
            else "Backend owns provider selection; healthy snapshots: " + online.joinToString(", "))
    }
}
