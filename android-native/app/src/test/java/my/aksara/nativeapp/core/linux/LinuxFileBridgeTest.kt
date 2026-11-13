package my.aksara.nativeapp.core.linux

import org.junit.Assert.*
import org.junit.Test

class LinuxFileBridgeTest {
    @Test fun preservesUsefulFileExtensions() {
        assertEquals("about_you.py", LinuxFileNames.safeName("about_you.py"))
        assertEquals("About_You_00-02.mp3", LinuxFileNames.safeName("About_You_00-02.mp3"))
        assertEquals("song.lrc", LinuxFileNames.safeName("song.lrc"))
    }

    @Test fun stripsTraversalAndControlCharacters() {
        assertEquals("private.key", LinuxFileNames.safeName("../../private.key"))
        assertEquals("run.py", LinuxFileNames.safeName("C:\\Users\\any\\run.py"))
        assertEquals("a_b.txt", LinuxFileNames.safeName("a\nb.txt"))
        assertEquals("imported-file", LinuxFileNames.safeName("..."))
        assertEquals("imported-file", LinuxFileNames.safeName(null))
    }

    @Test fun duplicatesNeverOverwritePreviousImport() {
        assertEquals("song.mp3", LinuxFileNames.numbered("song.mp3", 0))
        assertEquals("song-1.mp3", LinuxFileNames.numbered("song.mp3", 1))
        assertEquals("song-2.mp3", LinuxFileNames.numbered("song.mp3", 2))
        assertEquals("script-1", LinuxFileNames.numbered("script", 1))
    }
}
