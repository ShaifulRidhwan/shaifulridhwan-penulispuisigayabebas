package my.aksara.nativeapp.feature.voice

import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.content.Context
import android.os.Build
import my.aksara.nativeapp.AksaraCrashJournal
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

internal data class AksaraExitEvent(
    val timestamp:Long,
    val summary:String
)

/**
 * Android 11+ own-package process exit history. No logcat permission, no
 * recording, no private transcript, no uploaded crash report.
 *
 * Avoid assuming an OEM "keeps stopping" toast is a Java exception: report
 * the reason as classified by ActivityManager, or report nothing.
 */
internal object AksaraExitDiagnostics {
    fun interestingReason(reason:Int):Boolean = reason in setOf(
        ApplicationExitInfo.REASON_CRASH,
        ApplicationExitInfo.REASON_CRASH_NATIVE,
        ApplicationExitInfo.REASON_ANR,
        ApplicationExitInfo.REASON_LOW_MEMORY,
        ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE,
        ApplicationExitInfo.REASON_SIGNALED
    )

    private fun reasonLabel(reason:Int):String = when(reason) {
        ApplicationExitInfo.REASON_CRASH -> "Java/Kotlin crash"
        ApplicationExitInfo.REASON_CRASH_NATIVE -> "Native crash"
        ApplicationExitInfo.REASON_ANR -> "App tidak responsif (ANR)"
        ApplicationExitInfo.REASON_LOW_MEMORY -> "Android menamatkan proses kerana memori"
        ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE -> "Had penggunaan sumber"
        ApplicationExitInfo.REASON_SIGNALED -> "Proses ditamatkan dengan signal"
        else -> "Proses terhenti"
    }

    fun latest(context:Context):AksaraExitEvent? {
        if(Build.VERSION.SDK_INT<Build.VERSION_CODES.R) return null
        return try {
            val now=System.currentTimeMillis()
            val am=context.getSystemService(ActivityManager::class.java)
            val exit=am.getHistoricalProcessExitReasons(context.packageName,0,12)
                .filter { interestingReason(it.reason) &&
                    now-it.timestamp in 0L..(12L*60L*60L*1000L) }
                .maxByOrNull { it.timestamp } ?: return null
            val process=if(exit.processName.endsWith(":wakeword"))
                "Enjin wake word" else "Aplikasi utama"
            val time=SimpleDateFormat("dd MMM HH:mm:ss",Locale.ROOT)
                .format(Date(exit.timestamp))
            val processId=if(exit.processName.endsWith(":wakeword"))
                "wakeword" else "main"
            val saved=AksaraCrashJournal.mostRecent(context,processId)
            // Only correlate a synchronous fatal-handler record from the SAME
            // process and close to this specific Android exit event.
            val matching=saved?.takeIf {
                kotlin.math.abs(it.timestamp-exit.timestamp)<=90_000L
            }
            val base="Android lapor ${reasonLabel(exit.reason)} pada $process ($time). "+
                "Reason ${exit.reason}; status ${exit.status}."
            AksaraExitEvent(
                exit.timestamp,
                if(matching!=null) base+"\n"+matching.text
                else base+"\nException stack belum tersedia. Crash Journal hanya boleh merakam crash selepas versi ini dipasang.")
        } catch (_:Exception) {
            null // OEMs may restrict historical process-exit access.
        }
    }
}
