package my.aksara.nativeapp.core.linux

import android.app.Application
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.util.Log
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.inputmethod.InputMethodManager
import androidx.compose.runtime.*
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import com.termux.terminal.TerminalSession
import com.termux.terminal.TerminalSessionClient
import com.termux.view.TerminalView
import com.termux.view.TerminalViewClient
import java.io.File

/**
 * Real PTY-backed Android terminal sessions.
 *
 * Runtime label is deliberately "Android shell" until a self-contained
 * Linux userland has passed its independent executable/bootstrap checks.
 * No root, su or automatic privileged commands are used.
 */
class AksaraLinuxViewModel(app: Application) : AndroidViewModel(app),
    TerminalSessionClient, TerminalViewClient {

    class Slot(val name: String, val terminal: TerminalSession) {
        var ended by mutableStateOf(false)
    }

    val slots = mutableStateListOf<Slot>()
    var selected by mutableIntStateOf(0)
        private set
    var ctrlDown by mutableStateOf(false)
        private set
    var altDown by mutableStateOf(false)
        private set
    var fontSize by mutableIntStateOf(15)
        private set
    var problem by mutableStateOf<String?>(null)
        private set
    var installed by mutableStateOf(AksaraLinuxRuntime.installed(app))
        private set
    val bundled: Boolean = AksaraLinuxRuntime.bundled(app)
    var installing by mutableStateOf(false)
        private set
    var installStatus by mutableStateOf<String?>(null)
        private set

    private var terminalView: TerminalView? = null

    init { addSession() }

    fun installAlpine() {
        if (installed || installing || !bundled) return
        installing = true
        installStatus = "Memasang rootfs Alpine..."
        viewModelScope.launch {
            try {
                withContext(Dispatchers.IO) {
                    AksaraLinuxRuntime.install(getApplication())
                }
                installed = AksaraLinuxRuntime.installed(getApplication())
                require(installed) { "Pemasangan Alpine tidak lengkap." }
                slots.forEach { it.terminal.finishIfRunning() }
                slots.clear()
                selected = 0
                addSession()
                installStatus = "Alpine dipasang. Sesi Linux dimulakan."
            } catch (failure: Exception) {
                problem = failure.message ?: "Pemasangan Alpine gagal."
                installStatus = "Pemasangan gagal."
            } finally {
                installing = false
            }
        }
    }

    fun addSession() {
        if (slots.size >= 6) return
        val app = getApplication<Application>()
        val workspace = File(app.filesDir, "linux-workspace").apply { mkdirs() }
        val env = arrayOf(
            "HOME=" + workspace.absolutePath,
            "PWD=" + workspace.absolutePath,
            "TMPDIR=" + app.cacheDir.absolutePath,
            "PATH=/system/bin:/system/xbin:/vendor/bin",
            "TERM=xterm-256color",
            "LANG=en_US.UTF-8"
        )
        val session = if (installed)
            AksaraLinuxRuntime.createSession(app, this)
        else TerminalSession(
            "/system/bin/sh",
            workspace.absolutePath,
            arrayOf("/system/bin/sh"),
            env,
            2000,
            this
        )
        val slot = Slot((if (installed) "Linux " else "Shell ") + (slots.size + 1), session)
        slots.add(slot)
        selected = slots.lastIndex
        terminalView?.attachSession(session)
        problem = null
    }

    fun selectSession(index: Int) {
        if (index !in slots.indices) return
        selected = index
        terminalView?.attachSession(slots[index].terminal)
    }

    fun closeSession(index: Int) {
        if (index !in slots.indices) return
        slots[index].terminal.finishIfRunning()
        slots.removeAt(index)
        if (slots.isEmpty()) {
            selected = 0
            addSession()
        } else {
            selected = selected.coerceAtMost(slots.lastIndex)
            terminalView?.attachSession(slots[selected].terminal)
        }
    }

    fun attach(view: TerminalView) {
        if (terminalView !== view) {
            terminalView = view
            view.setTerminalViewClient(this)
            view.setTextSize(fontSize)
        }
        val session = slots.getOrNull(selected)?.terminal ?: return
        if (view.currentSession !== session) view.attachSession(session)
    }

    fun detach(view: TerminalView) {
        if (terminalView === view) terminalView = null
    }

    fun send(sequence: String) {
        slots.getOrNull(selected)?.takeUnless { it.ended }?.terminal?.write(sequence)
    }

    fun extraKey(label: String) {
        when (label) {
            "CTRL" -> ctrlDown = !ctrlDown
            "ALT" -> altDown = !altDown
            else -> send(LinuxTerminalKeyMap.sequence(label))
        }
    }

    fun resizeFont(delta: Int) {
        fontSize = (fontSize + delta).coerceIn(11, 26)
        terminalView?.setTextSize(fontSize)
    }

    fun paste() {
        val clipboard = getApplication<Application>()
            .getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val text = clipboard.primaryClip?.getItemAt(0)
            ?.coerceToText(getApplication())?.toString() ?: return
        send(text.take(8192))
    }

    override fun onCleared() {
        slots.forEach { it.terminal.finishIfRunning() }
        slots.clear()
        terminalView = null
        super.onCleared()
    }

    // Session callbacks are dispatched by the Termux emulator's main handler.
    override fun onTextChanged(changedSession: TerminalSession) {
        if (slots.getOrNull(selected)?.terminal === changedSession)
            terminalView?.onScreenUpdated()
    }
    override fun onTitleChanged(changedSession: TerminalSession) {
        if (slots.getOrNull(selected)?.terminal === changedSession)
            terminalView?.invalidate()
    }
    override fun onSessionFinished(finishedSession: TerminalSession) {
        slots.firstOrNull { it.terminal === finishedSession }?.ended = true
        if (slots.getOrNull(selected)?.terminal === finishedSession)
            terminalView?.onScreenUpdated()
    }
    override fun onCopyTextToClipboard(session: TerminalSession, text: String) {
        val manager = getApplication<Application>()
            .getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        manager.setPrimaryClip(ClipData.newPlainText("Aksara Linux", text))
    }
    override fun onPasteTextFromClipboard(session: TerminalSession?) = paste()
    override fun onBell(session: TerminalSession) {}
    override fun onColorsChanged(session: TerminalSession) {
        if (slots.getOrNull(selected)?.terminal === session) terminalView?.invalidate()
    }
    override fun onTerminalCursorStateChange(state: Boolean) {}
    override fun setTerminalShellPid(session: TerminalSession, pid: Int) {}
    override fun getTerminalCursorStyle(): Int? = null

    // TerminalViewClient: full keyboard, IME, selection and screen handling.
    override fun onScale(scale: Float): Float {
        if (scale > 1.10f) resizeFont(1)
        if (scale < 0.90f) resizeFont(-1)
        return 1f
    }
    override fun onSingleTapUp(e: MotionEvent) {
        val view = terminalView ?: return
        view.requestFocus()
        val ime = getApplication<Application>()
            .getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        ime.showSoftInput(view, InputMethodManager.SHOW_IMPLICIT)
    }
    override fun shouldBackButtonBeMappedToEscape() = false
    override fun shouldEnforceCharBasedInput() = true
    override fun shouldUseCtrlSpaceWorkaround() = false
    override fun isTerminalViewSelected() = true
    override fun copyModeChanged(copyMode: Boolean) {}
    override fun onKeyDown(keyCode: Int, e: KeyEvent, session: TerminalSession) = false
    override fun onKeyUp(keyCode: Int, e: KeyEvent) = false
    override fun onLongPress(event: MotionEvent) = false
    override fun readControlKey() = ctrlDown
    override fun readAltKey() = altDown
    override fun readShiftKey() = false
    override fun readFnKey() = false
    override fun onCodePoint(codePoint: Int, ctrlDown: Boolean, session: TerminalSession) = false
    override fun onEmulatorSet() {
        terminalView?.onScreenUpdated()
    }

    override fun logError(tag: String, message: String) { Log.e(tag, message) }
    override fun logWarn(tag: String, message: String) { Log.w(tag, message) }
    override fun logInfo(tag: String, message: String) { Log.i(tag, message) }
    override fun logDebug(tag: String, message: String) { Log.d(tag, message) }
    override fun logVerbose(tag: String, message: String) { Log.v(tag, message) }
    override fun logStackTraceWithMessage(tag: String, message: String, e: Exception) {
        Log.e(tag, message, e)
    }
    override fun logStackTrace(tag: String, e: Exception) { Log.e(tag, "Terminal error", e) }
}
