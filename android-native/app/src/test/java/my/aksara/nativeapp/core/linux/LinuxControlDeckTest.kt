package my.aksara.nativeapp.core.linux

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test

class LinuxControlDeckTest {
    @Test fun closingEarlierTabKeepsSelectedProcessIdentity() {
        assertEquals(1, LinuxSessionSelection.afterClose(selected = 2, removed = 0, countBefore = 3))
        assertEquals(1, LinuxSessionSelection.afterClose(selected = 1, removed = 1, countBefore = 3))
        assertEquals(0, LinuxSessionSelection.afterClose(selected = 0, removed = 0, countBefore = 1))
        assertEquals(1, LinuxSessionSelection.afterClose(selected = 2, removed = 2, countBefore = 3))
    }
    @Test fun commandPaletteOnlyAllowsKnownReadOnlyActions() {
        assertEquals("pwd\r", LinuxQuickCommands.sequence("pwd", installed = false))
        assertEquals("git status\r", LinuxQuickCommands.sequence("git", installed = true))
        assertNull(LinuxQuickCommands.sequence("git", installed = false))
        assertNull(LinuxQuickCommands.sequence("rm -rf /", installed = true))
        assertNull(LinuxQuickCommands.sequence("ROOT", installed = true))
        assertFalse(LinuxQuickCommands.forRuntime(false).any { it.linuxOnly })
    }
}
