package my.aksara.nativeapp.core.linux

/** Pure tab rules, so a closing/restarting tab never silently switches PTYs. */
internal object LinuxSessionSelection {
    data class RestartPlan(val index: Int, val name: String)

    fun afterClose(selected: Int, removed: Int, countBefore: Int): Int {
        require(countBefore > 0 && removed in 0 until countBefore)
        val remaining = countBefore - 1
        if (remaining == 0) return 0
        return (if (removed < selected) selected - 1 else selected)
            .coerceIn(0, remaining - 1)
    }

    fun restartPlan(selected: Int, names: List<String>, ended: Boolean): RestartPlan? {
        if (!ended || selected !in names.indices) return null
        return RestartPlan(index = selected, name = names[selected])
    }
}

/** Explicit user-triggered terminal shortcuts. No command runs automatically. */
internal object LinuxQuickCommands {
    enum class Category(val label: String, val icon: String) {
        FILES("FILES", "file-text"),
        SYSTEM("SYSTEM", "activity"),
        DEV("DEV", "code"),
        GIT("GIT", "network")
    }

    data class Action(
        val id: String,
        val label: String,
        val icon: String,
        val command: String,
        val category: Category,
        val linuxOnly: Boolean = false
    )

    private val actions = listOf(
        Action("pwd", "PWD", "terminal", "pwd", Category.FILES),
        Action("ls", "FILES", "file-text", "ls -la", Category.FILES),
        Action("disk", "DISK", "activity", "df -h", Category.FILES),
        Action("imports", "IMPORTS", "file-text",
            "aksara-share inbox", Category.FILES, linuxOnly = true),
        Action("outbox", "OUTBOX", "file-text",
            "aksara-share outbox", Category.FILES, linuxOnly = true),
        Action("kernel", "KERNEL", "code", "uname -a", Category.SYSTEM),
        Action("process", "PROCESSES", "activity", "ps", Category.SYSTEM),
        Action("doctor", "DOCTOR", "activity", "aksara-doctor", Category.SYSTEM,
            linuxOnly = true),
        Action("capabilities", "CAPS", "code", "aksara-capabilities",
            Category.SYSTEM, linuxOnly = true),
        Action("server", "SERVER", "network",
            "python3 -m http.server 8000 --bind 127.0.0.1",
            Category.SYSTEM, linuxOnly = true),
        Action("git", "GIT", "network", "git status", Category.DEV, linuxOnly = true),
        Action("python", "PYTHON", "code", "python3 --version", Category.DEV, linuxOnly = true),
        Action("packages", "PACKAGES", "file-text", "apk info", Category.DEV, linuxOnly = true),
        Action("branch", "BRANCH", "network",
            "git branch --show-current", Category.GIT, linuxOnly = true),
        Action("git-log", "LOG", "file-text",
            "git log -3 --oneline", Category.GIT, linuxOnly = true),
        Action("remote", "REMOTE", "network",
            "git remote -v", Category.GIT, linuxOnly = true),
        Action("ssh-test", "SSH TEST", "network",
            "ssh -o BatchMode=yes -o ConnectTimeout=5 -T git@github.com",
            Category.GIT, linuxOnly = true)
    )

    fun categories(installed: Boolean): List<Category> =
        Category.entries.filter { category -> forRuntime(installed, category).isNotEmpty() }

    fun forRuntime(installed: Boolean): List<Action> =
        actions.filter { installed || !it.linuxOnly }

    fun forRuntime(installed: Boolean, category: Category): List<Action> =
        forRuntime(installed).filter { it.category == category }

    fun sequence(id: String, installed: Boolean): String? =
        forRuntime(installed).firstOrNull { it.id == id }?.command?.plus("\r")
}

/** Sourced by Alpine's login shell; users can override PS1 in ~/.profile. */
internal object LinuxShellIdentity {
    const val relativePath = "etc/profile.d/99-aksara-prompt.sh"
    val profile = """
        # AKSARA Linux: visual identity only, no commands or privileges.
        case "${'$'}-" in *i*) ;; *) return 0 ;; esac
        [ "${'$'}{AKSARA_PROMPT_OFF:-0}" = "1" ] && return 0
        PS1='aksara:\w ❯ '
        export PS1
    """.trimIndent() + "\n"
}
