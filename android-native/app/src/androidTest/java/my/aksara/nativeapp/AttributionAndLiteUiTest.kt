package my.aksara.nativeapp

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import my.aksara.nativeapp.feature.chat.*
import my.aksara.nativeapp.core.storage.Message
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class AttributionAndLiteUiTest {
    @get:Rule val compose = createAndroidComposeRule<VisualTestActivity>()

    @Test fun actualProviderIsAttachedToIndividualMessage() {
        compose.setContent {
            AksaraScreen(ChatState(messages = listOf(
                Message("u", "user", "Uji provider"),
                Message("a1", "assistant", "Jawapan Gemini.", provider = "gemini"),
                Message("a2", "assistant", "Jawapan Groq.", provider = "groq"),
                Message("a3", "assistant", "Belum diketahui.")
            ), loaded = true))
        }
        compose.onNodeWithText("Gemini").assertExists()
        compose.onNodeWithText("Groq").assertExists()
        compose.onNodeWithText("Belum disahkan").assertExists()
        compose.onNodeWithContentDescription("Code Engine").assertDoesNotExist()
        compose.onNodeWithContentDescription("Terminal").assertDoesNotExist()
    }

    @Test fun attachmentAloneEnablesSubmitAndGeneratesRealRequest() {
        var submitted = ""
        compose.setContent {
            AksaraScreen(ChatState(loaded = true),attachmentName = "gambar.jpg",
                onSend = { submitted = it })
        }
        compose.onNodeWithContentDescription("Hantar soalan").assertIsEnabled().performClick()
        compose.runOnIdle { assertEquals("Sila analisis kandungan lampiran ini.",submitted) }
    }

    @Test fun pickerIsNotShownAsCodeTool() {
        compose.setContent { AksaraScreen(ChatState(loaded = true),initialOverlay = "attachments") }
        compose.onNodeWithText("Foto").assertExists()
        compose.onNodeWithText("Video").assertExists()
        compose.onNodeWithText("Dokumen").assertExists()
        compose.onNodeWithText("Audio").assertExists()
        compose.onNodeWithText("Kod").assertDoesNotExist()
        compose.onNodeWithText("Dokumen teks sehingga 100 KB", substring = true).assertDoesNotExist()
    }

    @Test fun onlySiapaAkuIsShownAsTheWelcomeStarter() {
        compose.setContent { AksaraScreen(ChatState(loaded=true)) }
        compose.onNodeWithText("Siapa Aku").assertExists()
        compose.onNodeWithText("The Coder Poet").assertDoesNotExist()
    }

    @Test fun composerRemainsFocusableAndPortalHidesExperimentalEngines() {
        compose.setContent { AksaraScreen(ChatState(loaded = true)) }
        compose.onNodeWithContentDescription("Tulis mesej untuk Aksara A.I.").performClick().assertIsFocused()
        compose.onNodeWithText("PORTAL").performClick()
        compose.onNodeWithText("Game · Linux · SD-Turbo").assertDoesNotExist()
        compose.onNodeWithText("Studio · Jana Imej").assertExists()
        compose.onNodeWithText("Novel · Perpustakaan AKSARA").assertExists()
        compose.onNodeWithText("Prestasi A.I").assertExists()
        compose.onNodeWithText("Sesi & Sejarah").assertExists()
        compose.onNodeWithText("Security Lab").assertDoesNotExist()
        compose.onNodeWithText("Pengetahuan & Rujukan").assertDoesNotExist()
        compose.onNodeWithText("Privasi & Tetapan").assertDoesNotExist()
    }
}
