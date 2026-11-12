package my.aksara.nativeapp.core.neural

/** Estimates native resident working memory, not the Java heap limit or advertised virtual RAM. */
data class NeuralMemoryAssessment(
    val contextSize: Int,
    val modelBytes: Long,
    val kvCacheBytes: Long,
    val scratchBytes: Long,
    val overheadBytes: Long,
    val reserveBytes: Long,
    val recommendedAvailableBytes: Long,
    val hardFailure: String? = null,
    val warning: String? = null
) {
    val estimatedNativeBytes get() = modelBytes + kvCacheBytes + scratchBytes + overheadBytes
    val minimumAvailableBytes get() = estimatedNativeBytes + reserveBytes
    val canAttempt get() = hardFailure == null
}

object NeuralMemoryPolicy {
    private const val MIB = 1024L * 1024
    private const val GIB = 1024L * MIB
    fun isLight(model: NeuralModelDescriptor) = model.id == "qwen3-0-6b-q8-0"
    private fun mib(bytes: Long) = "${(bytes + MIB - 1) / MIB} MiB"

    fun assess(device: NeuralDeviceSnapshot, model: NeuralModelDescriptor, requestedContext: Int): NeuralMemoryAssessment {
        val light = isLight(model)
        // Controlled Light attempts use 1024 tokens; this bounds KV and prefill memory.
        val context = if (light) 1024 else requestedContext.coerceIn(1024, 2048)
        val kvPerToken = when (model.id) {
            "qwen3-0-6b-q8-0" -> 112L * 1024 // 28 layers * 8 KV heads * 128 dims * K/V * fp16
            "qwen3-4b-q4-k-m" -> 144L * 1024 // 36 layers, same KV dimensions
            "qwen3-8b-q4-k-m" -> 128L * 1024 // 32 layers, same KV dimensions
            else -> 256L * 1024
        }
        val scratch = when { light -> 128 * MIB; model.parameters == "4B" -> 256 * MIB; else -> 384 * MIB }
        val overhead = if (light) 192 * MIB else 384 * MIB
        // threshold is Android's pressure watermark, not extra model memory or swap.
        val reserve = maxOf(device.lowMemoryThresholdBytes, 256 * MIB) + 128 * MIB
        val estimate = model.sizeBytes + kvPerToken * context + scratch + overhead
        val minimum = estimate + reserve
        val recommended = maxOf(model.minAvailableRamBytes, estimate) + reserve
        val reason = when {
            "arm64-v8a" !in device.supportedAbis -> "Runtime memerlukan CPU ARM64."
            device.totalRamBytes <= 0 || device.availableRamBytes <= 0 || device.availableRamBytes > device.totalRamBytes ->
                "Bacaan RAM tidak sah. Tekan Semak RAM dan cuba semula."
            device.lowMemory || device.availableRamBytes <= device.lowMemoryThresholdBytes ->
                "Android melaporkan tekanan memori (tersedia ${mib(device.availableRamBytes)}, ambang ${mib(device.lowMemoryThresholdBytes)}). Tutup aplikasi lain dan semak semula."
            device.thermalStatus >= 3 -> "Peranti terlalu panas. Biarkan sejuk sebelum memuat model."
            model.parameters == "8B" && device.totalRamBytes < 10 * GIB ->
                "Advanced 8B tidak layak pada RAM fizikal ini. Pilih Light; Balanced hanya jika semakan RAMnya lulus. RAM maya tidak dikira."
            device.availableRamBytes < (if (light) minimum else recommended) ->
                "RAM tersedia ${mib(device.availableRamBytes)}; perlu sekurang-kurangnya ${mib(if (light) minimum else recommended)} termasuk rizab Android ${mib(reserve)}. " +
                    if (light) "Tutup aplikasi lain dan cuba semula Light 1024 token." else "Nyahmuat model aktif atau cuba Light."
            else -> null
        }
        val warning = if (reason == null && light && device.availableRamBytes < recommended)
            "Di bawah cadangan ${mib(recommended)}. Percubaan Light dibenarkan pada 1024 token; tutup aplikasi lain. Pemuatan masih boleh gagal jika RAM berubah." else null
        return NeuralMemoryAssessment(context, model.sizeBytes, kvPerToken * context, scratch, overhead, reserve, recommended, reason, warning)
    }
}
