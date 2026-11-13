package my.aksara.nativeapp.core.nexus

import android.content.Context
import android.system.Os
import my.aksara.nativeapp.core.linux.AksaraLinuxRuntime
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
                "Git" to "git -C /workspace status --short --branch 2>&1 || echo 'Tiada repositori Git di /workspace'"))
    )
    fun find(id: String): NexusAction? = all.firstOrNull { it.id == id }
}

internal enum class NexusTaskStatus { RUNNING, COMPLETED, FAILED, CANCELLED, INTERRUPTED }

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

    @Synchronized fun initialize(context: Context) {
        if (app != null) return
        val safe = context.applicationContext
        journal = NexusJournal(safe)
        app = safe
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

private data class NexusProcessResult(val output: String, val exitCode: Int)

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
        val reader = async(Dispatchers.IO) {
            val buffer = ByteArray(4096)
            val bytes = ByteArrayOutputStream()
            process.inputStream.use { input ->
                while (true) {
                    val n = input.read(buffer)
                    if (n < 0) break
                    val remaining = 16_384 - bytes.size()
                    if (remaining > 0) bytes.write(buffer, 0, minOf(n, remaining))
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
            NexusProcessResult(reader.await(), process.exitValue())
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
