package my.aksara.nativeapp.core.nexus.kernel

import kotlinx.coroutines.flow.filterIsInstance
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeout
import my.aksara.nativeapp.BuildConfig
import my.aksara.nativeapp.core.network.ChatApi
import my.aksara.nativeapp.core.network.ChatEvent
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/**
 * Uses the existing Aksara backend only after the user requests A.I. planning.
 * There is no chat history, location, private memory or tool access in the payload.
 * A.I. chooses capability IDs only; it never creates shell commands.
 */
internal class KernelAiPlanner(
    private val chat: ChatApi = ChatApi(BuildConfig.API_ORIGIN)
) {
    suspend fun propose(goal: String, registry: KernelRegistry): KernelPlan {
        require(goal.isNotBlank() && goal.length <= 600)
        val whitelist = registry.inventory().filter { it.risk == KernelRisk.READ &&
            it.id != "linux.probe" && it.id != "kernel.evidence"
        }.map { it.id }
        val instruction = buildString {
            append("You are Aksara Nexus planning assistant. Return ONLY JSON: ")
            append("{\"capabilities\":[\"id1\",\"id2\"]}. ")
            append("Choose 1 to 8 relevant IDs from this allowlist, no arbitrary commands: ")
            append(whitelist.joinToString(", "))
            append(". Do not execute anything. Goal: ")
            append(goal)
        }
        val payload = JSONObject()
            .put("question", instruction)
            .put("history", JSONArray())
            .put("thoughtMode", "cahaya")
            .put("contextFallback", false)
            .put("mediaFallback", false)
            .put("memoryNotes", "")
            .put("summary", "")
            .put("thoughtLedger", JSONArray())
        val response = withTimeout(60_000L) {
            chat.chat(payload).filterIsInstance<ChatEvent.Done>().first()
        }
        return KernelModelPlanCodec.decode(goal, response.reply, registry)
    }
}

internal object KernelModelPlanCodec {
    fun decode(goal: String, reply: String, registry: KernelRegistry): KernelPlan {
        require(goal.isNotBlank() && goal.length <= 600)
        require(reply.length in 2..20_000)
        // Only the JSON object is considered. Any surrounding model prose is untrusted.
        val start = reply.indexOf('{')
        val end = reply.lastIndexOf('}')
        require(start >= 0 && end > start && end - start <= 4_000) {
            "Model tidak memulangkan plan JSON yang sah"
        }
        val obj = JSONObject(reply.substring(start, end + 1))
        val choices = obj.optJSONArray("capabilities")
            ?: throw IllegalArgumentException("Model tidak menyediakan capability IDs")
        require(choices.length() in 1..8) { "Jumlah capability tidak dibenarkan" }
        val ids = (0 until choices.length()).map {
            choices.optString(it).takeIf { id -> id.isNotBlank() }
                ?: throw IllegalArgumentException("Capability ID kosong")
        }
        require(ids.distinct().size == ids.size) { "Capability berulang" }
        ids.forEach { id ->
            val cap = registry.get(id) ?: error("Capability tidak berdaftar: " + id.take(70))
            require(cap.risk == KernelRisk.READ && id != "linux.probe" &&
                id != "kernel.evidence") { "Capability tidak boleh dirancang oleh model" }
        }
        val nodes = ids.mapIndexed { i, cap -> KernelNode("ai-" + i, cap) }
        val summary = KernelNode("evidence", "kernel.evidence", nodes.map { it.id }.toSet())
        return KernelPlan(UUID.randomUUID().toString(), goal.take(200), nodes + summary,
            System.currentTimeMillis()).also { KernelPlanner.validate(it, registry) }
    }
}
