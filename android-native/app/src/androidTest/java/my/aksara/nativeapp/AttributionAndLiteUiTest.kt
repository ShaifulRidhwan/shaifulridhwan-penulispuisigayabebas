package my.aksara.nativeapp

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import my.aksara.nativeapp.feature.chat.*
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
