package my.aksara.nativeapp.feature.chat

/** Provider metadata, never inferred from host, a model name or the most recent message. */
data class ProviderVisual(val id: String, val name: String, val icon: String)
object ProviderIdentity {
    private val providers = mapOf(
        "gemini" to ProviderVisual("gemini", "Gemini", "gemini"),
        "groq" to ProviderVisual("groq", "Groq", "groq"),
        "workers_ai" to ProviderVisual("workers_ai", "Workers AI", "workers_ai"),
        "openrouter" to ProviderVisual("openrouter", "OpenRouter", "openrouter"),
        "aksara_local" to ProviderVisual("aksara_local", "Aksara Local", "aksara")
    )
    fun normalize(value: String?): String? {
        val id = value?.trim()?.lowercase(java.util.Locale.ROOT)?.take(64)
        return id?.takeIf { it in providers }
    }
    fun of(value: String?): ProviderVisual? = providers[normalize(value)]
}
