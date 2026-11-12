package my.aksara.nativeapp.core.linux

import android.content.Context
import java.io.File

/**
 * Android-side privilege boundary for the forthcoming Aksara Linux terminal.
 *
 * IMPORTANT: /system/bin/sh is the Android shell, NOT a Linux distribution.
 * The real Linux userland/PTY bootstrap must be implemented separately.
 *
 * Root is an explicitly requested session mode only. Neither initialization
 * nor availability probing runs su or invokes a root authorization dialog.
 */
internal object LinuxPrivilegeManager {
    enum class Mode { USER, ROOT }

    data class PrivilegeState(
        val mode: Mode,
        val executable: String,
        val authorizationRequested: Boolean
    )

    /**
     * Returns likely installed su paths without invoking elevated commands.
     * This is only a hint, not proof that root authorization will be granted.
     */
    fun installedSuCandidates(): List<String> =
        listOf("/system/bin/su", "/system/xbin/su", "/sbin/su", "/su/bin/su")
            .filter { File(it).exists() && File(it).canExecute() }

    /**
     * Call this ONLY in direct response to the user selecting "Start ROOT
     * session". The installed superuser manager is responsible for approval.
     *
     * No user command is concatenated into an su command string.
     */
    fun launchAndroidShell(context: Context, rootRequestedByUser: Boolean): Pair<Process, PrivilegeState> {
        val command = if (rootRequestedByUser) {
            listOf("su", "-c", "exec /system/bin/sh")
        } else {
            listOf("/system/bin/sh")
        }
        val workspace = File(context.filesDir, "linux-workspace").apply { mkdirs() }
        val process = ProcessBuilder(command)
            .directory(workspace)
            .redirectErrorStream(true)
            .apply {
                environment()["HOME"] = workspace.absolutePath
                environment()["TERM"] = "xterm-256color"
            }
            .start()
        return process to PrivilegeState(
            mode = if (rootRequestedByUser) Mode.ROOT else Mode.USER,
            executable = command.first(),
            authorizationRequested = rootRequestedByUser
        )
    }

    /** Verify within the established session: an su process is not proof of UID 0. */
    fun isVerifiedRootUid(idOutput: String): Boolean = idOutput.trim() == "0"
}
