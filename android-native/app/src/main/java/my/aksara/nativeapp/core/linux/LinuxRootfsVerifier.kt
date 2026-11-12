package my.aksara.nativeapp.core.linux

import java.io.File
import java.nio.file.Files
import java.nio.file.LinkOption

/**
 * The Alpine rootfs is a guest filesystem. Absolute symlink targets like
 * /bin/sh -> /bin/busybox are valid *inside PRoot*, even when they are
 * dangling from Android's host filesystem.
 *
 * Never use File.exists() to validate these guest executable entries.
 */
internal object LinuxRootfsVerifier {
    private val requiredCommands = listOf("bin/sh", "sbin/apk")

    fun missingRequiredCommands(root: File): List<String> =
        requiredCommands.filterNot { relative ->
            val path = File(root, relative).toPath()
            Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS) ||
                Files.isSymbolicLink(path)
        }

    fun hasRequiredCommands(root: File): Boolean =
        missingRequiredCommands(root).isEmpty()
}
