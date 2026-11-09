package my.aksara.nativeapp

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import my.aksara.nativeapp.feature.chat.*
import org.junit.Rule
import org.junit.Test

/** Test the real Compose overlay, not a screenshot-only prototype. */
class StudioV2UiTest {
    @get:Rule val compose = createAndroidComposeRule<VisualTestActivity>()

    @Test fun sharedEngineSwitchAndFourPagesWork() {
        compose.setContent { AksaraScreen(ChatState(loaded=true),initialOverlay="studio") }
        compose.onNodeWithText("STUDIO ANTARA  V2").assertExists()
        compose.onNodeWithText("Local · SD-Turbo",substring=true).performClick()
        compose.onNodeWithText("Runtime Local tidak dipakejkan dalam APK ini").assertExists()
        compose.onNodeWithText("Cloud Engine",substring=true).performClick()
        compose.onNodeWithText("Galeri").performClick()
        compose.onNodeWithText("Galeri Studio").assertExists()
        compose.onNodeWithText("Sejarah").performClick()
        compose.onNodeWithText("Sejarah penjanaan").assertExists()
        compose.onNodeWithText("Tetapan").performClick()
        compose.onNodeWithText("Backend Cloud:",substring=true).assertExists()
        compose.onNodeWithText("Jana Imej").performClick()
        compose.onNodeWithText("Enjin Penjanaan").assertExists()
        compose.onNodeWithText("Pilihan Penjanaan").performScrollTo().performClick()
        compose.onNodeWithText("Model Cloud").assertExists()
        compose.onNodeWithText("Sembunyi Pilihan Penjanaan").performScrollTo().performClick()
    }

    @Test fun ideaPromptIsExplicitlySelectableAndEditable() {
        compose.setContent { AksaraScreen(ChatState(loaded=true),initialOverlay="studio") }
        compose.onAllNodesWithText("Idea Prompt").assertCountEquals(1)
        compose.onNodeWithText("Idea Prompt").performScrollTo().performClick()
        compose.onNodeWithText("1. A cinematic mountain valley",substring=true).performClick()
        compose.onNodeWithContentDescription("Apa yang kau nak lihat?").assertTextContains("A cinematic mountain valley", substring = true)
        compose.onNodeWithContentDescription("Apa yang kau nak lihat?").performTextInput(" at night")
        compose.onNodeWithContentDescription("Apa yang kau nak lihat?").assertTextContains("at night", substring = true)
    }
}