package my.aksara.nativeapp.core.linux

/** Pure tab-index calculation avoids attaching a different PTY after a close. */
internal object LinuxSessionSelection {
    fun afterClose(selected: Int, removed: Int, countBefore: Int): Int {
        require(countBefore > 0 && removed in 0 until countBefore)
        val remaining = countBefore - 1
        if (remaining == 0) return 0
        return (if (removed < selected) selected - 1 else selected)
            .coerceIn(0, remaining - 1)
    }
}

/** Only explicit, non-mutating commands. Never interpolate user input into a shell. */
internal object LinuxQuickCommands {
    data class Action(val id: String, val label: String, val command: String, val linuxOnly: Boolean = false)
    private val actions = listOf(
        Action("pwd", "PWD", "pwd"),
        Action("ls", "FILES", "ls -la"),
        Action("disk", "DISK", "df -h"),
        Action("kernel", "KERNEL", "uname -a"),
        Action("git", "GIT", "git status", linuxOnly = true),
        Action("python", "PYTHON", "python3 --version", linuxOnly = true),
        Action("packages", "PACKAGES", "apk info", linuxOnly = true)
    )
    fun forRuntime(installed: Boolean): List<Action> =
        actions.filter { installed || !it.linuxOnly }
    fun sequence(id: String, installed: Boolean): String? =
        forRuntime(installed).firstOrNull { it.id == id }?.command?.plus("\r")
}
