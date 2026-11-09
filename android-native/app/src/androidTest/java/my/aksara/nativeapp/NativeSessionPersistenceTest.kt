package my.aksara.nativeapp

import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeout
import android.app.Application
import my.aksara.engine.voice.VoiceContextTurn
import my.aksara.nativeapp.core.storage.Message
import my.aksara.nativeapp.core.storage.SessionStore
import my.aksara.nativeapp.core.storage.SavedConversationContext
import my.aksara.nativeapp.core.storage.SessionContextStore
import my.aksara.nativeapp.feature.chat.mergeSessionArchive
import my.aksara.nativeapp.feature.chat.ChatViewModel
import my.aksara.nativeapp.feature.chat.ContextPolicy
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.util.UUID

class NativeSessionPersistenceTest {
    private val context=InstrumentationRegistry.getInstrumentation().targetContext
    @Test fun completedVoiceTurnsReachChatContextAndEncryptedArchive()=runBlocking {
        val store=SessionStore(context)
        val original=store.load()
        val token="VOICE_TEST_"+UUID.randomUUID()
        try {
            val vm=ChatViewModel(context.applicationContext as Application)
            withTimeout(10_000) { vm.state.first { it.loaded } }
            vm.acceptVoiceTurns(listOf(VoiceContextTurn("user",token),VoiceContextTurn("assistant","Jawapan $token")))
            val state=withTimeout(10_000) { vm.state.first { s -> s.archive.any { it.text=="Jawapan $token" } } }
            assertTrue(ContextPolicy.selectHistory(state.messages,"Sambung").any { it.text==token })
            val reopened=SessionStore(context).load()
            assertEquals(listOf(token,"Jawapan $token"),reopened.filter { it.text.contains(token) }.map { it.text })
            val bytes=File(context.noBackupFilesDir,"conversation.enc").readBytes()
            assertFalse(String(bytes,Charsets.ISO_8859_1).contains(token))
        } finally { store.save(original) }
    }
    @Test fun longArchiveAndFullMessageSurviveEncryptedReopen()=runBlocking {
        val store=SessionStore(context)
        val original=store.load()
        try {
            val messages=(0 until 250).map { Message("long-$it", "user", "message $it", at=it.toLong()) }
            val longMessage=Message("long-body", "assistant", "x".repeat(45_000))
            store.save(messages + longMessage)
            assertEquals(messages + longMessage, SessionStore(context).load())
        } finally { store.save(original) }
    }
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
