package my.aksara.nativeapp.core.linux

import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.nio.file.Files

class LinuxAdvancedStorageTest {
    @Test fun uniqueNamesNeverOverwriteExistingAndroidDocuments() {
        val used = mutableSetOf("about_you.py", "about_you-1.py", "song.mp3")
        assertEquals("about_you-2.py",
            LinuxAdvancedStorage.Policy.nextAvailable("about_you.py", used))
        assertEquals("song-1.mp3",
            LinuxAdvancedStorage.Policy.nextAvailable("../song.mp3", used))
    }

    @Test fun outboundGuestPathsRejectSymlinksAndCredentials() {
        val temp = Files.createTempDirectory("aksara-advanced-test").toFile()
        try {
            val folder = File(temp, "android-out")
            assertTrue(folder.mkdirs())
            val file = File(folder, "poem.py")
            file.writeText("print('AKSARA')")
            assertTrue(LinuxAdvancedStorage.Policy.allowedGuestFile(folder, file))
            val secret = File(folder, ".env")
            secret.writeText("SECRET")
            assertFalse(LinuxAdvancedStorage.Policy.allowedGuestFile(folder, secret))
            val key = File(folder, "id_ed25519")
            key.writeText("SECRET")
            assertFalse(LinuxAdvancedStorage.Policy.allowedGuestFile(folder, key))
            val outside = File(temp, "outside.py")
            outside.writeText("outside")
            assertFalse(LinuxAdvancedStorage.Policy.allowedGuestFile(folder, outside))
            val link = File(folder, "alias.py").toPath()
            Files.createSymbolicLink(link, outside.toPath())
            assertFalse(LinuxAdvancedStorage.Policy.allowedGuestFile(folder, link.toFile()))
        } finally {
            temp.deleteRecursively()
        }
    }
}
