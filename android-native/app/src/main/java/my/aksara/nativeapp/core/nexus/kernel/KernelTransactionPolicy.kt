package my.aksara.nativeapp.core.nexus.kernel

/**
 * Write actions are available by explicit human review. A preview alone is not
 * an authorization token. No unrestricted model-to-shell execution is provided.
 */
internal enum class KernelWriteOperation { UPSERT, DELETE, ROLLBACK }
internal data class KernelChangePreview(
    val capabilityId: String,
    val target: String,
    val summary: String,
    val diffSha256: String,
    val operation: KernelWriteOperation = KernelWriteOperation.UPSERT,
    val token: String = "",
    val beforeSha256: String = "",
    val afterSha256: String = "",
    val details: String = ""
)

internal object KernelTransactionPolicy {
    /**
     * True only for a capability with the matching type, nonblank one-shot token
     * and digest; the transaction executor additionally validates that the token
     * refers to its own active preview and that the file has not changed.
     */
    fun mayExecuteWrite(capability: KernelCapability, preview: KernelChangePreview?): Boolean {
        if (preview == null || capability.risk != KernelRisk.WRITE_LOCAL) return false
        if (capability.id != preview.capabilityId || preview.token.isBlank()) return false
        return preview.diffSha256.matches(Regex("[0-9a-f]{64}"))
    }

    fun describesRisk(capability: KernelCapability): String = when (capability.risk) {
        KernelRisk.READ -> "Baca sahaja"
        KernelRisk.WRITE_LOCAL -> "Tulis dalam /workspace selepas preview dan kelulusan"
        KernelRisk.WRITE_REMOTE -> "Akses jauh perlu kelulusan dan adapter yang berkenaan"
    }
}
