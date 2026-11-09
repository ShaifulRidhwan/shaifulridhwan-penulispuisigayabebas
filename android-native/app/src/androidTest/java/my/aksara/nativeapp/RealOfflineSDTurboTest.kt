package my.aksara.nativeapp

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.ConnectivityManager
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.util.Log
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import my.aksara.nativeapp.feature.studio.LocalModelManager
import my.aksara.nativeapp.feature.studio.LocalSDTurboEngine
import my.aksara.nativeapp.feature.studio.SDTurboSpec
import my.aksara.nativeapp.feature.studio.StudioGateway
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Actual Android inference acceptance. Run on a physical arm64 device with the verified model
 * already installed by Studio. Disable BOTH Wi-Fi and mobile data BEFORE invoking this test.
 * When prerequisites are absent JUnit SKIPS: that is NOT a PASS for offline inference.
 * No mock engine, canned bitmap, or Cloud request is used.
 */
@RunWith(AndroidJUnit4::class)
class RealOfflineSDTurboTest {
    @Test fun twoRealSeedsGenerateAndSavedPixelsReopenWithNoNetwork() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val network = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        assumeTrue("Requires physical arm64 device", !isEmulator() && Build.SUPPORTED_ABIS.contains("arm64-v8a"))
        assumeTrue("Disable Wi-Fi and mobile data first", network.activeNetwork == null)
        val manager = LocalModelManager(context)
        val path = manager.modelPath()
        assumeTrue("Verified SD-Turbo GGUF must be installed using the Studio model manager", path != null)
        assertTrue("Model checksum must pass", manager.verify())
        val runtime = LocalSDTurboEngine()
        assertTrue("JNI-enabled APK required", runtime.available())

        val prompt = "A red paper boat on a calm blue lake at sunrise, photographic detail"
        val first = runtime.generate(path!!, prompt, 42L)
        assertEquals(SDTurboSpec.width, first.width)
        assertEquals(SDTurboSpec.height, first.height)
        val pixels = IntArray(first.width * first.height)
        first.getPixels(pixels, 0, first.width, 0, 0, first.width, first.height)
        assertTrue("Native output must contain real pixel variation", pixels.distinct().size > 16)

        val second = runtime.generate(path, prompt, 4242L)
        assertFalse("Different seeds must not produce the same fixed sample", first.sameAs(second))
        val savedName = StudioGateway.save(context, first)
        val images = MediaStore.Images.Media.EXTERNAL_CONTENT_URI
        val resolver = context.contentResolver
        var storedUri: Uri? = null
        resolver.query(images, arrayOf(MediaStore.Images.Media._ID),
            "${MediaStore.Images.Media.DISPLAY_NAME}=?", arrayOf(savedName), null)?.use { cursor ->
            if (cursor.moveToFirst()) {
                storedUri = Uri.withAppendedPath(images, cursor.getLong(0).toString())
            }
        }
        assertNotNull("Generated local image must be saved to media storage", storedUri)
        val reopened: Bitmap? = resolver.openInputStream(storedUri!!)?.use { BitmapFactory.decodeStream(it) }
        assertNotNull("Saved PNG must reopen", reopened)
        assertEquals(SDTurboSpec.width, reopened!!.width)
        assertEquals(SDTurboSpec.height, reopened.height)
        assertTrue("Saved pixels must match generated pixels", first.sameAs(reopened))
        Log.i("AksaraSDTurboTest", "offline_two_seed_image_and_gallery_reopen_pass")
        Unit // JUnit @Test must return void, never the Int returned by Log.i().
    }

    private fun isEmulator(): Boolean =
        Build.FINGERPRINT.contains("generic", ignoreCase = true) ||
        Build.MODEL.contains("Emulator", ignoreCase = true) ||
        Build.MODEL.contains("sdk_gphone", ignoreCase = true)
}
