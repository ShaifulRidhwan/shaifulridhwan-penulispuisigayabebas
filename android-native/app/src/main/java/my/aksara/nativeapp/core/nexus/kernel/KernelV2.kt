package my.aksara.nativeapp.core.nexus.kernel

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import java.util.Locale
import java.util.UUID

/**
 * ANK V2: typed capability-based application kernel.
 * A planned action is NEVER an arbitrary shell command.
 */
internal enum class KernelRisk { READ, WRITE_LOCAL, WRITE_REMOTE }
internal enum class KernelStatus { RUNNING, COMPLETED, FAILED, SKIPPED }

internal data class KernelCapability(
    val id: String, val source: String, val risk: KernelRisk = KernelRisk.READ
) {
    init {
        require(id.matches(Regex("[a-z][a-z0-9.-]{2,64}")))
        require(source.isNotBlank())
    }
}

internal class KernelRegistry(initial: List<KernelCapability> = emptyList()) {
    private val capabilities = linkedMapOf<String, KernelCapability>()
    init { initial.forEach(::register) }
    @Synchronized fun register(item: KernelCapability) {
        require(capabilities.putIfAbsent(item.id, item) == null) { "Duplicate capability: " + item.id }
    }
    @Synchronized fun get(id: String): KernelCapability? = capabilities[id]
    @Synchronized fun inventory(): List<KernelCapability> = capabilities.values.toList()
}

internal data class KernelNode(val id: String, val capability: String, val dependsOn: Set<String> = emptySet())
internal data class KernelPlan(val id: String, val goal: String, val nodes: List<KernelNode>, val createdAt: Long)
internal data class KernelApproval(
    val planId: String, val allowedCapabilities: Set<String>, val grantedAt: Long, val expiresAt: Long,
    val fingerprint: String
)
internal data class KernelEvidence(
    val capability: String, val source: String, val output: String, val exitCode: Int,
    val observedAt: Long, val facts: Map<String, String> = emptyMap()
)
internal data class KernelStepResult(
    val nodeId: String, val status: KernelStatus, val evidence: KernelEvidence? = null,
    val error: String? = null
)
internal data class KernelWorkflowResult(val planId: String, val steps: List<KernelStepResult>) {
    val passed: Boolean get() = steps.isNotEmpty() && steps.all { it.status == KernelStatus.COMPLETED }
}
internal data class KernelTransition(val planId: String, val nodeId: String, val status: KernelStatus)

/**
 * Deterministic first-stage planner. Future LLM-produced plans must go through
 * this same registry validation and user approval before they can execute.
 */
internal object KernelPlanner {
    fun propose(goal: String, registry: KernelRegistry): KernelPlan? {
        if (goal.isBlank() || goal.length > 2000) return null
        val text = goal.lowercase(Locale.ROOT)
        val selected = linkedSetOf<String>()
        val all = listOf("audit penuh", "full audit", "nexus kernel", "semua sistem")
            .any(text::contains)
        val linux = listOf("linux", "alpine", "kernel", "sistem").any(text::contains)
        val tools = listOf("compiler", "toolchain", "python", "node", "gcc", "clang").any(text::contains)
        val git = listOf("git", "github", "repo", "commit").any(text::contains)
        val today = listOf("today", "dashboard", "cuaca").any(text::contains)
        val ai = listOf("gemini", "groq", "provider", "multi a.i.", "multi ai").any(text::contains)
        if (all || linux) selected.add("linux.health")
        if (all || tools) selected.add("linux.devkit")
        if (all || git) {
            selected.add("linux.git")
            selected.add("today.github")
        }
        if (listOf("workspace", "folder", "direktori", "files", "fail").any(text::contains))
            selected.add("linux.workspace")
        if (all || today) selected.add("today.snapshot")
        if (all || ai) selected.add("ai.health")
        if (selected.isEmpty()) return null
        if (!selected.all { registry.get(it)?.risk == KernelRisk.READ }) return null
        val tasks = selected.mapIndexed { i, key -> KernelNode("step-" + i, key) }
        val summary = KernelNode("evidence", "kernel.evidence", tasks.map { it.id }.toSet())
        return KernelPlan(UUID.randomUUID().toString(), goal.take(200), tasks + summary,
            System.currentTimeMillis()).also { validate(it, registry) }
    }

    fun validate(plan: KernelPlan, registry: KernelRegistry) {
        require(plan.id.isNotBlank() && plan.goal.isNotBlank())
        require(plan.nodes.isNotEmpty() && plan.nodes.size <= 24)
        val ids = plan.nodes.map { it.id }
        require(ids.toSet().size == ids.size)
        require(ids.all { it.matches(Regex("[a-zA-Z][a-zA-Z0-9-]{0,80}")) })
        require(plan.nodes.all { registry.get(it.capability) != null && it.id !in it.dependsOn &&
            ids.containsAll(it.dependsOn) })
        val visiting = mutableSetOf<String>()
        val visited = mutableSetOf<String>()
        val graph = plan.nodes.associate { it.id to it.dependsOn }
        fun visit(id: String) {
            if (id in visited) return
            require(visiting.add(id)) { "Cyclic dependency" }
            graph.getValue(id).forEach(::visit)
            visiting.remove(id)
            visited.add(id)
        }
        ids.forEach(::visit)
    }
}

/** A model cannot silently expand authority granted to a different plan. */
internal object KernelPolicy {
    private fun fingerprint(plan: KernelPlan): String {
        val canonical = plan.id + "\n" + plan.nodes.joinToString("\n") { node ->
            node.id + ":" + node.capability + ":" + node.dependsOn.sorted().joinToString(",")
        }
        return java.security.MessageDigest.getInstance("SHA-256")
            .digest(canonical.toByteArray(Charsets.UTF_8))
            .joinToString("") { byte -> "%02x".format(byte) }
    }
    fun approveReadOnly(plan: KernelPlan, registry: KernelRegistry, now: Long): KernelApproval {
        KernelPlanner.validate(plan, registry)
        require(plan.nodes.all { registry.get(it.capability)?.risk == KernelRisk.READ })
        return KernelApproval(plan.id, plan.nodes.map { it.capability }.toSet(),
            now, now + 120_000L, fingerprint(plan))
    }
    fun permits(plan: KernelPlan, approval: KernelApproval, registry: KernelRegistry, now: Long): Boolean {
        return plan.id == approval.planId && fingerprint(plan) == approval.fingerprint &&
            now >= approval.grantedAt && now < approval.expiresAt &&
            plan.nodes.all {
                it.capability in approval.allowedCapabilities &&
                    registry.get(it.capability)?.risk == KernelRisk.READ
            }
    }
}

/** DAG scheduler: two independent steps at a time; failed prerequisites skip their children. */
internal class KernelScheduler(
    private val registry: KernelRegistry, private val maxParallel: Int = 2,
    private val now: () -> Long = System::currentTimeMillis,
    private val parallelismProvider: (() -> Int)? = null
) {
    init { require(maxParallel in 1..4) }

    suspend fun run(
        plan: KernelPlan, approval: KernelApproval,
        execute: suspend (KernelNode, Map<String, KernelEvidence>) -> KernelEvidence,
        onTransition: (KernelTransition) -> Unit = {}
    ): KernelWorkflowResult = coroutineScope {
        KernelPlanner.validate(plan, registry)
        require(KernelPolicy.permits(plan, approval, registry, now())) {
            "Approval invalid, expired, or insufficient"
        }
        val remaining = plan.nodes.associateBy { it.id }.toMutableMap()
        val finished = linkedMapOf<String, KernelStepResult>()
        while (remaining.isNotEmpty()) {
            val ready = remaining.values.filter { it.dependsOn.all(finished::containsKey) }
            check(ready.isNotEmpty()) { "Unresolvable workflow" }
            ready.filter { node ->
                node.dependsOn.any { finished[it]?.status != KernelStatus.COMPLETED }
            }.forEach { node ->
                finished[node.id] = KernelStepResult(node.id, KernelStatus.SKIPPED,
                    error = "Prerequisite failed")
                remaining.remove(node.id)
                onTransition(KernelTransition(plan.id, node.id, KernelStatus.SKIPPED))
            }
            ready.filter { it.id in remaining }
                .chunked((parallelismProvider?.invoke() ?: maxParallel).coerceIn(1, maxParallel))
                .forEach { batch ->
                val prior = finished.mapNotNull { (key, value) ->
                    value.evidence?.let { key to it }
                }.toMap()
                val jobs = batch.map { node ->
                    onTransition(KernelTransition(plan.id, node.id, KernelStatus.RUNNING))
                    async {
                        try {
                            val evidence = execute(node, prior)
                            KernelStepResult(node.id,
                                if (evidence.exitCode == 0) KernelStatus.COMPLETED else KernelStatus.FAILED,
                                evidence, if (evidence.exitCode == 0) null else "Exit " + evidence.exitCode)
                        } catch (cancel: CancellationException) {
                            throw cancel
                        } catch (error: Exception) {
                            KernelStepResult(node.id, KernelStatus.FAILED,
                                error = error.message?.take(160) ?: "Failed")
                        }
                    }
                }
                jobs.awaitAll().forEach { result ->
                    finished[result.nodeId] = result
                    remaining.remove(result.nodeId)
                    onTransition(KernelTransition(plan.id, result.nodeId, result.status))
                }
            }
        }
        KernelWorkflowResult(plan.id, plan.nodes.map { finished.getValue(it.id) })
    }
}

/** The context graph is ephemeral. It is not Aksara's user-memory feature. */
internal data class KernelFact(
    val key: String, val value: String, val source: String, val planId: String,
    val timestamp: Long, val expiresAt: Long
)
internal class KernelContextGraph(private val now: () -> Long = System::currentTimeMillis) {
    private val data = linkedMapOf<String, KernelFact>()

    @Synchronized fun ingest(planId: String, evidence: KernelEvidence, ttlMs: Long = 180_000L) {
        require(ttlMs in 1L..86_400_000L)
        val expiry = now() + ttlMs
        evidence.facts.forEach { (key, value) ->
            if (key.matches(Regex("[a-z0-9._-]{2,64}")) && value.length <= 300)
                data[key] = KernelFact(key, value, evidence.source, planId, evidence.observedAt, expiry)
        }
        data.keys.filter { data.getValue(it).expiresAt <= now() }.toList().forEach(data::remove)
        while (data.size > 96) data.remove(data.keys.first())
    }

    @Synchronized fun facts(): List<KernelFact> =
        data.values.filter { it.expiresAt > now() }
    @Synchronized fun clear() { data.clear() }
}

/** Explicit Node.js interpretation fixes P9's v22.x.y -> "editor" mistake. */
internal object KernelEvidenceParser {
    fun parse(capability: String, output: String): Map<String, String> {
        val facts = linkedMapOf<String, String>()
        if (capability == "linux.devkit") {
            val patterns = mapOf(
                "python.version" to Regex("""Python\s+(\d+\.\d+\.\d+)"""),
                "git.version" to Regex("""git version\s+(\d+\.\d+\.\d+)"""),
                "nodejs.version" to Regex("""(?m)^v(\d+\.\d+\.\d+)\s*$"""),
                "gcc.version" to Regex("""gcc[^\n]*?(\d+\.\d+\.\d+)"""),
                "clang.version" to Regex("""clang version\s+(\d+\.\d+\.\d+)""")
            )
            patterns.forEach { (key, regex) ->
                regex.find(output)?.groupValues?.getOrNull(1)?.let { facts[key] = it }
            }
        }
        if (capability == "linux.git") {
            facts["git.workspace.repository"] =
                if ("not a git repository" in output || "Tiada repositori Git" in output) "absent" else "present"
        }
        if (capability == "linux.health") {
            Regex("""(?m)^Linux\s+\S+\s+(\S+)""")
                .find(output)?.groupValues?.getOrNull(1)?.let { facts["linux.kernel"] = it }
        }
        return facts
    }

    fun summarize(evidence: Collection<KernelEvidence>): String = buildString {
        append("AKSARA NEXUS VERIFIED EVIDENCE\n")
        evidence.forEach { row ->
            append("CAPABILITY: ").append(row.capability).append('\n')
            append("SOURCE: ").append(row.source).append('\n')
            append("EXIT CODE: ").append(row.exitCode).append('\n')
            row.facts.forEach { (key, value) -> append(key).append(" = ").append(value).append('\n') }
            append('\n')
        }
        append("Exit 0 can include an earlier failed subcommand. Check raw diagnostic evidence.")
    }.take(12_000)
}

internal object KernelDefaults {
    fun registry() = KernelRegistry(listOf(
        KernelCapability("linux.health", "alpine-proot"),
        KernelCapability("linux.devkit", "alpine-proot"),
        KernelCapability("linux.git", "alpine-proot"),
        KernelCapability("linux.workspace", "alpine-proot"),
        KernelCapability("linux.workspace.write", "alpine-workspace", KernelRisk.WRITE_LOCAL),
        KernelCapability("today.github", "today-github-repository"),
        KernelCapability("today.snapshot", "today-repository"),
        KernelCapability("ai.health", "chat-provider-state"),
        KernelCapability("kernel.evidence", "nexus-local"),
        KernelCapability("linux.probe", "alpine-proot")
    ))
}
