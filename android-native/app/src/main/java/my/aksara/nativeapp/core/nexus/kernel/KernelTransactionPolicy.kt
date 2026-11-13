package my.aksara.nativeapp.core.nexus.kernel

/**
 * Write controls remain disabled until a concrete adapter supports scoped diff,
 * explicit approval, idempotency and rollback. This is a deliberately closed gate.
 */
internal data class KernelChangePreview(
    val capabilityId: String, val target: String,
    val summary: String, val diffSha256: String
)
internal object KernelTransactionPolicy {
    fun mayExecuteWrite(capability: KernelCapability, preview: KernelChangePreview?): Boolean {
        // No write adapter is implemented by the Nexus kernel in this release.
        // Never interpret a preview alone as approval or permission.
        return false
    }
    fun describesRisk(capability: KernelCapability): String = when (capability.risk) {
        KernelRisk.READ -> "Read-only"
        KernelRisk.WRITE_LOCAL -> "Local write: disabled until verified transaction support"
        KernelRisk.WRITE_REMOTE -> "Remote write: disabled until verified transaction support"
    }
}
