package my.aksara.nativeapp.core.nexus.kernel

import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class KernelSystemTest {
    private val registry = KernelDefaults.registry()

    @Test fun eventBusIsBoundedAndOrdered() {
        val bus = KernelEventBus { 42 }
        repeat(200) { bus.publish(KernelEventType.TASK_STARTED, "test", it.toString()) }
        assertEquals(128, bus.recent().size)
        assertEquals(73L, bus.recent().first().id)
        assertEquals(200L, bus.recent().last().id)
        assertEquals("test", bus.recent().last().planId)
    }

    @Test fun modelPlanJsonCannotInjectShellOrUnauthorizedCapabilities() {
        val good = KernelModelPlanCodec.decode("semak python dan today",
            """{"capabilities":["linux.devkit","today.snapshot"]}""", registry)
        assertEquals(3, good.nodes.size)
        assertEquals("kernel.evidence", good.nodes.last().capability)
        assertThrows(IllegalStateException::class.java) {
            KernelModelPlanCodec.decode("test",
                """{"capabilities":["linux.devkit; rm -rf /"]}""", registry)
        }
        assertThrows(IllegalArgumentException::class.java) {
            KernelModelPlanCodec.decode("test",
                """{"capabilities":["linux.probe"]}""", registry)
        }
        assertThrows(IllegalArgumentException::class.java) {
            KernelModelPlanCodec.decode("test",
                """{"capabilities":["linux.health","linux.health"]}""", registry)
        }
    }

    @Test fun writesFailClosedEvenWhenPreviewProvided() {
        val write = KernelCapability("linux.write", "alpine-proot", KernelRisk.WRITE_LOCAL)
        val preview = KernelChangePreview(write.id, "/workspace/file", "Modify", "abc")
        assertFalse(KernelTransactionPolicy.mayExecuteWrite(write, preview))
        assertFalse(KernelTransactionPolicy.mayExecuteWrite(write, null))
    }

    @Test fun telemetryCountsEventsWithoutRawContent() {
        val metrics = KernelTelemetry()
        metrics.configure(KernelResources(1, true, false, 250, 80))
        metrics.record(85, KernelStatus.COMPLETED)
        metrics.record(12, KernelStatus.FAILED)
        metrics.record(100, null)
        val snap = metrics.snapshot()
        assertEquals(3L, snap.executions)
        assertEquals(1L, snap.success)
        assertEquals(1L, snap.failures)
        assertEquals(1L, snap.cancellations)
        assertEquals(197L, snap.totalDurationMs)
        assertEquals(100L, snap.maxDurationMs)
        assertEquals(1, snap.lastParallelism)
    }

    @Test fun schedulerRespectsDependencyAndFailureBoundaries() = runBlocking {
        val plan = KernelPlan("id", "goal", listOf(
            KernelNode("a", "linux.health"),
            KernelNode("b", "ai.health"),
            KernelNode("c", "kernel.evidence", setOf("a", "b"))), 10)
        val approval = KernelPolicy.approveReadOnly(plan, registry, 100)
        val calls = mutableListOf<String>()
        val outcome = KernelScheduler(registry, maxParallel = 2, now = { 101 }).run(
            plan, approval, execute = { node, previous ->
                synchronized(calls) { calls.add(node.id) }
                if (node.id == "c") assertEquals(2, previous.size)
                KernelEvidence(node.capability, "mock", node.id, 0, 101)
            })
        assertTrue(outcome.passed)
        assertEquals(listOf("a","b","c"), calls.sortedBy { it })
    }
}
