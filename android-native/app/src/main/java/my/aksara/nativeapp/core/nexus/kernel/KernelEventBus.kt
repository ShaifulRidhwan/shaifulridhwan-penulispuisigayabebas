package my.aksara.nativeapp.core.nexus.kernel

import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import java.util.concurrent.atomic.AtomicLong

/** Bounded in-process event bus; no PII, commands, locations or raw model text. */
internal enum class KernelEventType {
    BOOTSTRAPPED, PLAN_PROPOSED, PLAN_APPROVED, TASK_STARTED,
    TASK_FINISHED, TASK_FAILED, TASK_CANCELLED, TASK_INTERRUPTED,
    PROVIDER_UPDATED, RESOURCE_PRESSURE, RECOVERY_AVAILABLE
}
internal data class KernelEvent(
    val id: Long,
    val type: KernelEventType,
    val at: Long,
    val planId: String = "",
    val nodeId: String = "",
    val detail: String = ""
)
internal class KernelEventBus(private val clock: () -> Long = System::currentTimeMillis) {
    private val nextId = AtomicLong()
    private val stream = MutableSharedFlow<KernelEvent>(
        replay = 0, extraBufferCapacity = 128, onBufferOverflow = BufferOverflow.DROP_OLDEST)
    val events = stream.asSharedFlow()
    private val ring = ArrayDeque<KernelEvent>()
    @Synchronized fun publish(
        type: KernelEventType, planId: String = "", nodeId: String = "", detail: String = ""
    ): KernelEvent {
        val event = KernelEvent(nextId.incrementAndGet(), type, clock(),
            planId.take(80), nodeId.take(80), detail.take(100))
        ring.addLast(event)
        while (ring.size > 128) ring.removeFirst()
        stream.tryEmit(event)
        return event
    }
    @Synchronized fun recent(): List<KernelEvent> = ring.toList()
    @Synchronized fun clear() = ring.clear()
}
