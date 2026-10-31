package my.aksara.ai.ui

import android.app.Application
import android.os.SystemClock
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import my.aksara.ai.data.AksaraApi
import my.aksara.ai.data.ChatSession
import my.aksara.ai.data.ChatStore
import my.aksara.ai.data.ChatTurn
import my.aksara.ai.data.SavedWorkspace
import my.aksara.ai.data.SessionCodec

class AksaraViewModel(application: Application) : AndroidViewModel(application) {
    private val api = AksaraApi()
    private val store = ChatStore(application)
    private val loaded = store.load()
    private var requestJob: Job? = null
    private var activeRequestId = 0

    val sessions = mutableStateListOf<ChatSession>().apply { addAll(loaded.sessions) }
    val messages = mutableStateListOf<ChatTurn>()
    var activeId by mutableStateOf(loaded.activeId)
        private set
    var mode by mutableStateOf("cahaya")
        private set
    var saveSession by mutableStateOf(loaded.saveEnabled)
        private set
    var busy by mutableStateOf(false)
        private set
    var status by mutableStateOf("Memeriksa backend…")
        private set
    var statusReady by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var streamingTick by mutableStateOf(0)
        private set
    var lastProvider by mutableStateOf<String?>(null)
        private set
    var lastLatencyMs by mutableStateOf<Long?>(null)
        private set

    init {
        restoreSelected()
        checkBackend()
    }

    private fun current(): ChatSession? = sessions.firstOrNull { it.id == activeId }

    private fun restoreSelected() {
        val session = current() ?: return
        mode = session.mode
        messages.clear()
        messages.addAll(session.messages)
        lastProvider = session.messages.lastOrNull { it.role == "assistant" }?.provider
    }

    private fun updateCurrent() {
        val index = sessions.indexOfFirst { it.id == activeId }
        if (index >= 0) {
            sessions[index] = sessions[index].copy(
                mode = mode,
                messages = messages.toList(),
                updatedAt = System.currentTimeMillis()
            )
        }
        store.persist(SavedWorkspace(sessions.toList(), activeId, saveSession))
    }

    fun checkBackend() {
        if (busy) return
        status = "Memeriksa backend…"
        viewModelScope.launch {
            val configured = api.probe()
            if (!busy) {
                statusReady = configured
                status = if (configured) "Backend tersedia · belum diuji" else "Backend tidak tersedia"
            }
        }
    }

    fun selectMode(next: String) {
        if (next in listOf("cahaya", "gelap") && !busy) {
            mode = next
            updateCurrent()
        }
    }

    fun updateSessionSaving(enabled: Boolean) {
        saveSession = enabled
        updateCurrent() // OFF deletes all persisted workspace data immediately.
    }

    fun newSession() {
        if (busy) return
        if (sessions.size >= 12) {
            error = "Had 12 sesi tempatan dicapai. Padam sesi lama sebelum mencipta sesi baharu."
            return
        }
        updateCurrent()
        val session = SessionCodec.blank()
        sessions.add(0, session)
        activeId = session.id
        restoreSelected()
        error = null
        updateCurrent()
    }

    fun openSession(id: String) {
        if (busy || id == activeId || sessions.none { it.id == id }) return
        updateCurrent()
        activeId = id
        restoreSelected()
        error = null
        updateCurrent()
    }

    fun renameSession(id: String, title: String) {
        val value = title.trim().replace(Regex("""\s+"""), " ").take(64)
        val index = sessions.indexOfFirst { it.id == id }
        if (busy || index < 0 || value.isBlank()) return
        sessions[index] = sessions[index].copy(title = value)
        updateCurrent()
    }

    fun deleteSession(id: String) {
        if (busy) return
        val index = sessions.indexOfFirst { it.id == id }
        if (index < 0) return
        sessions.removeAt(index)
        if (sessions.isEmpty()) sessions.add(SessionCodec.blank())
        if (activeId == id) {
            activeId = sessions.first().id
            restoreSelected()
        }
        error = null
        updateCurrent()
    }

    fun clear() {
        if (busy) return
        messages.clear()
        error = null
        lastProvider = null
        lastLatencyMs = null
        updateCurrent()
    }

    fun stop() {
        if (!busy) return
        api.cancelStream()
        requestJob?.cancel()
        status = "Dihentikan"
    }

    fun retryLast(): Boolean {
        if (busy || messages.isEmpty()) return false
        val last = messages.last()
        if (last.role == "assistant" && !last.complete) messages.removeAt(messages.lastIndex)
        val user = messages.lastOrNull()
        if (user?.role != "user") return false
        val question = user.content
        messages.removeAt(messages.lastIndex)
        updateCurrent()
        return send(question)
    }

    fun regenerateLast(): Boolean {
        if (busy || messages.size < 2) return false
        if (messages.last().role != "assistant") return false
        messages.removeAt(messages.lastIndex)
        val user = messages.lastOrNull()
        if (user?.role != "user") return false
        val question = user.content
        messages.removeAt(messages.lastIndex)
        updateCurrent()
        return send(question)
    }

    fun send(text: String): Boolean {
        val question = text.trim()
        if (question.isBlank() || question.length > 12_000 || busy) return false
        val sessionId = activeId
        val history = messages.toList()
        if (current()?.title == "Sesi Baharu" && history.none { it.role == "user" }) {
            val index = sessions.indexOfFirst { it.id == activeId }
            if (index >= 0) sessions[index] = sessions[index].copy(
                title = SessionCodec.titleFor(question)
            )
        }
        messages.add(ChatTurn(role = "user", content = question))
        updateCurrent()
        busy = true
        status = "Aksara sedang berfikir…"
        error = null
        lastLatencyMs = null
        val myRequest = ++activeRequestId
        val started = SystemClock.elapsedRealtime()
        var assistantId: String? = null
        var lastPaintMs = 0L
        requestJob = viewModelScope.launch {
            try {
                val result = api.chatStream(question, mode, history) { partial ->
                    // Avoid expensive Markdown parsing and scroll updates for every token.
                    val now = SystemClock.elapsedRealtime()
                    if (now - lastPaintMs < 80L && partial.length < 80) return@chatStream
                    if (now - lastPaintMs < 80L) return@chatStream
                    lastPaintMs = now
                    withContext(Dispatchers.Main.immediate) {
                    if (activeId != sessionId || myRequest != activeRequestId) return@withContext
                    if (assistantId == null) {
                        val turn = ChatTurn(
                            role = "assistant", content = partial, complete = false
                        )
                        assistantId = turn.id
                        messages.add(turn)
                    } else {
                        val index = messages.indexOfFirst { it.id == assistantId }
                        if (index >= 0) {
                            messages[index] = messages[index].copy(
                                content = partial, complete = false
                            )
                        }
                    }
                    status = "Aksara sedang menjawab…"
                    streamingTick++
                    }

                }
                if (activeId == sessionId && myRequest == activeRequestId) {
                    val turn = ChatTurn(
                        role = "assistant", content = result.reply,
                        provider = result.provider, complete = true,
                        id = assistantId ?: java.util.UUID.randomUUID().toString()
                    )
                    val index = messages.indexOfFirst { it.id == assistantId }
                    if (index >= 0) messages[index] = turn else messages.add(turn)
                    lastProvider = result.provider
                    lastLatencyMs = SystemClock.elapsedRealtime() - started
                    statusReady = true
                    status = "Sedia"
                }
            } catch (e: CancellationException) {
                error = "Jawapan dihentikan. Bahagian yang sudah diterima dikekalkan."
                status = "Dihentikan"
            } catch (e: Exception) {
                error = (e.message ?: "Sambungan terputus. Cuba lagi.").take(260)
                status = "Gangguan sambungan"
                statusReady = false
            } finally {
                busy = false
                requestJob = null
                updateCurrent()
            }
        }
        return true
    }

    fun canRetry(): Boolean = !busy &&
        (messages.lastOrNull()?.role == "user" ||
            (messages.lastOrNull()?.role == "assistant" &&
                messages.lastOrNull()?.complete == false &&
                messages.dropLast(1).lastOrNull()?.role == "user"))
}
