package my.aksara.nativeapp.core.nexus.kernel

import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class KernelV2Test {
    private val registry = KernelDefaults.registry()

    @Test fun plannerReturnsTypedMultiModuleDag() {
        val plan = requireNotNull(KernelPlanner.propose("audit penuh Linux dan A.I.", registry))
        assertTrue(plan.nodes.any { it.capability == "linux.health" })
        assertTrue(plan.nodes.any { it.capability == "linux.devkit" })
        assertTrue(plan.nodes.any { it.capability == "today.snapshot" })
        assertTrue(plan.nodes.any { it.capability == "ai.health" })
        assertEquals("kernel.evidence", plan.nodes.last().capability)
        assertEquals(plan.nodes.dropLast(1).map { it.id }.toSet(), plan.nodes.last().dependsOn)
        assertNull(KernelPlanner.propose("rm -rf /", registry))
        assertNull(KernelPlanner.propose("", registry))
    }

    @Test fun noUnknownToolOrCyclicDependency() {
        assertThrows(IllegalArgumentException::class.java) {
            KernelPlanner.validate(KernelPlan("id", "test",
                listOf(KernelNode("x", "linux.unknown")), 10), registry)
        }
        assertThrows(IllegalArgumentException::class.java) {
            KernelPlanner.validate(KernelPlan("id", "test",
                listOf(
                    KernelNode("a", "linux.health", setOf("b")),
                    KernelNode("b", "ai.health", setOf("a"))
                ), 10), registry)
        }
        assertThrows(IllegalArgumentException::class.java) {
            KernelRegistry(listOf(
                KernelCapability("linux.health", "test"),
                KernelCapability("linux.health", "test2")
            ))
        }
    }

    @Test fun approvalIsPlanBoundTimeBoundAndReadOnly() {
        val plan = requireNotNull(KernelPlanner.propose("linux", registry))
        val approval = KernelPolicy.approveReadOnly(plan, registry, 100)
        assertTrue(KernelPolicy.permits(plan, approval, registry, 101))
        assertFalse(KernelPolicy.permits(plan.copy(id = "forged"), approval, registry, 101))
        assertFalse(KernelPolicy.permits(plan, approval, registry, 120_100))
        registry.register(KernelCapability("linux.write", "sandbox", KernelRisk.WRITE_LOCAL))
        val write = KernelPlan("write", "write",
            listOf(KernelNode("w", "linux.write")), 1)
        assertThrows(IllegalArgumentException::class.java) {
            KernelPolicy.approveReadOnly(write, registry, 100)
        }
    }

    @Test fun schedulerSkipsDependentEvidenceIfLinuxStepFails() = runBlocking {
        val plan = KernelPlan("p", "test", listOf(
            KernelNode("linux", "linux.health"),
            KernelNode("ai", "ai.health"),
            KernelNode("summary", "kernel.evidence", setOf("linux", "ai"))), 100)
        val approval = KernelPolicy.approveReadOnly(plan, registry, 100)
        val invoked = mutableListOf<String>()
        val result = KernelScheduler(registry, now = { 101 }).run(
            plan, approval,
            execute = { node, _ ->
                synchronized(invoked) { invoked.add(node.id) }
                KernelEvidence(node.capability, "test", "", if (node.id == "linux") 1 else 0, 101)
            })
        assertTrue("linux" in invoked)
        assertTrue("ai" in invoked)
        assertFalse("summary" in invoked)
        assertEquals(KernelStatus.SKIPPED, result.steps.last().status)
        assertFalse(result.passed)
    }

    @Test fun schedulerConsolidatesIndependentEvidence() = runBlocking {
        val plan = KernelPlan("p", "test", listOf(
            KernelNode("linux", "linux.health"),
            KernelNode("today", "today.snapshot"),
            KernelNode("summary", "kernel.evidence", setOf("linux", "today"))), 100)
        val approval = KernelPolicy.approveReadOnly(plan, registry, 100)
        val result = KernelScheduler(registry, now = { 101 }).run(plan, approval,
            execute = { node, prior ->
                if (node.id == "summary") assertEquals(2, prior.size)
                KernelEvidence(node.capability, "test", node.id, 0, 101)
            })
        assertTrue(result.passed)
        assertEquals(3, result.steps.count { it.status == KernelStatus.COMPLETED })
    }

    @Test fun typedFactsPreventNodeJsMisidentification() {
        val result = KernelEvidenceParser.parse(
            "linux.devkit",
            "Python 3.12.16\ngit version 2.49.1\nv22.23.5\ngcc (Alpine) 14.2.0\nclang version 20.1.8")
        assertEquals("22.23.5", result["nodejs.version"])
        assertEquals("3.12.16", result["python.version"])
        val context = KernelContextGraph(now = { 200 })
        context.ingest("plan-a", KernelEvidence("linux.devkit", "alpine-proot",
            "v22.23.5", 0, 200, result), ttlMs = 50)
        assertEquals("plan-a", context.facts().first { it.key == "nodejs.version" }.planId)
        assertEquals("alpine-proot", context.facts().first().source)
    }
}
