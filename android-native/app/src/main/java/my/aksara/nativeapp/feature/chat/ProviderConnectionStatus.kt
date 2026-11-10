package my.aksara.nativeapp.feature.chat

/** Ready means configured/authenticated but not necessarily inference-tested. */
object ProviderConnectionStatus {
    val expected = listOf("gemini", "groq", "workers_ai", "openrouter")
    fun state(status: String, http: Int = 0, reason: String = ""): String {
        val value = status.trim().lowercase(java.util.Locale.ROOT)
        // A current successful inference takes precedence over stale diagnostics.
        if (value == "online") return "online"
        if (http == 429 || reason in setOf("quota", "rate_limit", "free_quota_exhausted") || http == 402)
            return "rate limited"
        if (http in setOf(400, 401, 403, 404) || value == "off" ||
            reason.startsWith("missing_or_invalid_") || reason in setOf("not_configured", "authentication_or_access", "authorization_or_access"))
            return "misconfigured"
        return when (value) {
            "offline", "error" -> "unavailable"
            else -> value
        }
    }
    fun label(providers: List<Pair<String, String>>): String {
        val backend = providers.firstOrNull { it.first == "backend" }?.second
        if (backend != null) return if (backend.startsWith("Backend unreachable")) "Backend unreachable" else "Status unavailable"
        if (providers.isEmpty()) return "Unverified"
        val statuses = expected.map { id -> providers.firstOrNull { it.first == id }?.second?.trim()?.lowercase() ?: "unknown" }
        val failing = statuses.count { it in setOf("offline", "off", "error", "unavailable", "misconfigured", "rate limited", "degraded") }
        val online = statuses.count { it == "online" }
        if (statuses.all { it == "rate limited" }) return "Rate Limited"
        if (statuses.all { it == "misconfigured" }) return "Misconfigured"
        if (statuses.all { it == "unavailable" }) return "Unavailable"
        if (failing > 0) return if (failing == expected.size) "Offline" else "Degraded"
        if (online == expected.size) return "Connected"
        if (statuses.all { it == "online" || it == "ready" }) return "Ready"
        return "Unverified"
    }
}
