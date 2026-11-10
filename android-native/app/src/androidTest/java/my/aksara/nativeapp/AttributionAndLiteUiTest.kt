package my.aksara.nativeapp

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.unit.dp
import my.aksara.nativeapp.feature.chat.*
import my.aksara.nativeapp.feature.splash.AksaraSplashContent
import my.aksara.nativeapp.feature.splash.AksaraLaunchGate
import my.aksara.nativeapp.core.design.AksaraText
import my.aksara.nativeapp.core.storage.Message
import my.aksara.nativeapp.core.platform.AttachmentReader
import android.graphics.Bitmap
import android.graphics.Color
import java.io.ByteArrayOutputStream
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class AttributionAndLiteUiTest {
    @get:Rule val compose = createAndroidComposeRule<VisualTestActivity>()

    @Test fun launchSplashUsesExistingAksaraIdentity() {
        compose.setContent { AksaraSplashContent() }
        compose.onNodeWithTag("aksara-splash-screen").assertExists()
        compose.onNodeWithText("AKSARA A.I.").assertExists()
        compose.onNodeWithText("ANTARA AKSARA DAN CODE").assertExists()
        compose.onNodeWithText("OLEH SHAIFUL RIDHWAN").assertExists()
    }

    @Test fun recreatedActivitySkipsTheOptionalInAppSplash() {
        compose.setContent {
            AksaraLaunchGate(initialIntro = false) { AksaraText("Chatbox sedia") }
        }
        compose.onNodeWithTag("aksara-splash-screen").assertDoesNotExist()
        compose.onNodeWithText("Chatbox sedia").assertExists()
    }

    @Test fun launchThemeIsDarkAndUsesTheAksaraMark() {
        val app = androidx.test.platform.app.InstrumentationRegistry
            .getInstrumentation().targetContext
        val info = app.packageManager.getActivityInfo(
            android.content.ComponentName(app, MainActivity::class.java), 0
        )
        val launchTheme = app.resources.newTheme().apply {
            applyStyle(info.themeResource, true)
        }
        val background = android.util.TypedValue()
        val mark = android.util.TypedValue()
        org.junit.Assert.assertTrue(
            launchTheme.resolveAttribute(android.R.attr.windowSplashScreenBackground, background, true)
        )
        assertEquals(0xFF070911.toInt(), background.data)
        org.junit.Assert.assertTrue(
            launchTheme.resolveAttribute(android.R.attr.windowSplashScreenAnimatedIcon, mark, true)
        )
        assertEquals(R.drawable.aksara_splash_mark, mark.resourceId)
    }

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
                onSend = { submitted = it; true })
        }
        compose.onNodeWithContentDescription("Hantar soalan").assertIsEnabled().performClick()
        compose.runOnIdle { assertEquals("Sila analisis kandungan lampiran ini.",submitted) }
    }

    @Test fun oversizedCameraImageIsCompressedForActualInlineUpload() {
        val bitmap=Bitmap.createBitmap(1600,1600,Bitmap.Config.ARGB_8888)
        val pixels=IntArray(1600*1600)
        var seed=0x12345678
        for (i in pixels.indices) {
            seed=seed xor (seed shl 13)
            seed=seed xor (seed ushr 17)
            seed=seed xor (seed shl 5)
            pixels[i]=Color.rgb(seed and 255,(seed ushr 8) and 255,(seed ushr 16) and 255)
        }
        bitmap.setPixels(pixels,0,1600,0,0,1600,1600)
        val raw=ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.PNG,100,raw)
        bitmap.recycle()
        org.junit.Assert.assertTrue(raw.size()>3_600_000)
        val (mime,compressed)=AttachmentReader.prepareImage(raw.toByteArray(),"image/png")
        assertEquals("image/jpeg",mime)
        org.junit.Assert.assertTrue(compressed.size <= 3_600_000)
        org.junit.Assert.assertNotNull(android.graphics.BitmapFactory.decodeByteArray(compressed,0,compressed.size))
    }

    @Test fun uploadProgressDisablesSendAndAllowsCancellation() {
        var stopped=false
        compose.setContent {
            AksaraScreen(ChatState(loaded=true),attachmentName="video.mp4",
                attachmentLoading=true,uploadStatus="Muat naik video.mp4: 48%",
                onCancelUpload={stopped=true})
        }
        compose.onNodeWithText("Muat naik video.mp4: 48%").assertExists()
        compose.onNodeWithContentDescription("Hantar soalan").assertIsNotEnabled()
        compose.onNodeWithText("Batal").performClick()
        compose.runOnIdle { org.junit.Assert.assertTrue(stopped) }
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
        compose.onNodeWithTag("thinking-glass-button").assertExists()
        compose.onNodeWithTag("send-glass-button").assertExists()
        compose.onNodeWithText("Tanya atau lampirkan fail").assertDoesNotExist()
    }


    @Test fun thinkingModeIconFollowsChosenMode() {
        val selected = androidx.compose.runtime.mutableStateOf("cahaya")
        compose.setContent {
            AksaraScreen(ChatState(loaded=true,mode=selected.value),
                onMode={ selected.value=it })
        }
        compose.onNodeWithTag("thinking-glass-button").assertExists()
        compose.onNodeWithContentDescription("Thinking Mode").assert(
            androidx.compose.ui.test.SemanticsMatcher.expectValue(
                androidx.compose.ui.semantics.SemanticsProperties.StateDescription, "Cahaya · Sedia"))
        compose.onNodeWithContentDescription("Thinking Mode").performClick()
        compose.onNodeWithText("Gelap",substring=false).performClick()
        compose.onNodeWithContentDescription("Thinking Mode").assert(
            androidx.compose.ui.test.SemanticsMatcher.expectValue(
                androidx.compose.ui.semantics.SemanticsProperties.StateDescription, "Gelap · Sedia"))
        compose.onNodeWithContentDescription("Thinking Mode").performClick()
        compose.onNodeWithText("Mod dipilih").assertExists()
        compose.onAllNodesWithText("Gelap",substring=false).assertCountEquals(2)
    }

    @Test fun composerGlassControlsHaveMatchingTargetsAndIdleSendIsDisabled() {
        compose.setContent { AksaraScreen(ChatState(loaded=true)) }
        compose.onNodeWithTag("thinking-glass-button")
            .assertWidthIsEqualTo(44.dp).assertHeightIsEqualTo(44.dp)
        compose.onNodeWithTag("send-glass-button")
            .assertWidthIsEqualTo(44.dp).assertHeightIsEqualTo(44.dp)
            .assertIsNotEnabled()
        compose.onNodeWithContentDescription("Voice Chat").assertExists()
        compose.onNodeWithTag("voice-status-chip").assertExists()
    }

    @Test fun nativeMenusUseSharedLiquidGlassModalChrome() {
        compose.setContent { AksaraScreen(ChatState(loaded = true)) }
        compose.onNodeWithContentDescription("Carian, sesi dan memori").performClick()
        compose.onNodeWithTag("aksara-glass-modal").assertExists()
        compose.onNodeWithText("×").performClick()
        compose.onNodeWithContentDescription("Tetapan Aksara").performClick()
        compose.onNodeWithTag("aksara-glass-modal").assertExists()
        compose.onNodeWithText("Buka Voice & pilih peranti").assertDoesNotExist()
        compose.onNodeWithText("×").performClick()
        compose.onNodeWithContentDescription("Ciri & Fungsi").performClick()
        compose.onNodeWithTag("aksara-glass-modal").assertExists()
        compose.onNodeWithText("×").performClick()
        compose.onNodeWithContentDescription("Connection").performClick()
        compose.onNodeWithTag("aksara-glass-modal").assertExists()
    }

    @Test fun voicePreviewKeepsThreePrimaryActionsWithoutPttOrCcButtons() {
        compose.setContent {
            AksaraScreen(ChatState(loaded=true),initialOverlay="voice-fixture")
        }
        compose.onNodeWithContentDescription("Tamatkan sesi").assertExists()
        compose.onNodeWithText("PTT").assertDoesNotExist()
        compose.onNodeWithText("PTT ON").assertDoesNotExist()
        compose.onNodeWithText("CC").assertDoesNotExist()
    }

    @Test fun searchHubContainsMessagesSessionsAndMemory() {
        compose.setContent { AksaraScreen(ChatState(loaded = true)) }
        compose.onNodeWithContentDescription("Carian, sesi dan memori").performClick()
        compose.onNodeWithText("Cari Mesej").assertExists()
        compose.onNodeWithText("Sesi & Sejarah").assertExists()
        compose.onNodeWithText("Memori").assertExists()
        compose.onNodeWithText("Sesi & Sejarah").performClick()
        compose.onNodeWithText("Import JSON").assertExists()
        compose.onNodeWithText("Memori").performClick()
        compose.onNodeWithText("Urus Memori & Privasi dalam Tetapan").assertExists()
    }

    @Test fun externalHomeRequiresConfirmationAndCancelStaysInApp() {
        compose.setContent { AksaraScreen(ChatState(loaded = true)) }
        compose.onNodeWithContentDescription("Ciri & Fungsi").performClick()
        compose.onNodeWithText("Laman Utama").performClick()
        compose.onNodeWithText("Buka Laman Utama?").assertExists()
        compose.onNodeWithText("Anda akan dibawa keluar", substring = true).assertExists()
        compose.onNodeWithText("Batal").performClick()
        compose.onNodeWithText("Buka Laman Utama?").assertDoesNotExist()
    }

    @Test fun composerRemainsFocusableAndPortalHidesExperimentalEngines() {
        compose.setContent { AksaraScreen(ChatState(loaded = true)) }
        compose.onNodeWithContentDescription("Tulis mesej untuk Aksara A.I.").performClick().assertIsFocused()
        compose.onNodeWithContentDescription("Ciri & Fungsi").performClick()
        compose.onNodeWithText("Pilih ruang yang kau mahu teroka dalam ekosistem Aksara.").assertExists()
        compose.onNodeWithText("Game · Linux · SD-Turbo").assertDoesNotExist()
        compose.onNodeWithText("Laman Utama").assertExists()
        compose.onNodeWithText("Studio · Jana Imej").assertExists()
        compose.onNodeWithText("Novel · Perpustakaan AKSARA").assertExists()
        compose.onNodeWithText("Prestasi A.I.").assertDoesNotExist()
        compose.onNodeWithText("Sesi & Sejarah").assertDoesNotExist()
        compose.onNodeWithText("Tetapan Aksara A.I.").assertDoesNotExist()
        compose.onNodeWithText("Security Lab").assertDoesNotExist()
        compose.onNodeWithText("Pengetahuan & Rujukan").assertDoesNotExist()
        compose.onNodeWithText("Privasi & Tetapan").assertDoesNotExist()
    }
}
