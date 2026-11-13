package my.aksara.nativeapp.feature.chat

import org.junit.Assert.*
import org.junit.Test

class NexusChatRouterTest {
    @Test fun routesExplicitKernelRequestsOnly() {
        assertNull(NexusChatRouter.parse("Hai Aksara, apa khabar?"))
        assertNull(NexusChatRouter.parse("Apa itu kernel Linux?"))
        assertEquals(
            NexusChatRequest.Plan("semak Linux dan GitHub", true),
            NexusChatRouter.parse("Nexus, semak Linux dan GitHub")
        )
        assertEquals(
            NexusChatRequest.Plan("audit penuh", false),
            NexusChatRouter.parse("/nexus offline audit penuh")
        )
        assertEquals(
            NexusChatRequest.Shell("pwd"),
            NexusChatRouter.parse("/nexus shell pwd")
        )
        assertEquals(
            NexusChatRequest.Write("notes.txt", "satu\ndua"),
            NexusChatRouter.parse("/nexus write notes.txt\nsatu\ndua")
        )
        assertEquals(
            NexusChatRequest.EditWithAi("notes.txt", "kemaskan ayat"),
            NexusChatRouter.parse("/nexus edit notes.txt | kemaskan ayat")
        )
        assertEquals(NexusChatRequest.Stop, NexusChatRouter.parse("/nexus stop"))
        assertEquals(NexusChatRequest.Undo, NexusChatRouter.parse("/nexus undo"))
        assertEquals(NexusChatRequest.Status, NexusChatRouter.parse("/nexus status"))
    }
    @Test fun neverInterpretsArbitraryCommandsWithoutExplicitNexusAddress() {
        assertNull(NexusChatRouter.parse("rm -rf /"))
        assertNull(NexusChatRouter.parse("Tolong jalankan rm -rf /"))
        assertEquals(
            NexusChatRequest.Shell("echo okay"),
            NexusChatRouter.parse("/nexus shell echo okay")
        )
    }
}
