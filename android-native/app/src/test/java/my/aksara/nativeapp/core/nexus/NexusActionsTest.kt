package my.aksara.nativeapp.core.nexus

import org.junit.Assert.*
import org.junit.Test

/** Pure registry contracts: model output cannot turn into shell code. */
class NexusActionsTest {
    @Test fun everyActionHasUniqueStableIdAndAtLeastOneStep() {
        val all = NexusActions.all
        assertEquals(all.size, all.map { it.id }.distinct().size)
        assertTrue(all.all { it.id.matches(Regex("[a-z]+[.][a-z-]+")) })
        assertTrue(all.all { it.steps.isNotEmpty() })
        assertEquals(all, all.mapNotNull { NexusActions.find(it.id) })
    }

    @Test fun unknownOrInjectedToolCannotExecute() {
        assertNull(NexusActions.find("linux.health; rm -rf /"))
        assertNull(NexusActions.find("cd .."))
        assertNull(NexusActions.find("workflow.custom"))
        assertNull(NexusActions.find(""))
    }

    @Test fun commandsAreFixedReadonlyDiagnostics() {
        val allowed = listOf("uname ", "cat /etc/os-release", "df ", "python3 --version",
            "git ", "node --version", "gcc --version", "clang --version", "pwd", "ls ")
        NexusActions.all.flatMap { it.steps }.forEach { (_, cmd) ->
            val pieces = cmd.split(";", "||").map { it.trim() }
            assertTrue(pieces.all { piece ->
                allowed.any { piece.startsWith(it) } || piece.startsWith("echo ") ||
                    piece.startsWith("head ")
            })
            assertFalse(cmd.contains("$("))
            assertFalse(cmd.contains("sudo "))
            assertFalse(cmd.contains("rm "))
        }
    }
}
