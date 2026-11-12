package my.aksara.nativeapp.core.linux

import android.content.Context
import android.os.Build
import android.system.Os
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
internal object AksaraLinuxRuntime {
    const val alpineVersion = "3.22.8"
    // .bundle avoids aapt's special .gz asset transformation.
    private const val archive = "linux/alpine-minirootfs.bundle"
    private const val checksum = "linux/alpine-minirootfs.sha256"
    private const val marker = ".aksara-alpine-installed"

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
            "alpine-minirootfs.sha256" in names
    }

    fun installed(context: Context): Boolean {
        val root = rootfs(context)
        return bundled(context) && File(root, marker).isFile &&
            LinuxRootfsVerifier.hasRequiredCommands(root)
    }

    /**
     * Called by an explicit install button, never automatically during app
     * startup. All work MUST run on Dispatchers.IO.
     */
    fun install(context: Context) {
        require(bundled(context)) {
            "Bundle Alpine ARM64 atau PRoot belum disertakan dalam APK ini."
        }
        if (installed(context)) return

        val target = rootfs(context)
        val staging = File(context.filesDir, "alpine-arm64.installing")
        if (staging.exists()) require(staging.deleteRecursively()) { "Tidak dapat membersihkan pemasangan lama." }
        require(staging.mkdirs()) { "Tidak dapat menyediakan storan Linux." }

        try {
            val expected = context.assets.open(checksum).bufferedReader().use {
                it.readLine().trim().split(Regex("\\s+")).first().lowercase()
            }
            require(expected.matches(Regex("[0-9a-f]{64}"))) { "Checksum Alpine tidak sah." }
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
                            while (true) {
                                val entry = tar.nextTarEntry ?: break
                                count++
                                require(count <= 30000) { "Terlalu banyak fail dalam arkib Linux." }
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
                                            val buffer = ByteArray(8192)
                                            while (true) {
                                                val read = tar.read(buffer)
                                                if (read < 0) break
                                                output.write(buffer, 0, read)
                                                uncompressed += read
                                                require(uncompressed <= 250L * 1024 * 1024) {
                                                    "Saiz pemasangan melebihi had."
                                                }
                                            }
                                        }
                                        if ((entry.mode and 73) != 0) file.setExecutable(true, false)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            val actual = sha.digest().joinToString("") { "%02x".format(it) }
            require(actual == expected) { "SHA-256 Alpine tidak sepadan." }

            // Apply links only after regular files to avoid traversing links
            // while processing archive paths.
            for ((file, link) in pendingHardlinks) {
                val source = File(staging, link.removePrefix("./").trimStart('/'))
                require(source.canonicalPath.startsWith(stagingCanonical) && source.isFile)
                file.parentFile?.mkdirs()
                Os.link(source.absolutePath, file.absolutePath)
            }
            for ((file, link) in pendingSymlinks) {
                file.parentFile?.mkdirs()
                require(!file.exists()) { "Arkib mempunyai laluan pautan berganda." }
                Os.symlink(link, file.absolutePath)
            }
            val missing = LinuxRootfsVerifier.missingRequiredCommands(staging)
            require(missing.isEmpty()) {
                "Pemasangan Alpine tidak lengkap: " + missing.joinToString(", ") +
                    " tiada sebagai fail atau symbolic link."
            }
            // An absolute guest symlink must not be followed in Android's
            // host namespace when writing a resolver configuration.
            val resolv = File(staging, "etc/resolv.conf")
            if (Files.isSymbolicLink(resolv.toPath())) Files.delete(resolv.toPath())
            require(resolv.parentFile.isDirectory || resolv.parentFile.mkdirs())
            resolv.writeText("nameserver 1.1.1.1\nnameserver 8.8.8.8\n")
            File(staging, marker).writeText(alpineVersion + "\n")
            if (target.exists()) require(target.deleteRecursively())
            require(staging.renameTo(target)) { "Tidak dapat mengaktifkan rootfs Linux." }
        } catch (failure: Exception) {
            staging.deleteRecursively()
            throw failure
        }
    }

    fun createSession(context: Context, client: TerminalSessionClient): TerminalSession {
        require(installed(context)) { "Alpine belum dipasang atau belum disahkan." }
        val workspace = workspace(context)
        val root = rootfs(context)
        val binary = proot(context)
        val env = arrayOf(
            "HOME=/root",
            "TERM=xterm-256color",
            "LANG=C.UTF-8",
            "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
            "PROOT_LOADER=" + loader(context).absolutePath,
            "PROOT_NO_SECCOMP=1",
            "PROOT_TMP_DIR=" + context.cacheDir.absolutePath,
            "TMPDIR=" + context.cacheDir.absolutePath
        )
        val args = arrayOf(
            binary.absolutePath,
            "-0",
            "--kill-on-exit",
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
