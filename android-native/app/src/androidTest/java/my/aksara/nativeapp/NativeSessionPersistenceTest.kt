package my.aksara.nativeapp

import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import my.aksara.nativeapp.core.storage.Message
import my.aksara.nativeapp.core.storage.SessionStore
import my.aksara.nativeapp.core.storage.SavedConversationContext
import my.aksara.nativeapp.core.storage.SessionContextStore
import my.aksara.nativeapp.feature.chat.mergeSessionArchive
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.util.UUID

class NativeSessionPersistenceTest {
    private val context=InstrumentationRegistry.getInstrumentation().targetContext
    @Test fun interruptedChatSurvivesFreshEncryptedStoreInstance()=runBlocking {
        val store=SessionStore(context)
        val original=store.load()
        val token="PRIVATE_ANDROID_TEST_"+UUID.randomUUID()
        try {
            val user=Message("pending-chat","user",token)
            val unfinished=Message("pending-reply","assistant","partial",incomplete=true,provider="groq")
            store.save(mergeSessionArchive(original,listOf(user,unfinished)))
            val loaded=SessionStore(context).load()
            assertEquals(token,loaded.single{it.id=="pending-chat"}.text)
            assertTrue(loaded.single{it.id=="pending-reply"}.incomplete)
            assertEquals("groq",loaded.single{it.id=="pending-reply"}.provider)
            val bytes=File(context.noBackupFilesDir,"conversation.enc").readBytes()
            assertFalse("Encrypted storage must not contain plaintext",String(bytes,Charsets.ISO_8859_1).contains(token))
        }finally{store.save(original)}
    }

    @Test fun memoryIsOffUntilExplicitlyEnabledAndEncryptedAtRest()=runBlocking{
        val store=SessionContextStore(context)
        val original=store.load()
        val token="PRIVATE_MEMORY_"+UUID.randomUUID()
        try{
            val disabled=SavedConversationContext(memoryEnabled=false,memoryNotes=token)
            store.save(disabled)
            val reopened=SessionContextStore(context).load()
            assertFalse(reopened.memoryEnabled)
            assertEquals(token,reopened.memoryNotes)
            val bytes=File(context.noBackupFilesDir,"context-v1.enc").readBytes()
            assertFalse(String(bytes,Charsets.ISO_8859_1).contains(token))
        }finally{store.save(original)}
    }
}
