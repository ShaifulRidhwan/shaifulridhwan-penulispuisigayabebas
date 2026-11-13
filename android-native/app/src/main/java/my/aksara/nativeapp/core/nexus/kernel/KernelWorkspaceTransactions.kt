package my.aksara.nativeapp.core.nexus.kernel

import java.io.File
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import java.util.UUID
import org.json.JSONObject

/**
 * Explicit workspace edit transaction. No arbitrary shell is sent from a model.
 * The user can still use the unrestricted existing Linux terminal separately.
 */
internal class KernelWorkspaceTransactions(workspace: File, private val privateDir: File) {
    private val root = workspace.absoluteFile.normalize()
    private val receiptFile = File(privateDir, "ank-workspace-receipt.json")
    private val backupFile = File(privateDir, "ank-workspace-previous.bin")
    private val previewLimit = 2 * 1024 * 1024
    private data class Pending(
        val preview: KernelChangePreview, val oldHash: String,
        val newBytes: ByteArray?, val oldBytes: ByteArray?, val existed: Boolean
    )
    private var pending: Pending? = null

    init {
        require(root.isDirectory || root.mkdirs())
        require(privateDir.isDirectory || privateDir.mkdirs())
    }

    private fun target(path: String): File {
        require(path.length in 1..220 && !path.startsWith("/") && !path.contains('\\'))
        val pieces = path.split('/')
        require(pieces.all { part ->
            part.isNotBlank() && part != "." && part != ".." && part.length <= 120 &&
                part.none { Character.isISOControl(it) }
        }) { "Path mesti relatif kepada /workspace, tanpa traversal" }
        require(!Files.isSymbolicLink(root.toPath()))
        var cursor = root
        for (piece in pieces) {
            cursor = File(cursor, piece)
            require(!Files.isSymbolicLink(cursor.toPath())) { "Symlink tidak dibenarkan" }
        }
        require(cursor.toPath().normalize().startsWith(root.toPath()) && cursor != root)
        require(!cursor.isDirectory)
        return cursor
    }

    private fun read(file: File): ByteArray? {
        if (!file.exists()) return null
        require(file.isFile && !Files.isSymbolicLink(file.toPath()))
        require(file.length() <= previewLimit) {
            "Preview hanya fail teks sehingga 2 MiB; terminal Linux masih bebas"
        }
        return file.readBytes()
    }

    private fun sha(bytes: ByteArray?): String =
        MessageDigest.getInstance("SHA-256")
            .digest((if (bytes == null) byteArrayOf(0) else byteArrayOf(1)) +
                (bytes ?: byteArrayOf()))
            .joinToString("") { "%02x".format(it) }

    private fun buildPreview(
        path: String, type: KernelWriteOperation, newBytes: ByteArray?
    ): KernelChangePreview {
        val file = target(path)
        require(newBytes == null || newBytes.size <= previewLimit)
        val oldBytes = read(file)
        if (type == KernelWriteOperation.DELETE) require(oldBytes != null) {
            "Fail tidak wujud"
        }
        val before = sha(oldBytes)
        val after = sha(newBytes)
        val digest = sha((path + ":" + type.name + ":" + before + ":" + after)
            .toByteArray(Charsets.UTF_8))
        val details = buildString {
            append("/workspace/").append(path).append("\n")
            append(type.name).append(" · ").append(oldBytes?.size ?: 0)
                .append(" B -> ").append(newBytes?.size ?: 0).append(" B")
            append("\nAsal: ").append(before.take(16)).append("\nBaharu: ").append(after.take(16))
            if (oldBytes != null && oldBytes.size < 1100) {
                append("\n\n--- ASAL ---\n").append(oldBytes.toString(Charsets.UTF_8))
            }
            if (newBytes != null && newBytes.size < 1100) {
                append("\n\n+++ BAHARU +++\n").append(newBytes.toString(Charsets.UTF_8))
            }
        }
        val preview = KernelChangePreview(
            "linux.workspace.write", path, "Edit fail dalam /workspace",
            digest, type, UUID.randomUUID().toString(), before, after, details.take(4000))
        pending = Pending(preview, before, newBytes?.clone(), oldBytes?.clone(), oldBytes != null)
        return preview
    }

    /** Explicit user opt-in is required by UI before this data is shared with A.I. */
    @Synchronized fun textForAi(path: String): String {
        val bytes = read(target(path)) ?: return ""
        require(bytes.size <= 14_000) { "Fail terlalu besar untuk cadangan A.I." }
        require(!bytes.contains(0.toByte())) { "Fail binari tidak boleh dihantar untuk suntingan teks A.I." }
        return bytes.toString(Charsets.UTF_8)
    }

    @Synchronized fun previewUpsert(path: String, text: String): KernelChangePreview =
        buildPreview(path, KernelWriteOperation.UPSERT, text.toByteArray(Charsets.UTF_8))

    @Synchronized fun previewDelete(path: String): KernelChangePreview =
        buildPreview(path, KernelWriteOperation.DELETE, null)

    private fun move(staged: File, destination: File) {
        try {
            Files.move(staged.toPath(), destination.toPath(),
                StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
        } catch (_: java.nio.file.AtomicMoveNotSupportedException) {
            Files.move(staged.toPath(), destination.toPath(), StandardCopyOption.REPLACE_EXISTING)
        }
    }

    private fun apply(target: File, bytes: ByteArray?) {
        if (bytes == null) {
            require(!target.exists() || target.delete()) { "Gagal memadam fail" }
            return
        }
        require(target.parentFile?.isDirectory == true || target.parentFile?.mkdirs() == true)
        val staged = File.createTempFile(".ank-staged-", ".tmp", target.parentFile)
        try {
            staged.writeBytes(bytes)
            move(staged, target)
        } finally { staged.delete() }
    }

    private fun receipt(): KernelTransactionReceipt? = runCatching {
        val obj = JSONObject(receiptFile.readText(Charsets.UTF_8))
        KernelTransactionReceipt(
            obj.getString("path"), obj.getBoolean("existed"), obj.getString("before"),
            obj.getString("after"), obj.getLong("at"), obj.getString("action"))
    }.getOrNull()

    private fun saveReceipt(row: KernelTransactionReceipt) {
        val json = JSONObject().put("path", row.path).put("existed", row.wasPresent)
            .put("before", row.beforeSha256).put("after", row.afterSha256)
            .put("at", row.completedAt).put("action", row.action).toString()
        val staged = File.createTempFile(".ank-receipt-", ".tmp", privateDir)
        try {
            staged.writeText(json, Charsets.UTF_8)
            move(staged, receiptFile)
        } finally { staged.delete() }
    }

    /**
     * Only a preview returned by this exact transaction instance can be committed.
     * Content and file identity are revalidated immediately before the write.
     */
    @Synchronized fun commit(approval: KernelChangePreview): KernelTransactionReceipt {
        val selected = pending ?: error("Tiada preview menunggu kelulusan")
        require(selected.preview === approval) { "Preview sudah berubah" }
        require(KernelTransactionPolicy.mayExecuteWrite(
            KernelCapability("linux.workspace.write", "alpine-workspace", KernelRisk.WRITE_LOCAL),
            approval)) { "Kelulusan transaksi tidak sah" }
        pending = null
        val destination = target(approval.target)
        require(sha(read(destination)) == selected.oldHash) {
            "Fail sudah berubah sejak preview. Bina preview baharu."
        }
        val row = KernelTransactionReceipt(
            approval.target, selected.existed, selected.oldHash, approval.afterSha256,
            System.currentTimeMillis(), approval.operation.name)
        val stagedBackup = File.createTempFile(".ank-backup-", ".tmp", privateDir)
        try {
            stagedBackup.writeBytes(selected.oldBytes ?: byteArrayOf())
            move(stagedBackup, backupFile)
            // A newly-created parent must not be a symlink.
            val parent = destination.parentFile ?: error("Folder tiada")
            require(parent.isDirectory || parent.mkdirs())
            target(approval.target)
            apply(destination, selected.newBytes)
            saveReceipt(row)
            return row
        } catch (failure: Exception) {
            runCatching { apply(destination, if (selected.existed) selected.oldBytes else null) }
            throw failure
        } finally { stagedBackup.delete() }
    }

    @Synchronized fun previewRollback(): KernelChangePreview? {
        val row = receipt() ?: return null
        if (!backupFile.isFile || backupFile.length() > previewLimit) return null
        val destination = target(row.path)
        if (sha(read(destination)) != row.afterSha256) return null
        val original = if (row.wasPresent) backupFile.readBytes() else null
        if (sha(original) != row.beforeSha256) return null
        return buildPreview(row.path, KernelWriteOperation.ROLLBACK, original)
    }

    @Synchronized fun clearPreview() { pending = null }
}

internal data class KernelTransactionReceipt(
    val path: String, val wasPresent: Boolean, val beforeSha256: String,
    val afterSha256: String, val completedAt: Long, val action: String
)
