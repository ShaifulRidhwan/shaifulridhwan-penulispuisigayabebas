package my.aksara.nativeapp

import my.aksara.nativeapp.core.design.isKnownAksaraIcon
import my.aksara.nativeapp.feature.chat.SettingsCategoryIcons
import org.junit.Assert.*
import org.junit.Test

/** Regression for missing Chat & Lampiran artwork and duplicate category symbols. */
class SettingsIconContractTest {
    @Test fun everySettingsCategoryHasADistinctDrawableIcon() {
        assertEquals(5, SettingsCategoryIcons.size)
        assertEquals(5, SettingsCategoryIcons.values.toSet().size)
        SettingsCategoryIcons.forEach { (category, icon) ->
            assertTrue("Unknown icon for $category: $icon", isKnownAksaraIcon(icon))
        }
        assertEquals("chat", SettingsCategoryIcons["Chat & Lampiran"])
        assertFalse("Diagnostics is owned by Advanced Settings", SettingsCategoryIcons.containsKey("Sistem & Diagnostik"))
        assertTrue(isKnownAksaraIcon("settings"))
        assertTrue(isKnownAksaraIcon("home"))
        listOf("image","video","file-text","audio").forEach { icon ->
            assertTrue("Missing attachment icon $icon",isKnownAksaraIcon(icon))
        }
    }
}
