package my.aksara.nativeapp.feature.chat

/** Ready means configured/authenticated but not necessarily inference-tested. */
object ProviderConnectionStatus {
    val expected = listOf("gemini", "groq", "workers_ai", "openrouter")
    fun label(providers: List<Pair<String, String>>): String {
        val backend = providers.firstOrNull { it.first == "backend" }?.second
        if (backend != null) return if (backend.startsWith("Backend unreachable")) "Backend unreachable" else "Status unavailable"
        if (providers.isEmpty()) return "Unverified"
        val statuses = expected.map { id -> providers.firstOrNull { it.first == id }?.second?.trim()?.lowercase() ?: "unknown" }
        val failing = statuses.count { it == "offline" || it == "off" || it == "error" }
        val online = statuses.count { it == "online" }
        if (failing > 0) return if (failing == expected.size) "Offline" else "Degraded"
        if (online == expected.size) return "Connected"
        if (statuses.all { it == "online" || it == "ready" }) return "Ready"
        return "Unverified"
    }
}
