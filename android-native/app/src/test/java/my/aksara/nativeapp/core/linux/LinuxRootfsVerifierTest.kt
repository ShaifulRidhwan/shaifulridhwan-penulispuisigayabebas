package my.aksara.nativeapp.core.linux

import java.io.File
import java.nio.file.Files
import java.nio.file.Paths
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class LinuxRootfsVerifierTest {
    @get:Rule val temporaryFolder = TemporaryFolder()

    @Test fun absoluteGuestSymlinksAreAcceptedEvenWhenDanglingOnAndroidHost() {
        val root = temporaryFolder.newFolder("alpine")
        val bin = File(root, "bin").apply { mkdirs() }
        val sbin = File(root, "sbin").apply { mkdirs() }
        Files.createSymbolicLink(
            File(bin, "sh").toPath(),
            Paths.get("/aksara-guest-root-not-on-host/bin/busybox")
        )
        Files.createSymbolicLink(
            File(sbin, "apk").toPath(),
            Paths.get("/aksara-guest-root-not-on-host/sbin/apk")
        )
        assertFalse(File(bin, "sh").exists())
        assertFalse(File(sbin, "apk").exists())
        assertTrue(LinuxRootfsVerifier.hasRequiredCommands(root))
        assertEquals(emptyList<String>(), LinuxRootfsVerifier.missingRequiredCommands(root))
    }

    @Test fun genuinelyMissingEntrypointsStillFailValidation() {
        val root = temporaryFolder.newFolder("missing-linux")
        assertEquals(
            listOf("bin/sh", "sbin/apk"),
            LinuxRootfsVerifier.missingRequiredCommands(root)
        )
        assertFalse(LinuxRootfsVerifier.hasRequiredCommands(root))
    }

    @Test fun regularExecutableFilesAlsoCountAsExisting() {
        val root = temporaryFolder.newFolder("files-linux")
        File(root, "bin").mkdirs()
        File(root, "sbin").mkdirs()
        File(root, "bin/sh").writeText("dummy")
        File(root, "sbin/apk").writeText("dummy")
        assertTrue(LinuxRootfsVerifier.hasRequiredCommands(root))
    }
}
