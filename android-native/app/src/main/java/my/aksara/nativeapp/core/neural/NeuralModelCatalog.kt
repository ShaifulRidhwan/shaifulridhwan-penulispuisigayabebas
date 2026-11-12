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
        minAvailableRamBytes = 8L * 1024L * 1024L * 1024L,
        license = "Apache-2.0",
        downloadUrl = "https://huggingface.co/Qwen/Qwen3-8B-GGUF/resolve/7c41481f57cb95916b40956ab2f0b139b296d974/Qwen3-8B-Q4_K_M.gguf",
            sizeBytes = 5027783488L, name = "Qwen3-8B", parameters = "8B", quantization = "Q4_K_M", sourceRevision = "7c41481f57cb95916b40956ab2f0b139b296d974"
    )
    // Source and hash verified. Runtime support and device memory still require testing.
    val entries = listOf(
        NeuralCatalogEntry(NeuralTier.LIGHT, NeuralModelDescriptor(
            id = "qwen3-0-6b-q8-0",
            runtime = "llama.cpp",
            sha256 = "9465e63a22add5354d9bb4b99e90117043c7124007664907259bd16d043bb031",
            minAvailableRamBytes = 2L * 1024L * 1024L * 1024L,
            license = "Apache-2.0",
            downloadUrl = "https://huggingface.co/Qwen/Qwen3-0.6B-GGUF/resolve/23749fefcc72300e3a2ad315e1317431b06b590a/Qwen3-0.6B-Q8_0.gguf",
            sizeBytes = 639446688L, name = "Qwen3-0.6B", parameters = "0.6B", quantization = "Q8_0", sourceRevision = "23749fefcc72300e3a2ad315e1317431b06b590a"
        ), true),
        NeuralCatalogEntry(NeuralTier.BALANCED, NeuralModelDescriptor(
            id = "qwen3-4b-q4-k-m",
            runtime = "llama.cpp",
            sha256 = "7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5",
            minAvailableRamBytes = 4L * 1024L * 1024L * 1024L,
            license = "Apache-2.0",
            downloadUrl = "https://huggingface.co/Qwen/Qwen3-4B-GGUF/resolve/bc640142c66e1fdd12af0bd68f40445458f3869b/Qwen3-4B-Q4_K_M.gguf",
            sizeBytes = 2497280256L, name = "Qwen3-4B", parameters = "4B", quantization = "Q4_K_M", sourceRevision = "bc640142c66e1fdd12af0bd68f40445458f3869b"
        ), true),
        NeuralCatalogEntry(NeuralTier.ADVANCED_8B, advanced, true),
        // Third-party quantization: publisher API LFS digest/size and Apache-2.0
        // verified at this immutable revision. Smaller weights do not guarantee speed/quality.
        NeuralCatalogEntry(NeuralTier.LIGHT, NeuralModelDescriptor(
            id = "qwen3-0-6b-q4-k-m", runtime = "llama.cpp",
            sha256 = "ac2d97712095a558e31573f62f466a3f9d93990898b0ec79d7c974c1780d524a",
            minAvailableRamBytes = 1536L * 1024 * 1024, license = "Apache-2.0",
            downloadUrl = "https://huggingface.co/unsloth/Qwen3-0.6B-GGUF/resolve/50968a4468ef4233ed78cd7c3de230dd1d61a56b/Qwen3-0.6B-Q4_K_M.gguf",
            sizeBytes = 396705472L, name = "Qwen3-0.6B", parameters = "0.6B", quantization = "Q4_K_M",
            sourceRevision = "50968a4468ef4233ed78cd7c3de230dd1d61a56b", publisher = "Unsloth · base Qwen / Alibaba"
        ), true)
    )
}
