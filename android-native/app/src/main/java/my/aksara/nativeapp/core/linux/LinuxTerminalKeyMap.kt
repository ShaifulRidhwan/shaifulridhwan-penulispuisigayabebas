package my.aksara.nativeapp.core.linux

/**
 * VT100/ANSI sequences sent directly to the PTY. Modifier keys are handled
 * by TerminalViewClient so CTRL/ALT work with ordinary IME input as well.
 */
object LinuxTerminalKeyMap {
    fun sequence(key: String): String = when (key) {
        "ESC" -> "\u001b"
        "TAB" -> "\t"
        "ENTER" -> "\r"
        "←" -> "\u001b[D"
        "→" -> "\u001b[C"
        "↑" -> "\u001b[A"
        "↓" -> "\u001b[B"
        "HOME" -> "\u001b[H"
        "END" -> "\u001b[F"
        "PGUP" -> "\u001b[5~"
        "PGDN" -> "\u001b[6~"
        "DEL" -> "\u007f"
        else -> ""
    }
}
