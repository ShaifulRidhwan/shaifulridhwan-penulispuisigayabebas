package my.aksara.nativeapp

import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test

class NativeGameAssetsTest {
    @Test fun offlineGameRuntimeIsBundled() {
        val assets=InstrumentationRegistry.getInstrumentation().targetContext.assets
        val html=assets.open("game/index.html").bufferedReader().use{it.readText()}
        assertTrue(html.contains("phaser.min.js"))
        // WebViewAssetLoader deliberately uses HTTPS for its local exit route.
        // Reject external URLs without mistaking that local navigation for a CDN.
        Regex("""https?://[^'"\s<>]+""").findAll(html).forEach {
            assertEquals("Unexpected remote game dependency", "https://appassets.androidplatform.net/exit", it.value)
        }
        Regex("""(?:src|href)\s*=\s*['"]([^'"]+)['"]""").findAll(html).forEach {
            val path=it.groupValues[1]
            assertFalse("Resource must be a bundled relative path: $path",java.net.URI(path).isAbsolute || path.startsWith("//"))
            assertTrue("Missing bundled resource: $path",assets.open("game/$path").use { input -> input.read()>=0 })
        }
        for(name in listOf("phaser.min.js","combat.js","game.js")) {
            assertTrue("Missing local runtime: $name",assets.open("game/$name").use{it.readBytes().size}>100)
        }
    }
}
