package my.aksara.nativeapp

import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import my.aksara.engine.runtime.RuntimeClient
import my.aksara.engine.voice.LiveVoiceClient
import org.junit.Assert.*
import org.junit.Test

class NativeEngineTest {
    private val context=InstrumentationRegistry.getInstrumentation().targetContext
    @Test fun javascriptShellAndSqlActuallyExecute()=runBlocking {
        val client=RuntimeClient(context)
        assertEquals("42",withTimeout(10000){client.execute("javascript","console.log(6*7)")}.trim())
        assertTrue(withTimeout(10000){client.execute("shell","printf 'native-shell-ok'")}.contains("native-shell-ok"))
        assertTrue(withTimeout(10000){client.execute("sql","SELECT 6*7 AS result")}.contains("42"))
    }
    @Test fun isolatedShellCannotReadApplicationPrivateData()=runBlocking {
        val file=java.io.File(context.filesDir,"isolation-test.txt").apply{writeText("PRIVATE_SENTINEL_8593")}
        try{
            val output=withTimeout(10000){RuntimeClient(context).execute("shell","cat ${file.absolutePath}")}
            assertFalse(output.contains("PRIVATE_SENTINEL_8593"))
            assertTrue(output.contains("Permission denied")||output.contains("No such file"))
        }finally{file.delete()}
    }
    @Test fun voiceDoesNotSendAudioWithoutPermission() {
        val instrument=InstrumentationRegistry.getInstrumentation()
        instrument.uiAutomation.executeShellCommand("pm revoke my.aksara.nativeapp android.permission.RECORD_AUDIO").close()
        val client=LiveVoiceClient(context,BuildConfig.API_ORIGIN,"Test identity")
        try{client.start();assertEquals("error",client.state.value.phase);assertNull(client.state.value.startedAt)}finally{client.close()}
    }
}
