package my.aksara.nativeapp.core.nexus.kernel

import android.content.Context
import android.util.AtomicFile
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Crash-safe, bounded metadata-only checkpoint store.
 * Does not persist prompts, stdout/stderr, dashboard contents or personal memory.
 * An interrupted task is NEVER replayed automatically.
 */
internal class KernelCheckpointStore(context: Context) {
    private val file = AtomicFile(File(context.noBackupFilesDir, "nexus-kernel-v2-checkpoints.json"))
    private val maxEvents = 128

    internal data class Checkpoint(
        val planId: String,
        val nodeId: String,
        val status: String,
        val at: Long
    )

    @Synchronized fun record(planId: String, nodeId: String, status: String) {
        require(planId.length in 1..80 && nodeId.length in 1..80)
        require(status.matches(Regex("[A-Z_]{3,24}")))
        val existing = readUnsafe().toMutableList()
        existing.add(Checkpoint(planId, nodeId, status, System.currentTimeMillis()))
        writeUnsafe(existing.takeLast(maxEvents))
    }

    @Synchronized fun recover(): List<Checkpoint> {
        // Collapse history to the final state for each step. A RUNNING record
        // followed by COMPLETED must never be reported as interrupted.
        val latest = linkedMapOf<Pair<String, String>, Checkpoint>()
        readUnsafe().forEach { mark -> latest[mark.planId to mark.nodeId] = mark }
        return latest.values.map { mark ->
            if (mark.status == KernelStatus.RUNNING.name)
                mark.copy(status = "INTERRUPTED") else mark
        }
    }

    private fun readUnsafe(): List<Checkpoint> = runCatching {
        val json = JSONObject(file.openRead().use { stream ->
            stream.readBytes().toString(Charsets.UTF_8)
        })
        val events = json.optJSONArray("events") ?: JSONArray()
        (0 until events.length()).mapNotNull { index ->
            val row = events.optJSONObject(index) ?: return@mapNotNull null
            val plan = row.optString("plan")
            val node = row.optString("node")
            val status = row.optString("status")
            if (plan.isBlank() || node.isBlank() || status.isBlank()) return@mapNotNull null
            Checkpoint(plan.take(80), node.take(80), status.take(24), row.optLong("at"))
        }.takeLast(maxEvents)
    }.getOrDefault(emptyList())

    private fun writeUnsafe(values: List<Checkpoint>) {
        val events = JSONArray()
        values.forEach { mark ->
            events.put(JSONObject()
                .put("plan", mark.planId)
                .put("node", mark.nodeId)
                .put("status", mark.status)
                .put("at", mark.at))
        }
        val payload = JSONObject().put("schema", 1).put("events", events)
            .toString().toByteArray(Charsets.UTF_8)
        val stream = file.startWrite()
        try {
            stream.write(payload)
            file.finishWrite(stream)
        } catch (ex: Exception) {
            file.failWrite(stream)
            throw ex
        }
    }
}
