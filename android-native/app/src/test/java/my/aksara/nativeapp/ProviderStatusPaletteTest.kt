package my.aksara.nativeapp

import my.aksara.nativeapp.feature.chat.ProviderStatusPalette
import org.junit.Assert.*
import org.junit.Test

class ProviderStatusPaletteTest {
    @Test fun semanticStatusColorsNeverConfuseReadyWithOnline() {
        assertNotEquals(ProviderStatusPalette.online, ProviderStatusPalette.ready)
        assertNotEquals(ProviderStatusPalette.ready, ProviderStatusPalette.offline)
        assertNotEquals(ProviderStatusPalette.offline, ProviderStatusPalette.unknown)
        assertEquals(ProviderStatusPalette.online, ProviderStatusPalette.color("Online"))
        assertEquals(ProviderStatusPalette.ready, ProviderStatusPalette.color("ready"))
        assertEquals(ProviderStatusPalette.offline, ProviderStatusPalette.color("Backend unreachable"))
        assertEquals(ProviderStatusPalette.unknown, ProviderStatusPalette.color("Unverified"))
    }

    @Test fun summaryCountsOnlyActualProviderStates() {
        assertEquals("2 Online · 2 Ready", ProviderStatusPalette.summary(listOf(
            "gemini" to "online", "groq" to "online",
            "workers_ai" to "ready", "openrouter" to "ready")))
        assertEquals("0 Online · 0 Ready",
            ProviderStatusPalette.summary(listOf("backend" to "Backend unreachable")))
    }
}
