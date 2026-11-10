package my.aksara.nativeapp.feature.chat

import androidx.compose.ui.graphics.Color

/** Provider evidence states: READY is not proof that an inference request succeeded. */
internal object ProviderStatusPalette {
    val online = Color(0xff55dba2)
    val ready = Color(0xffe8bd69)
    val offline = Color(0xffff7f86)
    val unknown = Color(0xffaab3c4)

    fun color(status: String): Color = when (status.trim().lowercase()) {
        "online", "connected" -> online
        "ready", "rate limited" -> ready
        "offline", "off", "error", "degraded", "unavailable", "misconfigured", "backend unreachable" -> offline
        else -> unknown
    }

    fun summary(providers: List<Pair<String, String>>): String {
        val normalized = ProviderConnectionStatus.expected.map { id ->
            providers.firstOrNull { it.first == id }?.second?.trim()?.lowercase().orEmpty()
        }
        val online = normalized.count { it == "online" }
        val ready = normalized.count { it == "ready" }
        return "$online Online · $ready Ready"
    }
}
