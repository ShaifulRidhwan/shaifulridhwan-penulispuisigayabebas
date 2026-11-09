package my.aksara.nativeapp

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import my.aksara.nativeapp.feature.chat.*
import org.junit.Rule
import org.junit.Test

/** Actual native Settings overlay, not a screenshot-only or mock data page. */
class P3P4SettingsUiTest {
    @get:Rule val compose=createAndroidComposeRule<VisualTestActivity>()

    @Test fun sixRequestedSectionsRenderAndIntelligenceIsInspectible() {
        compose.setContent { AksaraScreen(ChatState(loaded=true),initialOverlay="settings") }
        listOf("Kecerdasan & Model","Chat & Lampiran","Voice & Audio",
            "Memori & Privasi","Tools & Research","Sistem & Diagnostik").forEach {
            compose.onNodeWithText(it).assertExists()
        }
        compose.onNodeWithTag("aksara-glass-modal").assertExists()
        compose.onNodeWithText("Buka Voice & pilih peranti").assertDoesNotExist()
        compose.onNodeWithText("Voice & Audio").performClick()
        compose.onNodeWithText("Buka Voice & pilih peranti").assertExists()
        compose.onNodeWithText("Voice & Audio").performClick()
        compose.onNodeWithText("Buka Voice & pilih peranti").assertDoesNotExist()
        listOf("Kecerdasan & Model","Chat & Lampiran","Voice & Audio",
            "Memori & Privasi","Tools & Research","Sistem & Diagnostik").forEach {
            compose.onNodeWithContentDescription("Ikon " + it).assertExists()
        }
        compose.onNodeWithText("Sistem & Diagnostik").performClick()
        compose.onNodeWithText("Prestasi A.I.").assertExists()
        compose.onNodeWithText("Sistem & Diagnostik").performClick()
        compose.onNodeWithText("Prestasi A.I.").assertDoesNotExist()
        compose.onNodeWithText("Kecerdasan & Model").performClick()
        compose.onNodeWithText("Model Capability Registry").assertExists()
        compose.onNodeWithText("Task Planner · pratonton sahaja").assertExists()
    }
}
