package my.aksara.nativeapp.core.linux

import android.content.Context
import com.termux.terminal.TerminalSession
import com.termux.terminal.TerminalSessionClient
import java.io.File
import java.nio.file.Files

/**
 * Rootless, real PTY bootstrap. User types SETUJU in the Termux TerminalView,
 * the shell writes a private consent marker, and Android extracts off-main.
 * No terminal emulator duplication, no shell-command interpolation.
 */
internal object AksaraLinuxBootstrap {
    private fun dir(context: Context) = File(context.filesDir, "linux-setup").apply {
        require(isDirectory || mkdirs()) { "Direktori setup Linux tidak dapat dibuat." }
    }
    fun consent(context: Context) = File(dir(context), "consent")
    fun output(context: Context) = File(dir(context), "progress.log")
    fun done(context: Context) = File(dir(context), "finished")

    fun reset(context: Context) {
        for (file in listOf(consent(context), output(context), done(context))) {
            require(!Files.isSymbolicLink(file.toPath())) { "Unsafe Linux setup path" }
            if (file.exists()) require(file.delete()) { "Tidak boleh reset fail setup Linux" }
        }
        require(output(context).createNewFile()) { "Tidak boleh mula log setup Linux" }
    }

    fun progress(context: Context, status: LinuxInstallProgress) {
        output(context).appendText(
            "[" + status.percent.toString() + "%] " + status.stage +
                if (status.filesTotal > 0)
                    " (" + status.filesDone + "/" + status.filesTotal + ")\n"
                else "\n"
        )
    }

    fun createSession(context: Context, client: TerminalSessionClient): TerminalSession {
        reset(context)
        val work = AksaraLinuxRuntime.workspace(context)
        val source = context.assets.open("linux/first-setup.sh")
            .bufferedReader(Charsets.UTF_8).use { it.readText() }
        return TerminalSession(
            "/system/bin/sh", work.absolutePath,
            arrayOf("/system/bin/sh", "-c", source),
            arrayOf(
                "HOME=" + work.absolutePath,
                "PATH=/system/bin:/system/xbin",
                "TERM=xterm-256color",
                "LANG=en_US.UTF-8",
                "AKSARA_SETUP_CONSENT=" + consent(context).absolutePath,
                "AKSARA_SETUP_LOG=" + output(context).absolutePath,
                "AKSARA_SETUP_DONE=" + done(context).absolutePath
            ),
            2000, client
        )
    }
}
