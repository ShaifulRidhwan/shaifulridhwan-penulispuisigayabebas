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
    @Test fun fourPortalItemsRemainReachableOnShortScreen(){
        compose.setContent { Box(Modifier.fillMaxWidth().height(360.dp)) {
            AksaraScreen(ChatState(loaded=true),initialOverlay="portal")
        }}
        for(label in listOf("Laman Utama","Game · Cahaya vs Gelap","Studio · Jana Imej","Novel · Perpustakaan AKSARA")) {
            compose.onNodeWithText(label).performScrollTo().assertIsDisplayed()
        }
    }
}
