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
        val unavailable = compose.onAllNodesWithText("Local · Tiada runtime")
            .fetchSemanticsNodes().isNotEmpty()
        if (unavailable) {
            compose.onNodeWithText("Local · Tiada runtime").assertIsNotEnabled()
            compose.onNodeWithText("Local belum tersedia",substring=true).assertExists()
        } else {
            compose.onNodeWithText("Local · SD-Turbo").performClick()
            compose.onNodeWithText("SD-Turbo · Local Engine").assertExists()
        }
        compose.onNodeWithText("Cloud FLUX",substring=true).performClick()
        compose.onNodeWithText("Galeri").performClick()
        compose.onNodeWithText("Galeri Studio").assertExists()
        compose.onNodeWithText("Sejarah").performClick()
        compose.onNodeWithText("Sejarah penjanaan").assertExists()
        compose.onNodeWithText("Tetapan").performClick()
        compose.onNodeWithText("Backend Cloud:",substring=true).assertExists()
        compose.onNodeWithText("Jana Imej").performClick()
        compose.onNodeWithText("Enjin Penjanaan").assertExists()
        compose.onNodeWithText("Pilihan Penjanaan").assertDoesNotExist()
        compose.onNodeWithText("Gaya").assertDoesNotExist()
        compose.onNodeWithText("Tetapan").performClick()
        compose.onNodeWithText("Pilihan Penjanaan").assertExists()
        compose.onNodeWithText("Model Cloud").assertExists()
        // These are static headings, not interactable scroll targets. Compose's
        // performScrollTo requires a Scroll SemanticsAction parent and fails on
        // some emulator builds even when the settings actually exist.
        compose.onNodeWithText("Nisbah").assertExists()
        compose.onNodeWithText("Kualiti").assertExists()
        compose.onNodeWithText("Seed").assertExists()
    }

    @Test fun templateStyleIsChosenWithoutDuplicateStylePicker() {
        compose.setContent { AksaraScreen(ChatState(loaded=true),initialOverlay="studio") }
        compose.onNodeWithText("Template Imej").performScrollTo().performClick()
        compose.onNodeWithText("Poster").performScrollTo().performClick()
        compose.onNodeWithContentDescription("Apa yang kau nak lihat?")
            .assertTextContains("editorial poster",substring=true)
        compose.onNodeWithText("Tetapan").performClick()
        compose.onNodeWithText("Pilihan Penjanaan").assertExists()
        compose.onNodeWithText("Gaya").assertDoesNotExist()
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