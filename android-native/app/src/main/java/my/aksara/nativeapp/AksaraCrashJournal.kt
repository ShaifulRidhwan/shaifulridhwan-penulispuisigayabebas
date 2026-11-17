package my.aksara.nativeapp

import android.app.Application
import android.content.Context
import android.os.Process
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Small, local-only fatal exception journal for both :wakeword and main processes.
 * No audio, transcript, prompt, exception message or URL is recorded.
 * Keep the platform's original crash handler: this journal is NOT a crash suppressor.
 */
internal object AksaraCrashJournal {
    private val installed = AtomicBoolean(false)
    @Volatile private var lastStage = "process-created"
    private const val MAX_CAUSES = 3
    private const val MAX_FRAMES = 22

    fun mark(stage:String) {
        // All call sites use fixed application-defined labels, never user input.
        lastStage=stage.take(100)
    }

    private fun processTag():String =
        if(Application.getProcessName().endsWith(":wakeword")) "wakeword" else "main"

    internal fun filename(process:String):String = when(process) {
        "wakeword" -> "aksara-crash-wakeword.txt"
        else -> "aksara-crash-main.txt"
    }

    private fun report(thread:Thread,failure:Throwable,process:String):String {
        val out=StringBuilder(2048)
        out.append("timestamp=").append(System.currentTimeMillis()).append('\n')
        out.append("process=").append(process).append('\n')
        out.append("thread=").append(thread.name.take(60)).append('\n')
        out.append("stage=").append(lastStage).append('\n')
        var cause:Throwable?=failure
        var depth=0
        while(cause!=null && depth<MAX_CAUSES) {
            out.append("exception[").append(depth).append("]=")
                .append(cause.javaClass.name).append('\n')
            cause.stackTrace.take(MAX_FRAMES).forEachIndexed {index,frame ->
                out.append("  ").append(index).append(": ")
                    .append(frame.className).append(".").append(frame.methodName)
                    .append("(").append(frame.fileName ?: "?")
                    .append(":").append(frame.lineNumber).append(")").append('\n')
            }
            cause=cause.cause
            depth++
        }
        return out.toString().take(6000)
    }

    fun install(context:Context) {
        if(!installed.compareAndSet(false,true)) return
        val previous=Thread.getDefaultUncaughtExceptionHandler()
        val appContext=context.applicationContext
        val tag=processTag()
        Thread.setDefaultUncaughtExceptionHandler { thread,throwable ->
            try {
                // One small synchronous file is intentional: the process is dying.
                File(appContext.filesDir,filename(tag)).writeText(
                    report(thread,throwable,tag),Charsets.UTF_8)
            } catch (_:Throwable) {
                // Never replace or mask the real crash with diagnostics failure.
            } finally {
                if(previous!=null) previous.uncaughtException(thread,throwable)
                else Process.killProcess(Process.myPid())
            }
        }
    }

    data class SavedReport(val timestamp:Long,val process:String,val text:String)

    fun mostRecent(context:Context,process:String):SavedReport? {
        return try {
            val file=File(context.filesDir,filename(process))
            if(!file.isFile) return null
            val value=file.readText(Charsets.UTF_8).take(6000)
            val timestamp=value.lineSequence().firstOrNull()
                ?.removePrefix("timestamp=")?.toLongOrNull() ?: return null
            SavedReport(timestamp,process,value)
        } catch (_:Exception) {
            null
        }
    }
}

class AksaraApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        AksaraCrashJournal.install(this)
    }
}
