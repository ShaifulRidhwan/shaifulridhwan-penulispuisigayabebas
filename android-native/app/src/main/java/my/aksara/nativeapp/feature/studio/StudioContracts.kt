package my.aksara.nativeapp.feature.studio

/** Engine-independent Studio policy. Local failures must never dispatch a Cloud request. */
internal enum class StudioEngine { CLOUD, LOCAL }
internal enum class StudioPage { GENERATE, GALLERY, HISTORY, SETTINGS }

internal object StudioRules {
    const val MAX_PROMPT = 1200
    const val MAX_SEED = 2147483647L
    val cloudModels = setOf("klein", "schnell", "ovh")
    val cloudQualities = setOf("fast", "balanced", "detail")
    val cloudRatios = setOf("1:1", "4:5", "9:16", "16:9", "3:2")
    val presets = listOf("none" to "Ikut prompt", "sastera" to "Sastera",
        "langit" to "Langit", "falsafah" to "Falsafah", "cinta" to "Cinta",
        "futuristik" to "Futuristik", "realistic" to "Realistik",
        "illustration" to "Ilustrasi", "minimal" to "Minimal", "fantasy" to "Fantasi")
    fun prompt(value: String): String {
        val clean = value.trim()
        require(clean.length in 4..MAX_PROMPT) { "Prompt mesti 4 hingga 1200 aksara." }
        return clean
    }
    fun seed(raw: String): Long? {
        if (raw.isBlank()) return null
        val number = raw.trim().toLongOrNull()
        require(number != null && number in 0..MAX_SEED) { "Seed mesti antara 0 dan 2147483647." }
        return number
    }
    fun cloud(model: String, ratio: String, quality: String, seed: Long?) {
        require(model in cloudModels && ratio in cloudRatios && quality in cloudQualities) { "Tetapan Cloud tidak sah." }
        require(model == "klein" || (ratio == "1:1" && seed == null)) {
            "Schnell dan OVH hanya menyokong 1:1 tanpa seed."
        }
    }
    fun local(ratio: String, steps: Int, cfgScale: Float) {
        require(ratio == "1:1" && steps == 1 && cfgScale == 1.0f) {
            "SD-Turbo hanya menggunakan 512×512, satu langkah dan CFG natif 1.0."
        }
    }
    fun lightEnhance(prompt: String): String {
        val clean = prompt.trim()
        if (clean.length > 850) return clean
        return clean + "\n\nClear subject, coherent composition, natural depth, consistent lighting and accurate details. Preserve the original intent."
    }
}