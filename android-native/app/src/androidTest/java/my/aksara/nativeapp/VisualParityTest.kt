package my.aksara.nativeapp

import androidx.compose.runtime.*
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import my.aksara.nativeapp.feature.chat.*
import my.aksara.nativeapp.core.storage.Message
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Rule
import org.junit.Test
import org.junit.Assert.*
import java.io.File
import androidx.compose.ui.unit.dp

class VisualParityTest {
    @get:Rule val compose = createAndroidComposeRule<VisualTestActivity>()
    @Test fun captureMatrixAndNavigation() {
        var screen by mutableStateOf("welcome")
        val timestamp=1794117600000L
        compose.setContent {
            key(screen) {
                val fixture = when(screen) {
                    "chat" -> ChatState(messages=listOf(Message("u","user","Terangkan relativiti.",timestamp),Message("a","assistant","Relativiti menghubungkan ruang dan masa. Cahaya bergerak pada kelajuan yang sama bagi semua pemerhati inersia. 🙂 ✨",timestamp)), loaded=true)
                    "streaming" -> ChatState(messages=listOf(Message("u","user","Terangkan relativiti.",timestamp),Message("a","assistant","",timestamp,true)),busy=true,loaded=true)
                    else -> ChatState(loaded=true)
                }
                AksaraScreen(fixture,initialOverlay=(if(screen=="voice")"voice-fixture" else screen).takeIf{it !in listOf("welcome","chat","streaming","composer-focused")},fixedTimestamp=timestamp)
            }
        }
        val device=androidx.test.uiautomator.UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        fun dismissSystemEducation(){
            val button=device.findObject(androidx.test.uiautomator.By.text("Got it"))
            if(button!=null){button.click();device.wait(androidx.test.uiautomator.Until.gone(androidx.test.uiautomator.By.text("Viewing full screen")),3000)}
            check(!device.hasObject(androidx.test.uiautomator.By.text("Viewing full screen"))){"CAPTURE_OBSTRUCTED: Android immersive education is still visible"}
        }
        device.waitForIdle();dismissSystemEducation()
        compose.onNodeWithContentDescription("Tulis mesej untuk Aksara A.I.").assertIsNotFocused()
        compose.onNodeWithContentDescription("Code Engine").assertDoesNotExist()
        compose.onNodeWithContentDescription("Terminal").assertDoesNotExist()
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        // Critical chrome must not be clipped by immersive rounded Android corners.
        // Keep background full-bleed while checking the interactive glass geometry.
        val screenWidth=(device.displayWidth/context.resources.displayMetrics.density).dp
        for(tag in listOf("topbar","conversation","composer-form")) {
            val bounds=compose.onNodeWithTag(tag).getUnclippedBoundsInRoot()
            assertTrue("$"+"tag left edge clipped: $"+"bounds",bounds.left >= 8.dp)
            assertTrue("$"+"tag right edge clipped: $"+"bounds",bounds.right <= screenWidth-8.dp)
        }
        val out=File(context.getExternalFilesDir(null),"visual").apply{mkdirs()}
        for(name in listOf("welcome","connection","portal","thinking","attachments","voice-permission","streaming","chat","composer-focused","voice")) {
            compose.runOnIdle {screen=name}
            compose.waitForIdle()
            if(name=="voice") {
                val capsule=compose.onNodeWithTag("voice-status-pill").getUnclippedBoundsInRoot()
                val end=compose.onNodeWithTag("voice-end-session").getUnclippedBoundsInRoot()
                assertTrue("LIVE timer clipped below 110dp: $capsule",(capsule.right-capsule.left)>=110.dp)
                assertTrue("LIVE capsule overlaps End Session",capsule.right<=end.left)
                compose.onNodeWithText("00:00").assertExists()
            }
            if(name=="composer-focused") {
                compose.onNodeWithContentDescription("Tulis mesej untuk Aksara A.I.").performTextInput("Terangkan relativiti.")
                compose.runOnIdle {androidx.core.view.WindowCompat.getInsetsController(compose.activity.window,compose.activity.window.decorView).hide(androidx.core.view.WindowInsetsCompat.Type.ime())}
            }
            // Haze draws source/effect in separate render frames.
            Thread.sleep(1000)
            dismissSystemEducation()
            val width=(device.displayWidth/context.resources.displayMetrics.density).toInt()
            val screenshot=File(out,"$width-$name.png")
            assertTrue("SurfaceFlinger screenshot failed: $name",device.takeScreenshot(screenshot))
            assertTrue("Empty screenshot: $name",screenshot.length()>0)
            File(out,"$width-$name.capture.json").writeText(JSONObject().put("method","UiDevice.takeScreenshot / SurfaceFlinger").put("systemEducationVisible",false).put("density",context.resources.displayMetrics.density).put("width",device.displayWidth).put("height",device.displayHeight).toString(2))
            val nodes=JSONArray()
            fun visit(node:SemanticsNode){
                val r=node.boundsInRoot
                nodes.put(JSONObject().put("tag",node.config.getOrNull(SemanticsProperties.TestTag).orEmpty()).put("text",node.config.getOrNull(SemanticsProperties.Text)?.joinToString(" "){it.text}.orEmpty()).put("description",node.config.getOrNull(SemanticsProperties.ContentDescription)?.joinToString(" ").orEmpty()).put("rect",JSONObject().put("x",r.left).put("y",r.top).put("width",r.width).put("height",r.height)))
                node.children.forEach(::visit)
            }
            visit(compose.onRoot(useUnmergedTree=true).fetchSemanticsNode())
            File(out,"$width-$name.json").writeText(nodes.toString(2))
            if(name=="composer-focused") {
                compose.runOnIdle {androidx.core.view.WindowCompat.getInsetsController(compose.activity.window,compose.activity.window.decorView).show(androidx.core.view.WindowInsetsCompat.Type.ime())}
                Thread.sleep(600)
                device.takeScreenshot(File(out,"$width-keyboard.png"));device.pressBack()
            }
        }
        assertTrue(out.listFiles()!!.size>=11)
    }
}
