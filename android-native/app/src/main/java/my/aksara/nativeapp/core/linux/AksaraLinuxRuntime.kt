package my.aksara.nativeapp.core.linux

import android.content.Context
import android.os.Build
import android.util.Log
import android.system.Os
import android.system.ErrnoException
import android.system.OsConstants
import com.termux.terminal.TerminalSession
import com.termux.terminal.TerminalSessionClient
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import java.io.File
import java.io.FileOutputStream
import java.nio.file.Files
import java.security.DigestInputStream
import java.security.MessageDigest
import java.util.zip.GZIPInputStream

/**
 * Alpine ARM64 userland installed inside Aksara's private directory.
 * PRoot provides path translation, not Android root privileges.
 *
 * The package is staged by the PR321 CI from official Alpine minirootfs
 * with a SHA-256 validation step. Android target SDK 29+ normally forbids
 * executing freshly installed userland binaries; the isolated debug
 * preview has its own documented compatibility gate.
 */
data class LinuxInstallProgress(
    val percent: Int,
    val stage: String,
    val filesDone: Int = 0,
    val filesTotal: Int = 0
)

internal object AksaraLinuxRuntime {
    const val alpineVersion = "3.22.8"
    // .bundle avoids aapt's special .gz asset transformation.
    private const val archive = "linux/alpine-minirootfs.bundle"
    private const val checksum = "linux/alpine-minirootfs.sha256"
    private const val entriesManifest = "linux/alpine-minirootfs.entries"
    private const val marker = ".aksara-alpine-installed"
    private const val imageRevision = "3.22.8-v3-full-devkit"
    private const val maxEntries = 250_000
    private const val maxUncompressedBytes = 4L * 1024 * 1024 * 1024

    fun rootfs(context: Context): File = File(context.filesDir, "alpine-arm64")
    fun workspace(context: Context): File =
        File(context.filesDir, "linux-workspace").apply { mkdirs() }
    fun proot(context: Context): File =
        File(context.applicationInfo.nativeLibraryDir, "libaksara_proot.so")
    fun loader(context: Context): File =
        File(context.applicationInfo.nativeLibraryDir, "libaksara_proot_loader.so")

    fun bundled(context: Context): Boolean {
        val names = runCatching { context.assets.list("linux")?.toList().orEmpty() }.getOrDefault(emptyList())
        return Build.SUPPORTED_ABIS.contains("arm64-v8a") &&
            proot(context).isFile && loader(context).isFile &&
            "alpine-minirootfs.bundle" in names &&
            "alpine-minirootfs.sha256" in names &&
            "alpine-minirootfs.entries" in names
    }

    fun installed(context: Context): Boolean {
        val root = rootfs(context)
        return bundled(context) &&
            runCatching { File(root, marker).readText().trim() == imageRevision }.getOrDefault(false) &&
            LinuxRootfsVerifier.hasRequiredCommands(root) &&
            listOf("usr/bin/git", "usr/bin/python3", "usr/bin/gcc", "usr/bin/g++",
                "usr/bin/clang", "usr/bin/node", "usr/bin/rustc", "usr/bin/go")
                .all { relative ->
                    val path = File(root, relative).toPath()
                    Files.isRegularFile(path, java.nio.file.LinkOption.NOFOLLOW_LINKS) ||
                        Files.isSymbolicLink(path)
                }
    }

    /**
     * Called by an explicit install button, never automatically during app
     * startup. All work MUST run on Dispatchers.IO.
     */
    fun install(
        context: Context,
        onProgress: (LinuxInstallProgress) -> Unit = {}
    ) {
        require(bundled(context)) {
            "Bundle Alpine ARM64 atau PRoot belum disertakan dalam APK ini."
        }
        if (installed(context)) return
        // A revision mismatch is NOT permission to erase the owner's Linux files.
        require(!rootfs(context).exists()) {
            "Rootfs Alpine lama dikesan. Backup dan migrasi manual diperlukan; " +
                "fail/pakej lama tidak akan dipadam."
        }

        onProgress(LinuxInstallProgress(0, "Menyediakan ruang Linux"))
        val target = rootfs(context)
        val staging = File(context.filesDir, "alpine-arm64.installing")
        if (staging.exists()) require(staging.deleteRecursively()) { "Tidak dapat membersihkan pemasangan lama." }
        require(staging.mkdirs()) { "Tidak dapat menyediakan storan Linux." }

        try {
            val expected = context.assets.open(checksum).bufferedReader().use {
                it.readLine().trim().split(Regex("\\s+")).first().lowercase()
            }
            require(expected.matches(Regex("[0-9a-f]{64}"))) { "Checksum Alpine tidak sah." }
            val totalEntries = context.assets.open(entriesManifest).bufferedReader().use {
                it.readLine().trim().toInt()
            }
            require(totalEntries in 1..maxEntries) { "Manifest kemajuan Alpine tidak sah." }
            onProgress(LinuxInstallProgress(4, "Mengekstrak Alpine ARM64", 0, totalEntries))
            var lastReportedPercent = 4
            val sha = MessageDigest.getInstance("SHA-256")
            val pendingSymlinks = mutableListOf<Pair<File, String>>()
            val pendingHardlinks = mutableListOf<Pair<File, String>>()
            val stagingCanonical = staging.canonicalPath + File.separator
            var count = 0
            var uncompressed = 0L

            context.assets.open(archive).buffered().use { source ->
                DigestInputStream(source, sha).use { digestStream ->
                    GZIPInputStream(digestStream).use { gzip ->
                        TarArchiveInputStream(gzip).use { tar ->
                            // Reuse one buffer across every entry. A full developer image can
                            // contain hundreds of thousands of files; do not allocate per-file.
                            val buffer = ByteArray(64 * 1024)
                            while (true) {
                                val entry = tar.nextTarEntry ?: break
                                count++
                                require(count <= maxEntries) { "Terlalu banyak fail dalam arkib Linux." }
                                val path = entry.name.removePrefix("./").trimStart('/')
                                if (path.isBlank() || path == ".") continue
                                val file = File(staging, path)
                                require(file.canonicalPath.startsWith(stagingCanonical)) {
                                    "Laluan arkib berada di luar direktori Linux."
                                }
                                when {
                                    entry.isDirectory -> require(file.isDirectory || file.mkdirs()) {
                                        "Tidak dapat mencipta direktori Linux."
                                    }
                                    entry.isSymbolicLink -> pendingSymlinks += file to entry.linkName
                                    entry.isLink -> pendingHardlinks += file to entry.linkName
                                    entry.isFile -> {
                                        require(file.parentFile?.mkdirs() == true || file.parentFile?.isDirectory == true)
                                        FileOutputStream(file).use { output ->
                                            while (true) {
                                                val read = tar.read(buffer)
                                                if (read < 0) break
                                                output.write(buffer, 0, read)
                                                uncompressed += read
                                                require(uncompressed <= maxUncompressedBytes) {
                                                    "Saiz pemasangan melebihi had."
                                                }
                                            }
                                        }
                                        if ((entry.mode and 73) != 0) file.setExecutable(true, false)
                                    }
                                }
                                // Count entries as the extractor completes them, not when it opens them.
                                // Emit at most one UI update per percentage point.
                                val percent = (4L + count * 81L / totalEntries)
                                    .coerceIn(4L, 85L).toInt()
                                if (percent > lastReportedPercent) {
                                    lastReportedPercent = percent
                                    onProgress(LinuxInstallProgress(
                                        percent, "Mengekstrak Alpine ARM64", count, totalEntries
                                    ))
                                }
                            }
                        }
                    }
                }
            }
            require(count == totalEntries) { "Manifest Alpine tidak sepadan dengan arkib." }
            onProgress(LinuxInstallProgress(87, "Mengesahkan SHA-256", count, totalEntries))
            val actual = sha.digest().joinToString("") { "%02x".format(it) }
            require(actual == expected) { "SHA-256 Alpine tidak sepadan." }

            // Apply links only after regular files to avoid traversing links
            // while processing archive paths.
            onProgress(LinuxInstallProgress(90, "Memulihkan pautan fail", count, totalEntries))
            for ((file, link) in pendingHardlinks) {
                val source = File(staging, link.removePrefix("./").trimStart('/'))
                require(source.canonicalPath.startsWith(stagingCanonical) && source.isFile)
                file.parentFile?.mkdirs()
                // SELinux may reject hardlinks in app-private storage even under fake-root.
                // For initial rootfs extraction, fall back to a copy with execute bits.
                try {
                    Os.link(source.absolutePath, file.absolutePath)
                } catch (failure: ErrnoException) {
                    if (failure.errno !in listOf(
                            OsConstants.EPERM, OsConstants.EACCES,
                            OsConstants.ENOSYS, OsConstants.EOPNOTSUPP
                        )
                    ) throw failure
                    Files.copy(source.toPath(), file.toPath())
                    if (source.canExecute()) file.setExecutable(true, false)
                }
            }
            for ((file, link) in pendingSymlinks) {
                file.parentFile?.mkdirs()
                require(!file.exists()) { "Arkib mempunyai laluan pautan berganda." }
                Os.symlink(link, file.absolutePath)
            }
            onProgress(LinuxInstallProgress(96, "Menyediakan konfigurasi Linux", count, totalEntries))
            val missing = LinuxRootfsVerifier.missingRequiredCommands(staging)
            require(missing.isEmpty()) {
                "Pemasangan Alpine tidak lengkap: " + missing.joinToString(", ") +
                    " tiada sebagai fail atau symbolic link."
            }
            // Install once, without modifying any user-created shell profiles.
            installShellIdentity(staging)
            installLinuxExtras(context, staging)
            // An absolute guest symlink must not be followed in Android's
            // host namespace when writing a resolver configuration.
            val resolv = File(staging, "etc/resolv.conf")
            if (Files.isSymbolicLink(resolv.toPath())) Files.delete(resolv.toPath())
            require(resolv.parentFile.isDirectory || resolv.parentFile.mkdirs())
            resolv.writeText("nameserver 1.1.1.1\nnameserver 8.8.8.8\n")
            val guestTmp = File(staging, "tmp")
            require(guestTmp.isDirectory || guestTmp.mkdirs()) { "Cannot create guest /tmp" }
            Os.chmod(guestTmp.absolutePath, 0x3ff) // 01777 sticky directory
            File(staging, marker).writeText(imageRevision + "\n")
            onProgress(LinuxInstallProgress(99, "Mengaktifkan Linux", count, totalEntries))
            require(!target.exists()) {
            "Rootfs wujud semasa install; aktivasi dibatalkan tanpa overwrite."
        }
            require(staging.renameTo(target)) { "Tidak dapat mengaktifkan rootfs Linux." }
            onProgress(LinuxInstallProgress(100, "Alpine sedia digunakan", count, totalEntries))
        } catch (failure: Exception) {
            staging.deleteRecursively()
            throw failure
        }
    }


    /**
     * Idempotent shell-only cosmetic hook. Alpine login /etc/profile sources
     * shell scripts under /etc/profile.d. Never overwrite a user's existing file or create
     * profiles outside the guest rootfs.
     */
    private fun installShellIdentity(root: File) {
        val file = File(root, LinuxShellIdentity.relativePath)
        val dir = file.parentFile ?: return
        val rootPath = root.canonicalPath + File.separator
        require(dir.canonicalPath.startsWith(rootPath)) { "Linux profile directory escaped rootfs" }
        if (!dir.isDirectory) require(dir.mkdirs()) { "Cannot create Alpine profile directory" }
        if (file.exists() || Files.isSymbolicLink(file.toPath())) return
        val staging = File.createTempFile(".aksara-prompt-", ".tmp", dir)
        try {
            staging.writeText(LinuxShellIdentity.profile, Charsets.UTF_8)
            if (!file.exists() && !staging.renameTo(file)) {
                error("Cannot install Alpine profile")
            }
        } finally {
            if (staging.exists()) staging.delete()
        }
    }

    /** Optional in-guest utilities; user modifications are never overwritten. */
    private fun installLinuxExtras(context: Context, root: File) {
        val scripts = listOf(
            "linux/terminal-theme.sh" to "etc/profile.d/zz-aksara-theme.sh",
            "linux/aksara-doctor.sh" to "usr/local/bin/aksara-doctor",
            "linux/aksara-capabilities.sh" to "usr/local/bin/aksara-capabilities",
            "linux/aksara-share.sh" to "usr/local/bin/aksara-share"
        )
        for ((asset, relative) in scripts) {
            val file = File(root, relative)
            val parent = file.parentFile ?: error("Linux directory missing")
            require(parent.canonicalPath.startsWith(root.canonicalPath + File.separator)) {
                "Unsafe Linux script destination"
            }
            require(parent.isDirectory || parent.mkdirs()) { "Cannot create Linux script directory" }
            if (file.exists() || Files.isSymbolicLink(file.toPath())) continue
            val temp = File.createTempFile(".aksara-v4-", ".tmp", parent)
            try {
                context.assets.open(asset).use { input ->
                    temp.outputStream().use { output -> input.copyTo(output) }
                }
                temp.setExecutable(true, false)
                if (!file.exists()) require(temp.renameTo(file)) { "Failed to activate Linux script" }
            } finally { if (temp.exists()) temp.delete() }
        }
    }

    fun createSession(context: Context, client: TerminalSessionClient): TerminalSession {
        require(installed(context)) { "Alpine belum dipasang atau belum disahkan." }
        // The old V1 rootfs was installed before this non-destructive identity hook.
        runCatching {
            installShellIdentity(rootfs(context))
            installLinuxExtras(context, rootfs(context))
        }.onFailure { Log.w("AksaraLinuxRuntime", "Optional Linux setup scripts failed", it) }
        val workspace = workspace(context)
        val root = rootfs(context)
        val binary = proot(context)
        // Keep link2symlink backing files in a private, non-symlink directory.
        val l2s = File(root, ".l2s")
        require(!Files.isSymbolicLink(l2s.toPath())) { "Unsafe PRoot hardlink store" }
        require(l2s.isDirectory || l2s.mkdirs()) { "Cannot prepare PRoot hardlink store" }
        Os.chmod(l2s.absolutePath, 0x1c0) // 0700
        val env = arrayOf(
            "HOME=/root",
            "TERM=xterm-256color",
            "LANG=C.UTF-8",
            "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
            "PROOT_LOADER=" + loader(context).absolutePath,
            "PROOT_NO_SECCOMP=1",
            "PROOT_TMP_DIR=" + context.cacheDir.absolutePath,
            "PROOT_L2S_DIR=" + l2s.absolutePath,
            "TMPDIR=/tmp"
        )
        val args = arrayOf(
            binary.absolutePath,
            "-0",
            "--kill-on-exit",
            "--link2symlink",
            "-r", root.absolutePath,
            "-b", "/dev",
            "-b", "/proc",
            "-b", "/sys",
            "-b", workspace.absolutePath + ":/workspace",
            "-w", "/workspace",
            "/bin/sh", "-l"
        )
        return TerminalSession(binary.absolutePath, workspace.absolutePath, args, env, 3000, client)
    }
}
