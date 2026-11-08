package my.aksara.nativeapp

import my.aksara.nativeapp.feature.studio.StudioRules
import org.junit.Assert.*
import org.junit.Test

class StudioContractsTest {
    @Test fun localIsStrictly512SingleStepAndNativeCfgOne() {
        StudioRules.local("1:1",1,1.0f)
        assertThrows(IllegalArgumentException::class.java) { StudioRules.local("9:16",1,1.0f) }
        assertThrows(IllegalArgumentException::class.java) { StudioRules.local("1:1",4,1.0f) }
        assertThrows(IllegalArgumentException::class.java) { StudioRules.local("1:1",1,0f) }
    }
    @Test fun cloudDoesNotSendUnsupportedSettings() {
        StudioRules.cloud("klein","9:16","detail",42L)
        StudioRules.cloud("schnell","1:1","fast",null)
        StudioRules.cloud("ovh","1:1","balanced",null)
        assertThrows(IllegalArgumentException::class.java) { StudioRules.cloud("schnell","9:16","balanced",null) }
        assertThrows(IllegalArgumentException::class.java) { StudioRules.cloud("ovh","1:1","balanced",10L) }
        assertThrows(IllegalArgumentException::class.java) { StudioRules.cloud("other","1:1","balanced",null) }
    }
    @Test fun validatedSeedAndPromptRemainBounded() {
        assertNull(StudioRules.seed(""))
        assertEquals(2147483647L,StudioRules.seed("2147483647"))
        assertThrows(IllegalArgumentException::class.java) { StudioRules.seed("-1") }
        assertThrows(IllegalArgumentException::class.java) { StudioRules.seed("2147483648") }
        assertThrows(IllegalArgumentException::class.java) { StudioRules.prompt("abc") }
        assertThrows(IllegalArgumentException::class.java) { StudioRules.prompt("a".repeat(1201)) }
        assertEquals("abcd",StudioRules.prompt(" abcd "))
    }
    @Test fun offlineEnhancementNeverRequiresRemoteAccess() {
        val original="A portrait in natural light"
        val improved=StudioRules.lightEnhance(original)
        assertTrue(improved.startsWith(original))
        assertTrue(improved.contains("consistent lighting"))
        assertFalse(StudioRules.presets.any { it.first=="antara" })
    }
}
