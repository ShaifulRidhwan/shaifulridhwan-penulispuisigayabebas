package my.aksara.nativeapp

import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import my.aksara.nativeapp.core.storage.PendingDraftStore
import my.aksara.nativeapp.core.storage.OfflineDraftPolicy
import org.junit.Assert.*
import org.junit.Test
import java.io.File

class P4EncryptedDraftStoreAndroidTest {
    @Test fun realAndroidKeystoreEncryptsDraftsAndRestoresThem():Unit = runBlocking {
        val app=InstrumentationRegistry.getInstrumentation().targetContext
        val store=PendingDraftStore(app)
        val previous=store.load()
        val marker="p4-sensitive-test-value-" + System.currentTimeMillis()
        try {
            val rows=OfflineDraftPolicy.add(emptyList(),marker)
            store.save(rows)
            val raw=File(app.noBackupFilesDir,"offline-drafts-v1.enc").readBytes()
            assertTrue(raw.size>29)
            assertEquals(1,raw[0].toInt())
            assertFalse(String(raw,Charsets.ISO_8859_1).contains(marker))
            val reread=PendingDraftStore(app).load()
            assertEquals(marker,reread.single().text)
        } finally {
            store.save(previous)
        }
    }
}
