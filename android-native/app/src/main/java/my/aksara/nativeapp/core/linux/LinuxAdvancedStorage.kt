package my.aksara.nativeapp.core.linux

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import android.webkit.MimeTypeMap
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.nio.file.Files
import java.util.UUID

/**
 * Advanced Mode: explicit, bounded file exchange with a SAF tree selected by the
 * Android user. This NEVER bind-mounts a host path into PRoot.
 *
 * PULL: selected tree's top-level regular documents -> /workspace/android-in/batch-*
 * PUSH: /workspace/android-out regular files -> newly created documents in tree.
 *
 * No silent background sync, overwrite, deletion of source, privileged Android
 * permission, Android/data access, or shell execution.
 */
internal object LinuxAdvancedStorage {
    private const val PREFS = "aksara_linux"
    private const val KEY_TREE = "advanced_document_tree"
    private const val FILE_LIMIT = 50
    private const val FILE_BYTES = 256L * 1024 * 1024
    private const val BATCH_BYTES = 512L * 1024 * 1024
    private const val BUFFER = 64 * 1024
    private const val DIRECTORY_MIME = DocumentsContract.Document.MIME_TYPE_DIR

    data class Transfer(val count: Int, val bytes: Long, val location: String, val skipped: Int = 0)

    /** Pure policy methods are tested without Android framework resources. */
    internal object Policy {
        fun allowedGuestFile(root: File, candidate: File): Boolean =
            candidate.isFile && !Files.isSymbolicLink(candidate.toPath()) &&
                LinuxVaultPaths.includeInBackup(candidate.name) &&
                candidate.canonicalPath.startsWith(root.canonicalPath + File.separator)

        fun nextAvailable(rawName: String?, taken: Set<String>): String {
            val name = LinuxFileNames.safeName(rawName)
            var n = 0
            var value = name
            while (value in taken) {
                n++
                require(n < 1000) { "Too many duplicate filenames" }
                value = LinuxFileNames.numbered(name, n)
            }
            return value
        }
    }

    /**
     * Persist only the explicit tree selection that Android granted.
     * The private preference is not exposed to the Alpine environment.
     */
    fun connect(context: Context, uri: Uri): String {
        require(DocumentsContract.isTreeUri(uri) && uri.scheme == "content") {
            "Pilih folder menggunakan Android Folder Picker."
        }
        val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or
            Intent.FLAG_GRANT_WRITE_URI_PERMISSION
        context.contentResolver.takePersistableUriPermission(uri, flags)
        val previous = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_TREE, null)?.let(Uri::parse)
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY_TREE, uri.toString()).apply()
        if (previous != null && previous != uri) {
            runCatching { context.contentResolver.releasePersistableUriPermission(previous, flags) }
        }
        return folderName(context, uri)
    }

    fun disconnect(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val uri = prefs.getString(KEY_TREE, null)?.let(Uri::parse)
        prefs.edit().remove(KEY_TREE).apply()
        if (uri != null) runCatching {
            context.contentResolver.releasePersistableUriPermission(
                uri, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        }
    }

    fun connectedName(context: Context): String? =
        runCatching { requireTree(context).let { folderName(context, it) } }.getOrNull()

    private fun requireTree(context: Context): Uri {
        val pref = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_TREE, null) ?: error("Pilih folder Android melalui ADVANCED > FOLDER.")
        val uri = Uri.parse(pref)
        val granted = context.contentResolver.persistedUriPermissions.any {
            it.uri == uri && it.isReadPermission && it.isWritePermission
        }
        require(granted && DocumentsContract.isTreeUri(uri)) {
            "Akses folder tamat atau dibatalkan. Pilih semula folder Android."
        }
        return uri
    }

    private fun rootDocument(uri: Uri): Uri =
        DocumentsContract.buildDocumentUriUsingTree(uri, DocumentsContract.getTreeDocumentId(uri))

    private fun folderName(context: Context, tree: Uri): String {
        val root = rootDocument(tree)
        return context.contentResolver.query(root,
            arrayOf(DocumentsContract.Document.COLUMN_DISPLAY_NAME),
            null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) cursor.getString(0) else null
        }?.take(64) ?: "Folder dipilih"
    }

    private data class Entry(val uri: Uri, val name: String, val mime: String)

    private fun children(context: Context, tree: Uri): List<Entry> {
        val rootId = DocumentsContract.getTreeDocumentId(tree)
        val listing = DocumentsContract.buildChildDocumentsUriUsingTree(tree, rootId)
        val columns = arrayOf(
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE
        )
        val found = ArrayList<Entry>()
        context.contentResolver.query(listing, columns, null, null, null)?.use { cursor ->
            while (cursor.moveToNext()) {
                require(found.size < 2000) { "Folder mengandungi terlalu banyak entri." }
                val id = cursor.getString(0)
                val name = cursor.getString(1) ?: "untitled"
                val mime = cursor.getString(2) ?: "application/octet-stream"
                found.add(Entry(
                    DocumentsContract.buildDocumentUriUsingTree(tree, id), name, mime))
            }
        } ?: error("Android Folder Provider tidak menyediakan senarai fail.")
        return found
    }

    /**
     * A PULL is a fresh immutable batch. Never changes the chosen Android files
     * or existing guest workspace content. Subfolders are deliberately skipped.
     */
    suspend fun pull(context: Context): Transfer = withContext(Dispatchers.IO) {
        val tree = requireTree(context)
        val chosen = children(context, tree)
        val docs = chosen.filter { it.mime != DIRECTORY_MIME }
        val skipped = chosen.size - docs.size
        require(docs.isNotEmpty()) { "Folder tidak mempunyai fail aras pertama untuk diimport." }
        require(docs.size <= FILE_LIMIT) { "Maksimum 50 fail setiap PULL." }

        val stage = File(context.filesDir, "linux-advanced-stage-" + UUID.randomUUID())
        require(stage.mkdir()) { "Tidak dapat menyediakan ruang sementara." }
        var sum = 0L
        var count = 0
        val names = HashSet<String>()
        try {
            for (doc in docs) {
                val name = Policy.nextAvailable(doc.name, names)
                names.add(name)
                val output = File(stage, name)
                require(output.createNewFile())
                var current = 0L
                val source = context.contentResolver.openInputStream(doc.uri)
                    ?: error("Tidak dapat membaca dokumen Android: $name")
                source.buffered().use { input ->
                    output.outputStream().buffered().use { sink ->
                        val buffer = ByteArray(BUFFER)
                        while (true) {
                            val read = input.read(buffer)
                            if (read < 0) break
                            if (read == 0) continue
                            current += read
                            sum += read
                            require(current <= FILE_BYTES && sum <= BATCH_BYTES) {
                                "Had transfer: 256 MiB/fail, 512 MiB/kumpulan."
                            }
                            sink.write(buffer, 0, read)
                        }
                    }
                }
                count++
            }
            val workspace = AksaraLinuxRuntime.workspace(context)
            require(!Files.isSymbolicLink(workspace.toPath()))
            val inbox = File(workspace, "android-in")
            require(!Files.isSymbolicLink(inbox.toPath()))
            require(inbox.isDirectory || inbox.mkdirs())
            require(inbox.canonicalPath == File(workspace.canonicalFile, "android-in").path)
            val batch = File(inbox, "batch-" + UUID.randomUUID().toString().take(8))
            require(stage.renameTo(batch)) { "Tidak dapat memuktamadkan import." }
            Transfer(count, sum, "/workspace/android-in/" + batch.name, skipped)
        } finally {
            if (stage.exists()) stage.deleteRecursively()
        }
    }

    /**
     * PUSH creates new Android documents. Never overwrites existing filenames,
     * and only reads ordinary files in the root of the guest outbox.
     * If a provider write fails, delete only the newly created partial document.
     */
    suspend fun push(context: Context): Transfer = withContext(Dispatchers.IO) {
        val tree = requireTree(context)
        val workspace = AksaraLinuxRuntime.workspace(context)
        require(!Files.isSymbolicLink(workspace.toPath()))
        val outbox = File(workspace, "android-out")
        require(!Files.isSymbolicLink(outbox.toPath()))
        require(outbox.isDirectory || outbox.mkdirs()) { "Tidak boleh mencipta /workspace/android-out." }
        require(outbox.canonicalPath == File(workspace.canonicalFile, "android-out").path)
        val all = outbox.listFiles() ?: error("Tidak boleh membaca /workspace/android-out.")
        val files = all.filter { Policy.allowedGuestFile(outbox, it) }
        val skipped = all.size - files.size
        require(files.isNotEmpty()) { "Letakkan fail dalam /workspace/android-out sebelum PUSH." }
        require(files.size <= FILE_LIMIT) { "Maksimum 50 fail setiap PUSH." }
        val existing = children(context, tree).map { it.name }.toMutableSet()
        val root = rootDocument(tree)
        var sum = 0L
        var transferred = 0
        for (file in files) {
            require(file.length() <= FILE_BYTES && sum + file.length() <= BATCH_BYTES) {
                "Had transfer: 256 MiB/fail, 512 MiB/kumpulan."
            }
            val name = Policy.nextAvailable(file.name, existing)
            existing.add(name)
            val type = mimeType(name)
            val newUri = DocumentsContract.createDocument(context.contentResolver, root, type, name)
                ?: error("Folder Android menolak penciptaan fail: $name")
            try {
                val target = context.contentResolver.openOutputStream(newUri, "w")
                    ?: error("Tidak dapat menulis fail Android: $name")
                file.inputStream().buffered().use { input ->
                    target.buffered().use { output ->
                        val buffer = ByteArray(BUFFER)
                        while (true) {
                            val size = input.read(buffer)
                            if (size < 0) break
                            if (size == 0) continue
                            sum += size
                            require(sum <= BATCH_BYTES) { "Had kumpulan eksport dicapai." }
                            output.write(buffer, 0, size)
                        }
                    }
                }
                transferred++
            } catch (error: Exception) {
                runCatching { DocumentsContract.deleteDocument(context.contentResolver, newUri) }
                throw error
            }
        }
        Transfer(transferred, sum, folderName(context, tree), skipped)
    }

    private fun mimeType(name: String): String {
        val extension = name.substringAfterLast('.', "").lowercase()
        return when (extension) {
            "py", "lrc", "md", "txt", "json", "js", "sh", "csv", "log" -> "text/plain"
            "mp3" -> "audio/mpeg"
            "wav" -> "audio/wav"
            "zip" -> "application/zip"
            else -> MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension)
                ?: "application/octet-stream"
        }
    }
}
