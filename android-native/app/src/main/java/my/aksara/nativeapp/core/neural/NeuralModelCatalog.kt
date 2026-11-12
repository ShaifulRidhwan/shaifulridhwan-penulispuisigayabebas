package my.aksara.nativeapp.core.neural

/** Model choices are capability tiers, not fabricated downloadable releases. */
enum class NeuralTier(val label: String, val description: String, val ramGuidanceGb: Int) {
    LIGHT("Light", "Small quantized model • lower memory demand", 6),
    BALANCED("Balanced", "Mid-sized quantized model • quality/performance trade-off", 8),
    ADVANCED_8B("Advanced 8B", "8B GGUF Q4 candidate • high memory demand", 12)
}

data class NeuralCatalogEntry(
    val tier: NeuralTier,
    val model: NeuralModelDescriptor?,
    val verifiedPublisher: Boolean
) {
    val canDownload: Boolean get() = verifiedPublisher && model?.validate() == true
}

/**
 * Fail-closed catalog. A model is downloadable only when a trusted publisher's
 * license, SHA-256 and HTTPS artifact URL have been verified and entered here.
 */
object NeuralModelCatalog {
    private val advanced = NeuralModelDescriptor(
        id = "qwen3-8b-q4-k-m",
        runtime = "llama.cpp",
        sha256 = "d98cdcbd03e17ce47681435b5150e34c1417f50b5c0019dd560e4882c5745785",
        minAvailableRamBytes = 7L * 1024L * 1024L * 1024L,
        license = "Apache-2.0",
        downloadUrl = "https://huggingface.co/Qwen/Qwen3-8B-GGUF/resolve/7c41481f57cb95916b40956ab2f0b139b296d974/Qwen3-8B-Q4_K_M.gguf"
    )
    // Source and hash verified. Runtime support and device memory still require testing.
    val entries = listOf(
        NeuralCatalogEntry(NeuralTier.LIGHT, NeuralModelDescriptor(
            id = "qwen3-0-6b-q8-0",
            runtime = "llama.cpp",
            sha256 = "9465e63a22add5354d9bb4b99e90117043c7124007664907259bd16d043bb031",
            minAvailableRamBytes = 2L * 1024L * 1024L * 1024L,
            license = "Apache-2.0",
            downloadUrl = "https://huggingface.co/Qwen/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q8_0.gguf"
        ), true),
        NeuralCatalogEntry(NeuralTier.BALANCED, NeuralModelDescriptor(
            id = "qwen3-4b-q4-k-m",
            runtime = "llama.cpp",
            sha256 = "7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5",
            minAvailableRamBytes = 4L * 1024L * 1024L * 1024L,
            license = "Apache-2.0",
            downloadUrl = "https://huggingface.co/Qwen/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf"
        ), true),
        NeuralCatalogEntry(NeuralTier.ADVANCED_8B, advanced, true)
    )
}
