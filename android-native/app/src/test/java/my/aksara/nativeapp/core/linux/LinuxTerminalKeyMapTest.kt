package my.aksara.nativeapp.core.linux

import org.junit.Assert.assertEquals
import org.junit.Test

class LinuxTerminalKeyMapTest {
    @Test fun navigationAndEditingSequencesAreRealVtKeys() {
        assertEquals("\u001b", LinuxTerminalKeyMap.sequence("ESC"))
        assertEquals("\t", LinuxTerminalKeyMap.sequence("TAB"))
        assertEquals("\u001b[A", LinuxTerminalKeyMap.sequence("↑"))
        assertEquals("\u001b[B", LinuxTerminalKeyMap.sequence("↓"))
        assertEquals("\u001b[C", LinuxTerminalKeyMap.sequence("→"))
        assertEquals("\u001b[D", LinuxTerminalKeyMap.sequence("←"))
        assertEquals("\u007f", LinuxTerminalKeyMap.sequence("DEL"))
    }
    @Test fun unsupportedKeyNeverInjectsUnexpectedText() {
        assertEquals("", LinuxTerminalKeyMap.sequence("ROOT"))
        assertEquals("", LinuxTerminalKeyMap.sequence("UNKNOWN"))
    }
}
