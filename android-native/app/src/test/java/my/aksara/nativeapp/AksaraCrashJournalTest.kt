package my.aksara.nativeapp

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class AksaraCrashJournalTest {
    @Test fun processesWriteDistinctLocalReports() {
        assertEquals("aksara-crash-main.txt",AksaraCrashJournal.filename("main"))
        assertEquals("aksara-crash-wakeword.txt",AksaraCrashJournal.filename("wakeword"))
        assertFalse(AksaraCrashJournal.filename("main")==
            AksaraCrashJournal.filename("wakeword"))
    }

    @Test fun applicationInstallsFatalJournalBeforeActivityLaunch() {
        val sources=listOf(
            File("src/main/AndroidManifest.xml") to
                File("src/main/java/my/aksara/nativeapp/AksaraCrashJournal.kt"),
            File("app/src/main/AndroidManifest.xml") to
                File("app/src/main/java/my/aksara/nativeapp/AksaraCrashJournal.kt")
        )
        val match=sources.firstOrNull { it.first.isFile && it.second.isFile }
            ?: error("Android application source fixture unavailable")
        val manifest=match.first.readText()
        val app=match.second.readText()
        assertTrue(manifest.contains("android:name=\".AksaraApplication\""))
        assertTrue(app.contains("Thread.setDefaultUncaughtExceptionHandler"))
        assertTrue(app.contains("previous.uncaughtException(thread,throwable)"))
        assertTrue(app.contains("cause.stackTrace") ||
            app.contains("current.stackTrace"))
    }
}
