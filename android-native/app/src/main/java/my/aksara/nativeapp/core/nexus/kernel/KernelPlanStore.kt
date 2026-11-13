package my.aksara.nativeapp.core.nexus.kernel

import android.content.Context
import android.util.AtomicFile
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Stores only the last approved diagnostic's capability graph (no user goal,
 * private chat, terminal output, dashboard location or token). No auto-execution.
 * On process death the user may explicitly start a fresh read-only diagnostic.
 */
internal class KernelPlanStore(context: Context) {
    private val file = AtomicFile(File(context.noBackupFilesDir, "ank-v2-last-approved-plan.json"))
    private val lock = Any()
    fun save(plan: KernelPlan) = synchronized(lock) {
        val root = JSONObject()
            .put("schema", 1)
            .put("id", plan.id)
            .put("at", System.currentTimeMillis())
            .put("steps", JSONArray().apply {
                plan.nodes.forEach { node ->
                    put(JSONObject().put("id", node.id).put("cap", node.capability)
                        .put("deps", JSONArray(node.dependsOn.toList())))
                }
            })
        val bytes = root.toString().toByteArray(Charsets.UTF_8)
        require(bytes.size <= 12_000)
        val out = file.startWrite()
        try {
            out.write(bytes)
            file.finishWrite(out)
        } catch (error: Exception) {
            file.failWrite(out)
            throw error
        }
    }

    fun recoveryCandidate(
        registry: KernelRegistry,
        checkpoints: List<KernelCheckpointStore.Checkpoint>,
        now: Long = System.currentTimeMillis()
    ): KernelPlan? = synchronized(lock) {
        val root = runCatching {
            file.openRead().use { JSONObject(it.readBytes().toString(Charsets.UTF_8)) }
        }.getOrNull() ?: return@synchronized null
        if (root.optInt("schema") != 1 || now - root.optLong("at") !in 0L..86_400_000L)
            return@synchronized null
        val id = root.optString("id").takeIf { it.isNotBlank() } ?: return@synchronized null
        val workflow = checkpoints.lastOrNull { it.planId == id && it.nodeId == "workflow" }
        if (workflow?.status != "INTERRUPTED") return@synchronized null
        val rows = root.optJSONArray("steps") ?: return@synchronized null
        if (rows.length() !in 1..24) return@synchronized null
        val nodes = runCatching {
            (0 until rows.length()).map { index ->
                val row = rows.getJSONObject(index)
                val deps = row.getJSONArray("deps")
                KernelNode(row.getString("id"), row.getString("cap"),
                    (0 until deps.length()).map { deps.getString(it) }.toSet())
            }
        }.getOrNull() ?: return@synchronized null
        val candidate = KernelPlan(id, "Ulang audit baca sahaja selepas gangguan",
            nodes, now)
        if (runCatching { KernelPlanner.validate(candidate, registry) }.isFailure ||
            nodes.any { registry.get(it.capability)?.risk != KernelRisk.READ })
            null else candidate.copy(id = java.util.UUID.randomUUID().toString())
    }

    fun clear() = synchronized(lock) { file.delete() }
}
