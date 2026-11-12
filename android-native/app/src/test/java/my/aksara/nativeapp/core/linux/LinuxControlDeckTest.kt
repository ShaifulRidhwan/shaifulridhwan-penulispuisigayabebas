package my.aksara.nativeapp.core.linux

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LinuxControlDeckTest {
    @Test fun closingEarlierTabKeepsSelectedProcessIdentity() {
        assertEquals(1, LinuxSessionSelection.afterClose(selected = 2, removed = 0, countBefore = 3))
        assertEquals(1, LinuxSessionSelection.afterClose(selected = 1, removed = 1, countBefore = 3))
        assertEquals(0, LinuxSessionSelection.afterClose(selected = 0, removed = 0, countBefore = 1))
        assertEquals(1, LinuxSessionSelection.afterClose(selected = 2, removed = 2, countBefore = 3))
    }

    @Test fun deadSessionRestartsInPlaceAndLiveSessionCannotRestart() {
        val names = listOf("Linux 1", "Linux 2", "Linux 5")
        val plan = LinuxSessionSelection.restartPlan(1, names, ended = true)
        assertNotNull(plan)
        assertEquals(1, plan!!.index)
        assertEquals("Linux 2", plan.name)
        assertEquals(3, names.size)
        assertNull(LinuxSessionSelection.restartPlan(1, names, ended = false))
        assertNull(LinuxSessionSelection.restartPlan(9, names, ended = true))
        assertNull(LinuxSessionSelection.restartPlan(-1, names, ended = true))
    }

    @Test fun allowlistedCommandGroupsAreExplicitAndReadOnly() {
        assertEquals("pwd\r", LinuxQuickCommands.sequence("pwd", installed = false))
        assertEquals("git status\r", LinuxQuickCommands.sequence("git", installed = true))
        assertEquals("ps\r", LinuxQuickCommands.sequence("process", installed = false))
        assertNull(LinuxQuickCommands.sequence("git", installed = false))
        assertNull(LinuxQuickCommands.sequence("rm -rf /", installed = true))
        assertNull(LinuxQuickCommands.sequence("ROOT", installed = true))
        assertFalse(LinuxQuickCommands.forRuntime(false).any { it.linuxOnly })
        assertFalse(LinuxQuickCommands.categories(false).contains(LinuxQuickCommands.Category.DEV))
        assertTrue(LinuxQuickCommands.categories(true).contains(LinuxQuickCommands.Category.DEV))
        assertEquals(
            listOf("git", "python", "packages"),
            LinuxQuickCommands.forRuntime(true, LinuxQuickCommands.Category.DEV).map { it.id }
        )
        assertTrue(LinuxQuickCommands.forRuntime(true).all { action ->
            !action.command.contains("\n") && action.command.isNotBlank()
        })
    }

    @Test fun shellProfileIsOptOutAndInteractiveOnly() {
        assertEquals("etc/profile.d/99-aksara-prompt.sh", LinuxShellIdentity.relativePath)
        assertTrue(LinuxShellIdentity.profile.contains("case \"\$-\" in *i*)"))
        assertTrue(LinuxShellIdentity.profile.contains("AKSARA_PROMPT_OFF"))
        assertTrue(LinuxShellIdentity.profile.contains("PS1='aksara:\\w ❯ '"))
        assertFalse(LinuxShellIdentity.profile.contains("sudo"))
        assertFalse(LinuxShellIdentity.profile.contains("su -"))
    }
}
