package my.aksara.nativeapp

import android.graphics.Bitmap
import android.graphics.Color
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import my.aksara.nativeapp.feature.studio.StudioHistoryStore
import org.junit.Assert.*
import org.junit.Test

/** Runs against actual private PNG and JSON files. Exported MediaStore files are not touched. */
class StudioHistoryAndroidTest {
    @Test fun storedImageSurvivesStoreRecreationAndDeleteIsIsolated() = runBlocking {
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        val store=StudioHistoryStore(context)
        val bitmap=Bitmap.createBitmap(8,8,Bitmap.Config.ARGB_8888).apply { eraseColor(Color.MAGENTA) }
        val record=store.save(bitmap,"LOCAL","SD-Turbo","Test device image",1480L,123L,"1:1","fast")
        try {
            val reopened=StudioHistoryStore(context)
            assertTrue(reopened.list().any{it.id==record.id && it.engine=="LOCAL"})
            val restored=reopened.bitmap(record)
            assertNotNull(restored)
            assertEquals(8,restored!!.width)
            assertEquals(Color.MAGENTA,restored.getPixel(0,0))
        } finally {
            store.delete(record.id)
            assertFalse(store.list().any{it.id==record.id})
            bitmap.recycle()
        }
    }
}