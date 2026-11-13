package my.aksara.nativeapp.feature.chat

import my.aksara.nativeapp.core.nexus.NexusCommandPreview
import my.aksara.nativeapp.core.nexus.kernel.KernelChangePreview
import my.aksara.nativeapp.core.nexus.kernel.KernelPlan

/**
 * Nexus commands are addressed to the main Chat composer only.
 * Ordinary messages remain normal Chat requests; no silent model/tool interception.
 */
internal sealed interface NexusChatRequest {
    data class Plan(val goal: String, val useAi: Boolean) : NexusChatRequest
    data class Shell(val command: String) : NexusChatRequest
    data class Write(val path: String, val content: String) : NexusChatRequest
    data class Delete(val path: String) : NexusChatRequest
    data class EditWithAi(val path: String, val goal: String) : NexusChatRequest
    data object Undo : NexusChatRequest
    data object Stop : NexusChatRequest
    data object Status : NexusChatRequest
    data object Help : NexusChatRequest
}
internal object NexusChatRouter {
    fun parse(raw: String): NexusChatRequest? {
        val trimmed = raw.trim()
        if (trimmed.startsWith("Nexus,", ignoreCase = true) ||
            trimmed.startsWith("Nexus:", ignoreCase = true)) {
            val goal = trimmed.drop(6).trim()
            return if (goal.isNotBlank()) NexusChatRequest.Plan(goal, useAi = true)
            else NexusChatRequest.Help
        }
        if (trimmed.equals("/nexus", ignoreCase = true) ||
            trimmed.equals("/nexus help", ignoreCase = true)) return NexusChatRequest.Help
        if (!trimmed.startsWith("/nexus ", ignoreCase = true)) return null
        val commandLine = trimmed.substring(7).trimStart()
        val first = commandLine.substringBefore(' ').substringBefore('\n').lowercase()
        val rest = commandLine.drop(first.length).trimStart()
        return when (first) {
            "plan" -> if (rest.isNotBlank()) NexusChatRequest.Plan(rest, true) else NexusChatRequest.Help
            "offline" -> if (rest.isNotBlank()) NexusChatRequest.Plan(rest, false) else NexusChatRequest.Help
            "shell" -> if (rest.isNotBlank()) NexusChatRequest.Shell(rest) else NexusChatRequest.Help
            "write" -> {
                val path = rest.substringBefore('\n').trim()
                val content = rest.substringAfter('\n', "")
                if (path.isBlank() || '\n' !in rest) NexusChatRequest.Help
                else NexusChatRequest.Write(path, content)
            }
            "delete" -> if (rest.isNotBlank()) NexusChatRequest.Delete(rest) else NexusChatRequest.Help
            "edit" -> {
                val parts = rest.split('|', limit = 2)
                if (parts.size != 2 || parts.any { it.isBlank() }) NexusChatRequest.Help
                else NexusChatRequest.EditWithAi(parts[0].trim(), parts[1].trim())
            }
            "undo" -> NexusChatRequest.Undo
            "stop", "cancel" -> NexusChatRequest.Stop
            "status" -> NexusChatRequest.Status
            else -> NexusChatRequest.Help
        }
    }

    const val HELP = "Nexus Kernel berjalan di belakang tabir.\n" +
        "• Nexus, semak Linux dan GitHub\n" +
        "• /nexus offline audit penuh\n" +
        "• /nexus shell pwd\n" +
        "• /nexus write notes.txt [baris baharu] teks\n" +
        "• /nexus delete notes.txt\n" +
        "• /nexus edit notes.txt | ringkaskan isi\n" +
        "• /nexus undo · /nexus stop · /nexus status\n" +
        "Semua tindakan mengubah sistem memerlukan kelulusan dalam Chat."
}
internal data class NexusChatNote(
    val id: String,
    val role: String,
    val content: String
)
internal data class NexusChatReview(
    val title: String,
    val description: String,
    val needsLinux: Boolean = false,
    val plan: KernelPlan? = null,
    val shell: NexusCommandPreview? = null,
    val change: KernelChangePreview? = null
)
