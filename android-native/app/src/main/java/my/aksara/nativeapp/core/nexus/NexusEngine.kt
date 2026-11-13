package my.aksara.nativeapp.core.nexus

import android.content.Context
import android.system.Os
import my.aksara.nativeapp.core.linux.AksaraLinuxRuntime
import my.aksara.nativeapp.core.nexus.kernel.KernelApproval
import my.aksara.nativeapp.core.nexus.kernel.KernelContextGraph
import my.aksara.nativeapp.core.nexus.kernel.KernelCheckpointStore
import my.aksara.nativeapp.core.nexus.kernel.KernelDefaults
import my.aksara.nativeapp.core.nexus.kernel.KernelEvidence
import my.aksara.nativeapp.core.nexus.kernel.KernelEvidenceParser
import my.aksara.nativeapp.core.nexus.kernel.KernelPlan
import my.aksara.nativeapp.core.nexus.kernel.KernelPlanner
import my.aksara.nativeapp.core.nexus.kernel.KernelRegistry
import my.aksara.nativeapp.core.nexus.kernel.KernelScheduler
import my.aksara.nativeapp.core.nexus.kernel.KernelNode
import my.aksara.nativeapp.core.nexus.kernel.KernelTransition
import my.aksara.nativeapp.core.nexus.kernel.KernelStatus
import my.aksara.nativeapp.core.nexus.kernel.KernelPolicy
import my.aksara.nativeapp.core.nexus.kernel.KernelWorkspaceTransactions
import my.aksara.nativeapp.core.nexus.kernel.KernelAiEditPlanner
import my.aksara.nativeapp.core.nexus.kernel.KernelChangePreview
import my.aksara.nativeapp.core.nexus.kernel.KernelTransactionReceipt
import my.aksara.nativeapp.core.nexus.kernel.KernelWriteOperation
import kotlinx.coroutines.withContext
import my.aksara.nativeapp.core.nexus.kernel.KernelAiPlanner
import my.aksara.nativeapp.core.nexus.kernel.KernelEventBus
import my.aksara.nativeapp.core.nexus.kernel.KernelEventType
import my.aksara.nativeapp.core.nexus.kernel.KernelResourceGovernor
import my.aksara.nativeapp.core.nexus.kernel.KernelTelemetry
import my.aksara.nativeapp.core.nexus.kernel.KernelProviderPolicy
import my.aksara.nativeapp.core.nexus.kernel.KernelPlanStore
import android.os.SystemClock
import my.aksara.nativeapp.feature.today.TodayRepository
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.cancel
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.UUID
import java.util.concurrent.TimeUnit
import kotlin.coroutines.coroutineContext

/**
 * Nexus V1 is a local capability broker, NOT a second shell or LLM.
 * All Linux actions are compile-time fixed, read-only commands. Chat text can
 * never be interpolated into shell arguments. Android and Alpine are still sandboxed.
 */
internal data class NexusAction(
    val id: String,
    val title: String,
    val description: String,
    val steps: List<Pair<String, String>>
)

internal object NexusActions {
    val all = listOf(
        NexusAction("linux.health", "Linux Health", "Versi kernel, Alpine dan ruang kerja",
            listOf("Sistem" to "uname -a; cat /etc/os-release | head -6",
                "Disk" to "df -h /workspace")),
        NexusAction("linux.devkit", "Developer Toolchain", "Versi Python, Git, Node dan compiler",
            listOf("Tools" to "python3 --version; git --version; node --version; gcc --version | head -1; clang --version | head -1")),
        NexusAction("linux.workspace", "Workspace Audit", "Senarai fail ruang kerja tanpa mengubah kandungan",
            listOf("Workspace" to "pwd; ls -lah /workspace | head -50")),
        NexusAction("linux.git", "Git Repository Status", "Semak Git hanya jika repositori ada dalam /workspace",
            listOf("Git" to "git -C /workspace status --short --branch 2>&1 || echo 'Tiada repositori Git di /workspace'")),
        NexusAction("workflow.audit", "Nexus System Audit", "Workflow berbilang langkah: sistem, devkit dan Git",
            listOf("Sistem" to "uname -a; df -h /workspace",
                "Tools" to "python3 --version; git --version; node --version",
                "Git" to "git -C /workspace status --short --branch 2>&1 || echo 'Tiada repositori Git di /workspace'")),
        NexusAction("linux.probe", "Scheduler Probe (8s)",
            "Ujian P10/P11: proses terkawal untuk concurrency dan cancellation",
            listOf("Probe" to "sleep 8 && printf 'NEXUS_PROBE_COMPLETED\n'"))
    )
    fun find(id: String): NexusAction? = all.firstOrNull { it.id == id }
}

internal enum class NexusTaskStatus { RUNNING, COMPLETED, FAILED, CANCELLED, INTERRUPTED }

internal data class NexusCommandPreview(
    val token: String,
    val command: String,
    val createdAt: Long
)

internal data class NexusEvent(
    val id: String,
    val title: String,
    val status: NexusTaskStatus,
    val createdAt: Long
)

internal data class NexusSnapshot(
    val dashboard: String = "",
    val dashboardUpdated: Long = 0,
    val aiStatus: String = "Belum diperiksa",
    val linuxReady: Boolean = false,
    val events: List<NexusEvent> = emptyList(),
    val activeId: String? = null,
    val activeTitle: String = "",
    val progress: String = "",
    val lastOutput: String = "",
    val lastStatus: NexusTaskStatus? = null
)

internal object NexusEngine {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val mutable = MutableStateFlow(NexusSnapshot())
    val state = mutable.asStateFlow()
    @Volatile private var app: Context? = null
    private var journal: NexusJournal? = null
    private var running: Job? = null
    private val journalMutex = Mutex()
    private val kernelRegistry: KernelRegistry = KernelDefaults.registry()
    private val kernelContext = KernelContextGraph()
    private var kernelCheckpoint: KernelCheckpointStore? = null
    private var kernelPlanStore: KernelPlanStore? = null
    private var workspaceTransactions: KernelWorkspaceTransactions? = null
    private var pendingManualCommand: NexusCommandPreview? = null
    private val kernelBus = KernelEventBus()
    val kernelEvents = kernelBus.events
    private val metrics = KernelTelemetry()
    @Volatile private var providerList: List<Pair<String, String>> = emptyList()
    fun kernelCheckpoints(): List<KernelCheckpointStore.Checkpoint> =
        kernelCheckpoint?.recover().orEmpty()
    fun kernelEventsRecent() = kernelBus.recent()
    fun kernelTelemetry() = metrics.snapshot()
    fun kernelProviderHealth() = KernelProviderPolicy.assess(providerList)
    fun recoverablePlan(): KernelPlan? =
        kernelPlanStore?.recoveryCandidate(kernelRegistry, kernelCheckpoints())

    /** Deterministic offline planner; never runs a shell command. */
    fun planKernel(goal: String): KernelPlan? =
        KernelPlanner.propose(goal, kernelRegistry)?.also {
            kernelBus.publish(KernelEventType.PLAN_PROPOSED, it.id)
        }
    /** User-triggered remote planning; no memory, history or command execution. */
    suspend fun planWithAi(goal: String): KernelPlan {
        val plan = KernelAiPlanner().propose(goal, kernelRegistry)
        kernelBus.publish(KernelEventType.PLAN_PROPOSED, plan.id, detail = "remote-model")
        return plan
    }
    fun kernelFacts() = kernelContext.facts()

    /**
     * Nexus can modify local workspace files through user-approved transactions.
     * These cannot edit outside /workspace or execute shell text. Existing Linux
     * PTY remains independent and retains its own capabilities.
     */
    suspend fun previewWorkspaceUpsert(path: String, content: String): KernelChangePreview =
        withContext(Dispatchers.IO) {
            check(running?.isActive != true) { "Nexus sedang menjalankan tugas" }
            requireNotNull(workspaceTransactions).previewUpsert(path, content)
        }

    /** Sends file text to backend only after the user explicitly requests AI edit. */
    suspend fun suggestWorkspaceEditWithAi(path: String, goal: String): KernelChangePreview {
        check(running?.isActive != true) { "Nexus sedang menjalankan tugas" }
        val current = withContext(Dispatchers.IO) {
            requireNotNull(workspaceTransactions).textForAi(path)
        }
        val proposal = KernelAiEditPlanner().suggest(path, goal, current)
        return previewWorkspaceUpsert(path, proposal)
    }

    suspend fun previewWorkspaceDelete(path: String): KernelChangePreview =
        withContext(Dispatchers.IO) {
            check(running?.isActive != true) { "Nexus sedang menjalankan tugas" }
            requireNotNull(workspaceTransactions).previewDelete(path)
        }

    suspend fun previewWorkspaceRollback(): KernelChangePreview? =
        withContext(Dispatchers.IO) {
            check(running?.isActive != true) { "Nexus sedang menjalankan tugas" }
            requireNotNull(workspaceTransactions).previewRollback()
        }

    suspend fun commitWorkspaceChange(preview: KernelChangePreview): KernelTransactionReceipt =
        withContext(Dispatchers.IO) {
            check(running?.isActive != true) { "Nexus sedang menjalankan tugas" }
            val receipt = requireNotNull(workspaceTransactions).commit(preview)
            val id = UUID.randomUUID().toString()
            mutable.update {
                it.copy(
                    activeTitle = "Workspace " + receipt.action,
                    progress = "Perubahan disahkan",
                    lastStatus = NexusTaskStatus.COMPLETED,
                    lastOutput = "Selesai " + receipt.action + " /workspace/" + receipt.path,
                    events = (listOf(NexusEvent(id, "Workspace " + receipt.action,
                        NexusTaskStatus.COMPLETED, receipt.completedAt)) + it.events).take(24)
                )
            }
            kernelBus.publish(KernelEventType.TASK_FINISHED, detail = "Workspace " + receipt.action)
            persistMetadata()
            receipt
        }

    fun clearWorkspacePreview() { workspaceTransactions?.clearPreview() }

    /**
     * Explicit user-authored command runner. No command text from A.I. planning
     * is executed automatically. This operates inside the existing rootless
     * Alpine PRoot sandbox, not Android OS root.
     */
    @Synchronized fun previewManualLinuxCommand(command: String): NexusCommandPreview {
        require(command.isNotBlank() && command.length <= 8000 && !command.contains('\u0000')) {
            "Arahan Linux tidak sah atau terlalu panjang"
        }
        return NexusCommandPreview(
            UUID.randomUUID().toString(), command, System.currentTimeMillis()
        ).also { pendingManualCommand = it }
    }

    @Synchronized fun clearManualCommandPreview() { pendingManualCommand = null }

    @Synchronized fun runApprovedLinuxCommand(approved: NexusCommandPreview): Boolean {
        val context = app ?: return false
        if (running?.isActive == true) return false
        val pending = pendingManualCommand ?: return false
        if (pending !== approved || pending.token != approved.token ||
            System.currentTimeMillis() - pending.createdAt !in 0L..120_000L) return false
        if (!AksaraLinuxRuntime.installed(context)) return false
        pendingManualCommand = null
        val event = NexusEvent(
            UUID.randomUUID().toString(), "Manual Linux Command",
            NexusTaskStatus.RUNNING, System.currentTimeMillis())
        mutable.update {
            it.copy(activeId = event.id, activeTitle = event.title,
                progress = "Menjalankan arahan pengguna dalam PRoot",
                lastOutput = "", lastStatus = NexusTaskStatus.RUNNING,
                events = (listOf(event) + it.events).take(24))
        }
        persistMetadata()
        running = scope.launch {
            kernelBus.publish(KernelEventType.TASK_STARTED, detail = "Manual shell")
            try {
                val result = NexusLinuxRunner.execute(context, approved.command, 600_000L)
                val text = result.output + "\nExit: " + result.exitCode +
                    if (result.truncated) "\nNota: output dipendekkan pada 16KiB." else ""
                val ok = result.exitCode == 0
                finish(event.id, if (ok) NexusTaskStatus.COMPLETED else NexusTaskStatus.FAILED,
                    text, if (ok) "Arahan selesai" else "Arahan gagal")
                kernelBus.publish(if (ok) KernelEventType.TASK_FINISHED
                    else KernelEventType.TASK_FAILED, detail = "Manual shell")
            } catch (cancel: CancellationException) {
                finish(event.id, NexusTaskStatus.CANCELLED, "", "Arahan dibatalkan")
                kernelBus.publish(KernelEventType.TASK_CANCELLED, detail = "Manual shell")
                throw cancel
            } catch (error: Exception) {
                finish(event.id, NexusTaskStatus.FAILED,
                    "Command error: " + (error.message ?: "Unknown").take(180),
                    "Arahan gagal")
                kernelBus.publish(KernelEventType.TASK_FAILED, detail = "Manual shell")
            }
        }
        return true
    }

    /**
     * This method MUST only be called after explicit plan preview + user approval.
     * The approved plan is immutable and checked against the registry again.
     */
    @Synchronized fun startKernelPlan(plan: KernelPlan): Boolean {
        val context = app ?: return false
        if (running?.isActive == true) return false
        val approval = runCatching {
            KernelPolicy.approveReadOnly(plan, kernelRegistry, System.currentTimeMillis())
        }.getOrNull() ?: return false
        val needsLinux = plan.nodes.any { it.capability.startsWith("linux.") }
        if (needsLinux && !AksaraLinuxRuntime.installed(context)) return false
        val resource = KernelResourceGovernor.snapshot(context)
        metrics.configure(resource)
        if (resource.lowMemory || resource.powerSave)
            kernelBus.publish(KernelEventType.RESOURCE_PRESSURE,
                detail = "Parallelism limited to one")
        if (runCatching { kernelPlanStore?.save(plan) }.isFailure) return false
        val id = UUID.randomUUID().toString()
        kernelBus.publish(KernelEventType.PLAN_APPROVED, plan.id)
        val event = NexusEvent(id, "ANK V2 · " + plan.goal.take(45),
            NexusTaskStatus.RUNNING, System.currentTimeMillis())
        mutable.update {
            it.copy(activeId = id, activeTitle = event.title,
                progress = "Kernel scheduler initializing", lastStatus = NexusTaskStatus.RUNNING,
                lastOutput = "", events = (listOf(event) + it.events).take(24))
        }
        persistMetadata()
        runCatching { kernelCheckpoint?.record(plan.id, "workflow", KernelStatus.RUNNING.name) }
        running = scope.launch {
            val wallStart = SystemClock.elapsedRealtime()
            val cpuStart = android.os.Process.getElapsedCpuTime()
            var recordedStatus: KernelStatus? = null
            kernelBus.publish(KernelEventType.TASK_STARTED, plan.id)
            try {
                val outcome = KernelScheduler(
                    kernelRegistry, maxParallel = 2,
                    parallelismProvider = {
                        val updated = KernelResourceGovernor.snapshot(context)
                        metrics.configure(updated)
                        updated.parallelism
                    }
                ).run(
                    plan, approval,
                    execute = { node, previous -> executeKernelNode(context, node, previous, plan.id) },
                    onTransition = { transition ->
                        runCatching { kernelCheckpoint?.record(
                            transition.planId, transition.nodeId, transition.status.name) }
                        kernelBus.publish(
                            if (transition.status == KernelStatus.FAILED)
                                KernelEventType.TASK_FAILED else KernelEventType.TASK_STARTED,
                            transition.planId, transition.nodeId,
                            transition.status.name)
                        mutable.update { it.copy(progress =
                            transition.nodeId + " · " + transition.status.name) }
                    }
                )
                val report = buildString {
                    append("ANK V2 WORKFLOW ").append(plan.id).append('\n')
                    outcome.steps.forEach { step ->
                        append("\n[").append(step.nodeId).append("] ")
                            .append(step.status.name).append('\n')
                        step.evidence?.let { evidence ->
                            append("Source: ").append(evidence.source).append('\n')
                            append("Exit: ").append(evidence.exitCode).append('\n')
                            append(evidence.output.take(5000)).append('\n')
                        }
                        if (!step.error.isNullOrBlank()) append("Reason: ").append(step.error).append('\n')
                    }
                }
                runCatching { kernelCheckpoint?.record(plan.id, "workflow",
                    if (outcome.passed) KernelStatus.COMPLETED.name else KernelStatus.FAILED.name) }
                recordedStatus = if (outcome.passed) KernelStatus.COMPLETED else KernelStatus.FAILED
                kernelBus.publish(
                    if (outcome.passed) KernelEventType.TASK_FINISHED else KernelEventType.TASK_FAILED,
                    plan.id, detail = "Workflow " + recordedStatus.name)
                finish(id, if (outcome.passed) NexusTaskStatus.COMPLETED else NexusTaskStatus.FAILED,
                    report, if (outcome.passed) "All DAG steps completed" else "Workflow incomplete")
            } catch (c: CancellationException) {
                runCatching { kernelCheckpoint?.record(plan.id, "workflow", "CANCELLED") }
                kernelBus.publish(KernelEventType.TASK_CANCELLED, plan.id)
                finish(id, NexusTaskStatus.CANCELLED, "", "Kernel workflow cancelled")
                throw c
            } catch (e: Exception) {
                runCatching { kernelCheckpoint?.record(plan.id, "workflow", KernelStatus.FAILED.name) }
                recordedStatus = KernelStatus.FAILED
                kernelBus.publish(KernelEventType.TASK_FAILED, plan.id,
                    detail = "Workflow failed")
                finish(id, NexusTaskStatus.FAILED, "Kernel error: " +
                    (e.message ?: "unknown").take(200), "Kernel workflow failed")
            } finally {
                metrics.configure(KernelResourceGovernor.snapshot(context))
                metrics.record(SystemClock.elapsedRealtime() - wallStart, recordedStatus,
                    android.os.Process.getElapsedCpuTime() - cpuStart)
            }
        }
        return true
    }

    private suspend fun executeKernelNode(
        context: Context,
        node: KernelNode,
        previous: Map<String, KernelEvidence>,
        planId: String
    ): KernelEvidence {
        val now = System.currentTimeMillis()
        val cap = node.capability
        val evidence = when (cap) {
            "today.snapshot" -> {
                val snapshot = state.value.dashboard
                KernelEvidence(cap, "today-repository",
                    snapshot.ifBlank { "Dashboard snapshot unavailable; open Today first." },
                    if (snapshot.isBlank()) 3 else 0, now, facts = mapOf(
                        "today.availability" to if (snapshot.isBlank()) "missing" else "cached",
                        "today.snapshot.age_ms" to if (snapshot.isBlank()) "unknown"
                            else (now - state.value.dashboardUpdated).coerceAtLeast(0).toString()))
            }
            "today.github" -> {
                val feed = TodayRepository(context).github(force = false)
                val commit = feed.value
                val updated = feed.updatedAt ?: now
                if (commit == null) {
                    KernelEvidence(cap, "today-github-repository",
                        "GitHub commit tidak tersedia", 3, now,
                        facts = mapOf("github.available" to "false"))
                } else {
                    val summary = "Commit " + commit.sha.take(12) +
                        "\nCI: " + commit.ci + "\n" + commit.message.take(160)
                    KernelEvidence(cap, "today-github-repository", summary, 0, updated,
                        facts = mapOf(
                            "github.commit.sha" to commit.sha.take(40),
                            "github.ci.status" to commit.ci.take(60),
                            "github.data.cached" to feed.fromCache.toString(),
                            "github.snapshot.age_ms" to (now - updated).coerceAtLeast(0L).toString()))
                }
            }
            "ai.health" -> {
                val status = kernelProviderHealth()
                KernelEvidence(cap, "chat-provider-state",
                    status.status + "\n" + state.value.aiStatus,
                    if (status.available) 0 else 3, now,
                    facts = mapOf("ai.providers.available" to status.available.toString(),
                        "ai.providers.observed" to status.sources.joinToString(",")))
            }
            "kernel.evidence" -> {
                val report = KernelEvidenceParser.summarize(previous.values)
                KernelEvidence(cap, "nexus-local", report, 0, now,
                    facts = mapOf("kernel.evidence.sources" to previous.size.toString()))
            }
            "linux.health", "linux.devkit", "linux.git", "linux.workspace", "linux.probe" -> {
                // V2 never concatenates unrelated checks with ';'. Each has its
                // own truthful exit code, unlike the backwards-compatible V1 actions.
                val checks = when (cap) {
                    "linux.health" -> listOf(
                        "Kernel" to "uname -a",
                        "Alpine" to "cat /etc/os-release",
                        "Storage" to "df -h /workspace")
                    "linux.devkit" -> listOf(
                        "Python" to "python3 --version",
                        "Git" to "git --version",
                        "Node.js" to "node --version",
                        "GCC" to "gcc --version",
                        "Clang" to "clang --version")
                    "linux.git" -> listOf("Git workspace" to "git -C /workspace status --short --branch")
                    "linux.workspace" -> listOf(
                        "Directory" to "pwd",
                        "Files" to "ls -lah /workspace")
                    else -> requireNotNull(NexusActions.find("linux.probe")).steps
                }
                val output = StringBuilder()
                val resultFacts = linkedMapOf<String, String>()
                var lastExit = 0
                for ((label, command) in checks) {
                    val response = NexusLinuxRunner.execute(context, command,
                        if (cap == "linux.probe") 15_000L else 12_000L)
                    output.append('[').append(label).append("]\n")
                        .append(response.output).append("\nExit: ").append(response.exitCode)
                        .append("\n\n")
                    val checkKey = "check." + label.lowercase(java.util.Locale.ROOT)
                        .replace(Regex("[^a-z0-9]+"), "-")
                    resultFacts[checkKey + ".exit"] = response.exitCode.toString()
                    if (response.truncated) {
                        resultFacts[checkKey + ".truncated"] = "true"
                        output.append("WARNING: Command output truncated at 16384 bytes.\n")
                    }
                    lastExit = if (response.truncated && response.exitCode == 0) 5 else response.exitCode
                    if (lastExit != 0) {
                        // No Git repository is an observed state, not a shell success.
                        val missingRepo = cap == "linux.git" &&
                            response.output.contains("not a git repository", ignoreCase = true)
                        if (missingRepo) {
                            resultFacts["git.workspace.repository"] = "absent"
                            output.append("NOTE: Git status failed because /workspace has no repository.\n")
                            lastExit = 0
                        }
                        break
                    }
                }
                val text = output.toString()
                resultFacts.putAll(KernelEvidenceParser.parse(cap, text))
                KernelEvidence(cap, "alpine-proot", text, lastExit, now, facts = resultFacts)
            }
            else -> error("Kernel policy denied unknown adapter")
        }
        kernelContext.ingest(planId, evidence)
        return evidence
    }


    @Synchronized fun initialize(context: Context) {
        if (app != null) return
        val safe = context.applicationContext
        journal = NexusJournal(safe)
        kernelCheckpoint = KernelCheckpointStore(safe)
        kernelPlanStore = KernelPlanStore(safe)
        workspaceTransactions = KernelWorkspaceTransactions(
            AksaraLinuxRuntime.workspace(safe), safe.noBackupFilesDir)
        app = safe
        kernelBus.publish(KernelEventType.BOOTSTRAPPED)
        if (recoverablePlan() != null)
            kernelBus.publish(KernelEventType.RECOVERY_AVAILABLE)
        val history = journal?.read().orEmpty()
        mutable.update {
            it.copy(events = history, linuxReady = AksaraLinuxRuntime.installed(safe))
        }
    }

    fun refreshLinux() {
        val context = app ?: return
        mutable.update { it.copy(linuxReady = AksaraLinuxRuntime.installed(context)) }
    }

    fun publishDashboard(summary: String) {
        val clipped = summary.take(900)
        mutable.update {
            if (it.dashboard == clipped) it
            else it.copy(dashboard = clipped, dashboardUpdated = System.currentTimeMillis())
        }
    }

    fun publishAiStatus(providers: List<Pair<String, String>>) {
        providerList = providers.take(8).map { (id, status) -> id.take(40) to status.take(60) }
        kernelBus.publish(KernelEventType.PROVIDER_UPDATED)
        val summary = if (providers.isEmpty()) "Belum diperiksa"
            else providers.take(5).joinToString(" · ") { it.first + ": " + it.second.take(35) }
        mutable.update { it.copy(aiStatus = summary) }
    }

    @Synchronized fun start(actionId: String): Boolean {
        val action = NexusActions.find(actionId) ?: return false
        val context = app ?: return false
        if (running?.isActive == true) return false
        val ready = AksaraLinuxRuntime.installed(context)
        if (!ready) {
            mutable.update { it.copy(linuxReady = false, progress = "Alpine belum tersedia") }
            return false
        }
        val id = UUID.randomUUID().toString()
        val event = NexusEvent(id, action.title, NexusTaskStatus.RUNNING, System.currentTimeMillis())
        mutable.update {
            it.copy(linuxReady = true, activeId = id, activeTitle = action.title,
                progress = "Memulakan...", lastOutput = "", lastStatus = NexusTaskStatus.RUNNING,
                events = (listOf(event) + it.events).take(24))
        }
        persistMetadata()
        running = scope.launch {
            val output = StringBuilder()
            try {
                for ((index, step) in action.steps.withIndex()) {
                    coroutineContext.ensureActive()
                    mutable.update { it.copy(progress = "Langkah " + (index + 1) + "/" + action.steps.size + ": " + step.first) }
                    val result = NexusLinuxRunner.execute(context, step.second, 12_000L)
                    output.append("[").append(step.first).append("]\n")
                        .append(result.output).append("\nExit: ").append(result.exitCode).append("\n\n")
                    if (result.exitCode != 0) throw IllegalStateException(
                        "Langkah " + step.first + " gagal (exit " + result.exitCode + ")"
                    )
                }
                finish(id, NexusTaskStatus.COMPLETED, output.toString(), "Selesai")
            } catch (ex: CancellationException) {
                finish(id, NexusTaskStatus.CANCELLED, output.toString(), "Dibatalkan")
                throw ex
            } catch (ex: Exception) {
                finish(id, NexusTaskStatus.FAILED,
                    output.append("\nRalat: ").append(ex.message?.take(180) ?: "Tidak diketahui").toString(),
                    "Gagal")
            }
        }
        return true
    }

    @Synchronized fun cancel() {
        running?.cancel()
    }

    private fun finish(id: String, status: NexusTaskStatus, output: String, message: String) {
        mutable.update { current ->
            if (current.activeId != id) current else current.copy(
                activeId = null, progress = message, lastOutput = output.take(18_000),
                lastStatus = status,
                events = current.events.map { if (it.id == id) it.copy(status = status) else it }
            )
        }
        persistMetadata()
    }

    private fun persistMetadata() {
        // Serialize writes and take the latest snapshot only after acquiring the lock.
        // Output, prompts, weather and location never reach this journal.
        scope.launch { journalMutex.withLock { journal?.write(mutable.value.events) } }
    }
}

private data class NexusProcessResult(val output: String, val exitCode: Int, val truncated: Boolean)

private object NexusLinuxRunner {
    /** Separate headless PRoot process. Never writes into an interactive PTY. */
    suspend fun execute(context: Context, fixedCommand: String, timeoutMs: Long): NexusProcessResult = coroutineScope {
        require(AksaraLinuxRuntime.installed(context)) { "Linux tidak dipasang" }
        val root = AksaraLinuxRuntime.rootfs(context)
        val workspace = AksaraLinuxRuntime.workspace(context)
        val l2s = File(root, ".l2s")
        require(!java.nio.file.Files.isSymbolicLink(l2s.toPath()))
        require(l2s.isDirectory || l2s.mkdirs())
        Os.chmod(l2s.absolutePath, 448) // 0700
        val executable = AksaraLinuxRuntime.proot(context).absolutePath
        val command = listOf(
            executable, "-0", "--kill-on-exit", "--link2symlink",
            "-r", root.absolutePath, "-b", "/dev", "-b", "/proc", "-b", "/sys",
            "-b", workspace.absolutePath + ":/workspace", "-w", "/workspace",
            "/bin/sh", "-lc", fixedCommand
        )
        val builder = ProcessBuilder(command).directory(workspace).redirectErrorStream(true)
        builder.environment().apply {
            put("HOME", "/root")
            put("TERM", "dumb")
            put("LANG", "C.UTF-8")
            put("PATH", "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin")
            put("PROOT_LOADER", AksaraLinuxRuntime.loader(context).absolutePath)
            put("PROOT_NO_SECCOMP", "1")
            put("PROOT_TMP_DIR", context.cacheDir.absolutePath)
            put("PROOT_L2S_DIR", l2s.absolutePath)
            put("TMPDIR", "/tmp")
        }
        val process = builder.start()
        val overflow = java.util.concurrent.atomic.AtomicBoolean(false)
        val reader = async(Dispatchers.IO) {
            val buffer = ByteArray(4096)
            val bytes = ByteArrayOutputStream()
            process.inputStream.use { input ->
                while (true) {
                    val n = input.read(buffer)
                    if (n < 0) break
                    val remaining = 16_384 - bytes.size()
                    if (remaining > 0) bytes.write(buffer, 0, minOf(n, remaining))
                    if (n > remaining) overflow.set(true)
                }
            }
            bytes.toString(Charsets.UTF_8.name())
        }
        try {
            var elapsed = 0L
            var complete = false
            while (elapsed < timeoutMs && !complete) {
                coroutineContext.ensureActive()
                complete = process.waitFor(100L, TimeUnit.MILLISECONDS)
                elapsed += 100L
            }
            if (!complete) throw IllegalStateException("Linux task timeout (" + timeoutMs + "ms)")
            NexusProcessResult(reader.await(), process.exitValue(), overflow.get())
        } finally {
            if (process.isAlive) process.destroyForcibly()
            reader.cancel()
            runCatching { process.inputStream.close() }
            runCatching { process.errorStream.close() }
            runCatching { process.outputStream.close() }
        }
    }
}

/** Bounded, metadata-only journal. Restored RUNNING events become INTERRUPTED. */
private class NexusJournal(context: Context) {
    private val preferences = context.getSharedPreferences("aksara_nexus_v1", Context.MODE_PRIVATE)
    fun read(): List<NexusEvent> = runCatching {
        val array = JSONArray(preferences.getString("events", "[]"))
        (0 until array.length()).mapNotNull { index ->
            val row = array.optJSONObject(index) ?: return@mapNotNull null
            val id = row.optString("id").takeIf { it.length in 1..80 } ?: return@mapNotNull null
            val status = runCatching { NexusTaskStatus.valueOf(row.getString("status")) }
                .getOrDefault(NexusTaskStatus.INTERRUPTED)
            NexusEvent(id, row.optString("title").take(70),
                if (status == NexusTaskStatus.RUNNING) NexusTaskStatus.INTERRUPTED else status,
                row.optLong("at", 0))
        }.take(24)
    }.getOrDefault(emptyList())

    fun write(events: List<NexusEvent>) {
        val array = JSONArray()
        events.take(24).forEach { event ->
            array.put(JSONObject().put("id", event.id).put("title", event.title)
                .put("status", event.status.name).put("at", event.createdAt))
        }
        preferences.edit().putString("events", array.toString()).apply()
    }
}
