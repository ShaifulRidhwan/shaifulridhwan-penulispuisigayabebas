package my.aksara.nativeapp.core.linux

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.nio.file.Files
import java.util.UUID

/**
 * Explicit Android SAF -> Alpine /workspace bridge.
 *
 * The Linux guest never receives a host storage path or Android URI. Android
 * copies only user-selected documents into the existing PRoot-bound workspace.
 * A complete batch becomes visible only after all streams are copied.
 */
internal data class LinuxFileImportResult(
    val count: Int,
    val bytes: Long,
    val guestDirectory: String,
    val fileNames: List<String>
)

internal object LinuxFileNames {
    fun safeName(displayName: String?): String {
        val leaf = displayName.orEmpty().replace('\\', '/').substringAfterLast('/')
        val clean = leaf.map { char ->
            when {
                char.isLetterOrDigit() || char in "._-() " -> char
                else -> '_'
            }
        }.joinToString("").trim(' ', '.').take(96).trimEnd(' ', '.')
        return clean.ifEmpty { "imported-file" }
    }

    fun numbered(name: String, index: Int): String {
        require(index >= 0)
        if (index == 0) return name
        val dot = name.lastIndexOf('.')
        val base = if (dot > 0) name.substring(0, dot) else name
        val extension = if (dot > 0) name.substring(dot) else ""
        return base.take(80) + "-" + index + extension
    }
}

internal object LinuxFileBridge {
    private const val MAX_FILES = 20
    private const val MAX_FILE_BYTES = 256L * 1024 * 1024
    private const val MAX_BATCH_BYTES = 512L * 1024 * 1024
    private const val BUFFER_SIZE = 64 * 1024

    suspend fun importDocuments(context: Context, uris: List<Uri>): LinuxFileImportResult =
        withContext(Dispatchers.IO) {
            require(uris.isNotEmpty()) { "Tiada fail dipilih." }
            require(uris.size <= MAX_FILES) { "Maksimum 20 fail untuk satu import." }
            require(uris.all { it.scheme == "content" }) {
                "Hanya dokumen yang dipilih melalui Android File Picker dibenarkan."
            }

            val workspace = AksaraLinuxRuntime.workspace(context)
            require(!Files.isSymbolicLink(workspace.toPath())) {
                "Workspace tidak boleh berupa symbolic link."
            }
            val imports = File(workspace, "imports")
            require(!Files.isSymbolicLink(imports.toPath())) {
                "Import directory is an unsafe symbolic link."
            }
            require(imports.isDirectory || imports.mkdirs()) {
                "Tidak dapat mencipta direktori /workspace/imports."
            }
            require(imports.canonicalPath == File(workspace.canonicalFile, "imports").path) {
                "Laluan import tidak selamat."
            }

            // Stage outside the guest mount. A failed/partial batch never becomes visible.
            val stage = File(context.filesDir, "linux-bridge-stage-" + UUID.randomUUID())
            require(stage.mkdir()) { "Tidak dapat menyediakan fail sementara." }

            var total = 0L
            val saved = mutableListOf<String>()
            try {
                for (uri in uris) {
                    val name = LinuxFileNames.safeName(documentName(context, uri))
                    var index = 0
                    var unique = LinuxFileNames.numbered(name, index)
                    while (File(stage, unique).exists()) {
                        index++
                        require(index <= 999) { "Terlalu banyak nama fail yang sama." }
                        unique = LinuxFileNames.numbered(name, index)
                    }

                    val destination = File(stage, unique)
                    require(destination.createNewFile()) { "Tidak dapat mencipta fail import." }
                    var fileBytes = 0L
                    val input = context.contentResolver.openInputStream(uri)
                        ?: error("Fail Android tidak boleh dibaca.")
                    input.buffered().use { stream ->
                        destination.outputStream().buffered().use { output ->
                            val buffer = ByteArray(BUFFER_SIZE)
                            while (true) {
                                val read = stream.read(buffer)
                                if (read < 0) break
                                if (read == 0) continue
                                fileBytes += read
                                total += read
                                require(fileBytes <= MAX_FILE_BYTES) {
                                    "Had 256 MiB setiap fail telah dicapai."
                                }
                                require(total <= MAX_BATCH_BYTES) {
                                    "Had 512 MiB setiap kumpulan telah dicapai."
                                }
                                output.write(buffer, 0, read)
                            }
                        }
                    }
                    saved += unique
                }

                val dir = File(imports, "batch-" + UUID.randomUUID().toString().take(8))
                require(!Files.exists(dir.toPath())) { "Direktori import sudah wujud." }
                require(stage.renameTo(dir)) {
                    "Gagal mengaktifkan kumpulan import tanpa mengubah fail sedia ada."
                }
                LinuxFileImportResult(
                    count = saved.size,
                    bytes = total,
                    guestDirectory = "/workspace/imports/" + dir.name,
                    fileNames = saved.toList()
                )
            } finally {
                if (stage.exists()) stage.deleteRecursively()
            }
        }

    private fun documentName(context: Context, uri: Uri): String? = runCatching {
        context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
            ?.use { cursor ->
                val column = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (column >= 0 && cursor.moveToFirst()) cursor.getString(column) else null
            }
    }.getOrNull() ?: uri.lastPathSegment
}
