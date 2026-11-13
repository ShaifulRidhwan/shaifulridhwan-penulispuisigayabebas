package my.aksara.nativeapp.core.linux

import android.content.Context
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.BufferedOutputStream
import java.io.File
import java.nio.file.Files
import java.util.UUID
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

/** Import/export via user-chosen SAF documents, never broad storage permission. */
internal data class VaultResult(val files: Int, val bytes: Long, val location: String)
internal object LinuxVaultPaths {
    private val blocked = setOf(".ssh", ".gnupg", ".aws", ".kube",
        ".npmrc", ".env", ".git-credentials", "credentials", "id_rsa",
        "id_ed25519", "id_ecdsa")

    fun safeRelative(relative: String): Boolean {
        if (relative.isBlank() || relative.startsWith("/") ||
            relative.contains('\\') || relative.contains('\u0000')) return false
        val segments = relative.split('/')
        if (segments.any { it.isEmpty() || it == "." || it == ".." }) return false
        return true
    }

    fun includeInBackup(relative: String): Boolean {
        if (!safeRelative(relative)) return false
        val parts = relative.lowercase().split('/')
        return parts.none { part ->
            part in blocked || part.startsWith(".env.") ||
                part.endsWith(".pem") || part.endsWith(".p12") ||
                part.endsWith(".key")
        } && !(parts.size >= 3 && parts.take(2) == listOf(".config", "gh"))
    }

    fun zipImportPath(name: String): String? {
        val clean = name.removeSuffix("/")
        return when {
            clean.startsWith("workspace/") -> clean.removePrefix("workspace/")
                .takeIf(::safeRelative)
            clean == "metadata/apk-world.txt" -> clean
            else -> null
        }
    }
}

internal object LinuxProjectVault {
    private const val MAX_FILES = 20_000
    private const val MAX_BYTES = 512L * 1024 * 1024
    private const val BUFFER = 64 * 1024

    suspend fun export(context: Context, uri: Uri): VaultResult = withContext(Dispatchers.IO) {
        val root = AksaraLinuxRuntime.workspace(context)
        val boundary = root.canonicalPath + File.separator
        val files = root.walkTopDown()
            .onEnter { folder ->
                folder == root || LinuxVaultPaths.includeInBackup(
                    folder.relativeTo(root).invariantSeparatorsPath)
            }
            .filter { it.isFile && !Files.isSymbolicLink(it.toPath()) }
            .filter { LinuxVaultPaths.includeInBackup(it.relativeTo(root).invariantSeparatorsPath) }
            .toList()
        require(files.size <= MAX_FILES) { "Terlalu banyak fail untuk arkib ini." }
        val total = files.sumOf { it.length() }
        require(total <= MAX_BYTES) { "Saiz fail melebihi had backup 512 MiB." }

        var count = 0
        var written = 0L
        val output = context.contentResolver.openOutputStream(uri, "w")
            ?: error("Dokumen destinasi tidak boleh ditulis.")
        ZipOutputStream(BufferedOutputStream(output)).use { zip ->
            val buffer = ByteArray(BUFFER)
            for (file in files) {
                require(!Files.isSymbolicLink(file.toPath()) &&
                    file.canonicalPath.startsWith(boundary)) { "Unsafe backup source" }
                val name = file.relativeTo(root).invariantSeparatorsPath
                zip.putNextEntry(ZipEntry("workspace/" + name))
                file.inputStream().buffered().use { input ->
                    while (true) {
                        val n = input.read(buffer)
                        if (n < 0) break
                        written += n
                        require(written <= MAX_BYTES) { "Backup melebihi had." }
                        zip.write(buffer, 0, n)
                    }
                }
                zip.closeEntry()
                count++
            }
            // Package manifest is for reproducible environment setup, never auto-installed.
            val world = File(AksaraLinuxRuntime.rootfs(context), "etc/apk/world")
            if (world.isFile && !Files.isSymbolicLink(world.toPath()) &&
                world.length() < 128L * 1024) {
                zip.putNextEntry(ZipEntry("metadata/apk-world.txt"))
                world.inputStream().use { it.copyTo(zip) }
                zip.closeEntry()
            }
        }
        VaultResult(count, written, "SAF export")
    }

    suspend fun restore(context: Context, uri: Uri): VaultResult = withContext(Dispatchers.IO) {
        val workspace = AksaraLinuxRuntime.workspace(context)
        val stage = File(context.filesDir, "linux-vault-stage-" + UUID.randomUUID())
        require(stage.mkdirs()) { "Tidak boleh menyediakan lokasi import sementara." }
        var count = 0
        var written = 0L
        try {
            val input = context.contentResolver.openInputStream(uri)
                ?: error("Dokumen arkib tidak boleh dibaca.")
            ZipInputStream(input.buffered()).use { zip ->
                val buffer = ByteArray(BUFFER)
                while (true) {
                    val item = zip.nextEntry ?: break
                    val name = item.name
                    val relative = LinuxVaultPaths.zipImportPath(name)
                        ?: error("Arkib mengandungi laluan tidak dibenarkan: " + name.take(80))
                    val dst = File(stage, relative)
                    require(dst.canonicalPath.startsWith(stage.canonicalPath + File.separator)) {
                        "Arkib cuba mengakses direktori di luar workspace."
                    }
                    if (item.isDirectory) {
                        require(dst.isDirectory || dst.mkdirs())
                    } else {
                        require(!dst.exists()) { "Arkib mempunyai nama fail berganda." }
                        require(dst.parentFile?.isDirectory == true ||
                            dst.parentFile?.mkdirs() == true)
                        count++
                        require(count <= MAX_FILES) { "Terlalu banyak fail dalam arkib." }
                        dst.outputStream().use { output ->
                            while (true) {
                                val n = zip.read(buffer)
                                if (n < 0) break
                                written += n
                                require(written <= MAX_BYTES) {
                                    "Arkib melebihi had import 512 MiB."
                                }
                                output.write(buffer, 0, n)
                            }
                        }
                    }
                    zip.closeEntry()
                }
            }
            require(count > 0) { "Arkib tiada fail yang boleh dipulihkan." }
            // Never replace an existing workspace entry or restore private SSH keys.
            val destination = File(workspace, "vault-import-" + UUID.randomUUID().toString().take(8))
            require(!destination.exists())
            require(stage.renameTo(destination)) { "Tidak dapat mengaktifkan folder import." }
            VaultResult(count, written, "/workspace/" + destination.name)
        } finally {
            if (stage.exists()) stage.deleteRecursively()
        }
    }
}
