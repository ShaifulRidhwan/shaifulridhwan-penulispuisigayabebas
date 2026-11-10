package my.aksara.nativeapp

import androidx.compose.foundation.layout.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import my.aksara.nativeapp.feature.chat.*
import org.junit.Rule
import org.junit.Test

class PortalLayoutTest {
    @get:Rule val compose=createAndroidComposeRule<VisualTestActivity>()
    @Test fun literaryNoticeAppearsBeforeLibraryAndKeepsReadingAccessible(){
        compose.setContent { AksaraScreen(ChatState(loaded=true),initialOverlay="portal") }
        compose.onNodeWithText("Novel • Perpustakaan").performScrollTo().performClick()
        compose.onNodeWithText("AMARAN: KAWASAN SASTERA DILINDUNGI").assertExists()
        compose.onNodeWithText("PERMANENT READ-ONLY · ACCESS DENIED").assertExists()
        compose.onNodeWithText("Saya Faham · Masuk Perpustakaan").performScrollTo().performClick()
        compose.onNodeWithText("Perpustakaan AKSARA · Native").assertExists()
        compose.onNodeWithText("Baca novel · Antara Cahaya dan Gelap").assertExists()
    }

    @Test fun literaryNoticeCanBeClosedWithoutEnteringLibrary(){
        compose.setContent { AksaraScreen(ChatState(loaded=true),initialOverlay="portal") }
        compose.onNodeWithText("Novel • Perpustakaan").performScrollTo().performClick()
        compose.onNodeWithText("Kembali").performScrollTo().performClick()
        compose.onNodeWithText("Perpustakaan AKSARA · Native").assertDoesNotExist()
    }

    @Test fun exploreHasDescriptionsForAllFiveEntries(){
        compose.setContent { AksaraScreen(ChatState(loaded=true),initialOverlay="portal") }
        listOf(
            "Laman web rasmi Shaiful Ridhwan",
            "Prosa, klasik dan sastera falsafah",
            "FLUX · Cloudflare Workers AI",
            "Catur dengan enjin Stockfish",
            "Arena aksi 2D · Cahaya dan Gelap"
        ).forEach { subtitle -> compose.onNodeWithText(subtitle).assertExists() }
    }

    @Test fun exploreEcosystemFooterIsRestored(){
        compose.setContent { AksaraScreen(ChatState(loaded=true),initialOverlay="portal") }
        compose.onNodeWithTag("explore-ecosystem-footer", useUnmergedTree=true).performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Teroka ekosistem Aksara: sastera, kreativiti, kecerdasan A.I. dan dunia permainan.").assertExists()
    }

    @Test fun chatMessagesUseTextIdentityWithoutSigilAvatar(){
        compose.setContent { AksaraScreen(ChatState(loaded=true)) }
        compose.onNodeWithText("Aksara A.I.").assertExists()
        compose.onAllNodesWithContentDescription("Aksara A.I.").assertCountEquals(0)
    }

    @Test fun fiveExploreItemsRemainReachableOnShortScreen(){
        compose.setContent { Box(Modifier.fillMaxWidth().height(360.dp)) {
            AksaraScreen(ChatState(loaded=true),initialOverlay="portal")
        }}
        for(label in listOf("Laman Utama","Novel • Perpustakaan","Studio • Jana Imej","Game • Chess","Game • Cahaya vs Gelap")) {
            compose.onNodeWithText(label).performScrollTo().assertIsDisplayed()
        }
    }
}
