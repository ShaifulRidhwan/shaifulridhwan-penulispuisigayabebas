package my.aksara.nativeapp

import my.aksara.nativeapp.core.design.isKnownAksaraIcon
import my.aksara.nativeapp.feature.chat.SettingsCategoryIcons
import org.junit.Assert.*
import org.junit.Test

/** Regression for missing Chat & Lampiran artwork and duplicate category symbols. */
class SettingsIconContractTest {
    @Test fun everySettingsCategoryHasADistinctDrawableIcon() {
        assertEquals(6, SettingsCategoryIcons.size)
        assertEquals(6, SettingsCategoryIcons.values.toSet().size)
        SettingsCategoryIcons.forEach { (category, icon) ->
            assertTrue("Unknown icon for $category: $icon", isKnownAksaraIcon(icon))
        }
        assertEquals("chat", SettingsCategoryIcons["Chat & Lampiran"])
        assertTrue(isKnownAksaraIcon("settings"))
        assertTrue(isKnownAksaraIcon("home"))
    }
}
