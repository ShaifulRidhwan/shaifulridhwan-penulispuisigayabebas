package my.aksara.nativeapp

import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test

class NativeGameAssetsTest {
    @Test fun offlineGameRuntimeIsBundled() {
        val assets=InstrumentationRegistry.getInstrumentation().targetContext.assets
        val html=assets.open("game/index.html").bufferedReader().use{it.readText()}
        assertTrue(html.contains("phaser.min.js"))
        assertFalse(html.contains("https://"))
        for(name in listOf("phaser.min.js","combat.js","game.js")) {
            assertTrue("Missing local runtime: $name",assets.open("game/$name").use{it.readBytes().size}>100)
        }
    }
}
