package my.aksara.nativeapp

import my.aksara.nativeapp.feature.chat.AksaraTechRegistry
import org.junit.Assert.*
import org.junit.Test

/** Settings V2 contract: real catalogue pages, not dead toggles or invented capabilities. */
class SettingsV2TechnicalRegistryTest {
    @Test fun eachModuleIsAddressableAndHasSourceAndLimitations() {
        val modules=AksaraTechRegistry.modules
        assertTrue(modules.size >= 10)
        assertEquals(modules.size,modules.map{it.id}.toSet().size)
        val groups=AksaraTechRegistry.groups.map{it.first}
        assertEquals(3,groups.size)
        assertEquals(groups.size,groups.toSet().size)
        assertTrue(modules.all{it.group in groups})
        modules.forEach { m ->
            assertTrue("Missing title: "+m.id,m.title.isNotBlank())
            assertTrue("Missing source: "+m.id,m.sources.isNotEmpty())
            assertTrue("Missing flow: "+m.id,m.flow.size >= 3)
            assertTrue("Missing caveat: "+m.id,m.caveat.isNotBlank())
        }
    }
    @Test fun usesLockedEnglishNavigationHeadings() {
        assertEquals(listOf(
            "System Architecture",
            "Capabilities & Integrations",
            "Diagnostics & Runtime"
        ),AksaraTechRegistry.groups.map{it.first})
    }
}
