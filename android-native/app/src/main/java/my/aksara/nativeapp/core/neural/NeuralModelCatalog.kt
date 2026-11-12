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
    val entries = NeuralTier.entries.map { NeuralCatalogEntry(it, null, false) }
}
