package my.aksara.nativeapp

import androidx.compose.runtime.*
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import my.aksara.nativeapp.feature.chat.*
import my.aksara.nativeapp.core.storage.Message
import org.junit.Rule
import org.junit.Test
import org.junit.Assert.*
import java.io.File

class VisualParityTest {
    @get:Rule val compose = createComposeRule()
    @Test fun captureMatrixAndNavigation() {
        var screen by mutableStateOf("welcome")
        val timestamp=1794117600000L
        compose.setContent {
            key(screen) {
                val fixture = when(screen) {
                    "chat" -> ChatState(messages=listOf(Message("u","user","Terangkan relativiti.",timestamp),Message("a","assistant","Relativiti menghubungkan ruang dan masa. Cahaya bergerak pada kelajuan yang sama bagi semua pemerhati inersia.",timestamp)), loaded=true)
                    "streaming" -> ChatState(messages=listOf(Message("u","user","Terangkan relativiti.",timestamp),Message("a","assistant","",timestamp,true)),busy=true,loaded=true)
                    else -> ChatState(loaded=true)
                }
                AksaraScreen(fixture,initialOverlay=screen.takeIf{it !in listOf("welcome","chat","streaming","composer-focused")},fixedTimestamp=timestamp)
            }
        }
        compose.onNodeWithContentDescription("Tulis mesej untuk Aksara A.I.").assertIsNotFocused()
        compose.onNodeWithContentDescription("Code Engine").performClick()
        compose.onNodeWithText("Code Engine · Runtime Health").assertIsDisplayed()
        compose.onNodeWithText("×").performClick()
        compose.onNodeWithText("Code Engine · Runtime Health").assertDoesNotExist()
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        val out=File(context.getExternalFilesDir(null),"visual").apply{mkdirs()}
        for(name in listOf("welcome","connection","code","terminal","portal","thinking","attachments","voice-permission","streaming","chat","composer-focused")) {
            compose.runOnIdle {screen=name}
            compose.waitForIdle()
            if(name=="composer-focused") compose.onNodeWithContentDescription("Tulis mesej untuk Aksara A.I.").performTextInput("Terangkan relativiti.")
            // Haze draws source/effect in separate render frames.
            Thread.sleep(1000)
            val bitmap=compose.onRoot().captureToImage().asAndroidBitmap()
            val width=(bitmap.width/context.resources.displayMetrics.density).toInt()
            File(out,"$width-$name.png").outputStream().use{bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG,100,it)}
            if(name=="composer-focused") {
                val device=androidx.test.uiautomator.UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
                device.takeScreenshot(File(out,"$width-keyboard.png"));device.pressBack()
            }
        }
        assertTrue(out.listFiles()!!.size>=11)
    }
}
