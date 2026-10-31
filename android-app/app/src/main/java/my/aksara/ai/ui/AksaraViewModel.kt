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
import my.aksara.ai.data.AksaraLocalExtras
import my.aksara.ai.data.AksaraMemorySelector
import my.aksara.ai.data.AksaraUsageEvent
import my.aksara.ai.data.AttachmentDraft
import my.aksara.ai.data.ChatRequestOptions
import my.aksara.ai.data.ProviderSnapshot
import my.aksara.ai.data.ChatSession
import my.aksara.ai.data.ChatStore
import my.aksara.ai.data.ChatTurn
import my.aksara.ai.data.SavedWorkspace
import my.aksara.ai.data.SessionCodec

class AksaraViewModel(application: Application) : AndroidViewModel(application) {
    private val api = AksaraApi()
    private val store = ChatStore(application)
    private val extras = AksaraLocalExtras(application)
    private val loaded = store.load()
    private var requestJob: Job? = null
    private var activeRequestId = 0

    val sessions = mutableStateListOf<ChatSession>().apply { addAll(loaded.sessions) }
    val messages = mutableStateListOf<ChatTurn>()
    val usage = mutableStateListOf<AksaraUsageEvent>().apply { addAll(extras.events()) }
    var providerSnapshot by mutableStateOf<ProviderSnapshot?>(null)
        private set
    var providerLoading by mutableStateOf(false)
        private set
    var providerError by mutableStateOf<String?>(null)
        private set
    var workspaceTitle by mutableStateOf(extras.workspaceTitle())
        private set
    var workspaceContent by mutableStateOf(extras.workspaceContent())
        private set

    var memoryNote by mutableStateOf(extras.note())
        private set
    var memoryEnabled by mutableStateOf(extras.memoryEnabled())
        private set
    var contextFallback by mutableStateOf(extras.contextFallback())
        private set
    var mediaFallback by mutableStateOf(extras.imageFallback())
        private set
    var summarizing by mutableStateOf(false)
        private set
    var knowledgeMessage by mutableStateOf<String?>(null)
        private set
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

    fun refreshProviders() {
        if (providerLoading) return
        providerLoading = true
        providerError = null
        viewModelScope.launch {
            try {
                providerSnapshot = api.providerStatus()
            } catch (error: Exception) {
                providerError = (error.message ?: "Status provider tidak tersedia.").take(240)
            } finally {
                providerLoading = false
            }
        }
    }

    fun updateWorkspace(title: String, content: String) {
        workspaceTitle = title.take(80)
        workspaceContent = content.take(12000)
        extras.saveWorkspace(workspaceTitle, workspaceContent)
    }

    fun copyLastAnswerToWorkspace() {
        val content = messages.lastOrNull { it.role == "assistant" && it.complete }?.content
            ?: return
        updateWorkspace(workspaceTitle.ifBlank { "Nota daripada AKSARA" }, content)
    }

    fun updateMemoryNote(value: String) {
        memoryNote = value.take(8000)
        extras.storeNote(memoryNote)
    }

    fun changeMemoryEnabled(next: Boolean) {
        memoryEnabled = next
        extras.setMemoryEnabled(next)
    }

    fun forgetMemory() {
        memoryNote = ""
        extras.clearMemory()
    }

    fun changeContextFallback(next: Boolean) {
        contextFallback = next
        extras.setContextFallback(next)
    }

    fun changeMediaFallback(next: Boolean) {
        mediaFallback = next
        extras.setImageFallback(next)
    }

    fun clearMetrics() {
        usage.clear()
        extras.clearMetrics()
    }

    private fun usageEvent(provider: String, durationMs: Long, ok: Boolean) {
        usage.add(AksaraUsageEvent(
            at = System.currentTimeMillis(),
            provider = provider.ifBlank { "unknown" }.take(40),
            durationMs = durationMs.coerceAtLeast(0),
            successful = ok
        ))
        while (usage.size > 120) usage.removeAt(0)
        extras.record(usage.toList(), saveSession)
    }

    fun summarizeCurrent() {
        if (busy || summarizing || messages.count { it.complete } < 4) {
            knowledgeMessage = "Perlu sekurang-kurangnya empat mesej lengkap untuk ringkasan."
            return
        }
        val id = activeId
        val history = messages.toList()
        val previous = current()?.summary.orEmpty()
        summarizing = true
        knowledgeMessage = "Aksara sedang meringkaskan konteks sesi…"
        viewModelScope.launch {
            try {
                val brief = api.summarize(history, previous)
                val index = sessions.indexOfFirst { it.id == id }
                if (index >= 0) {
                    sessions[index] = sessions[index].copy(summary = brief)
                    updateCurrent()
                }
                knowledgeMessage = "Ringkasan konteks disimpan untuk sesi ini, tanpa memadam mesej."
            } catch (error: Exception) {
                knowledgeMessage = (error.message ?: "Ringkasan tidak berjaya.").take(200)
            } finally {
                summarizing = false
            }
        }
    }

    fun togglePinSession(id: String) {
        if (busy) return
        val index = sessions.indexOfFirst { it.id == id }
        if (index >= 0) {
            sessions[index] = sessions[index].copy(pinned = !sessions[index].pinned)
            updateCurrent()
        }
    }

    fun exportSessions(): String = SessionCodec.serialize(sessions.toList(), activeId)

    fun importSessions(json: String): Boolean {
        if (busy || !saveSession) {
            knowledgeMessage = "Aktifkan simpan sesi sebelum mengimport arkib."
            return false
        }
        if (json.length > 2_000_000) {
            knowledgeMessage = "Fail arkib terlalu besar."
            return false
        }
        return try {
            val imported = SessionCodec.parse(json, true)
            if (sessions.size + imported.sessions.size > 12) {
                knowledgeMessage = "Had maksimum 12 sesi. Padam sesi lama dahulu."
                false
            } else {
                imported.sessions.filter { it.messages.isNotEmpty() }.forEach { entry ->
                    sessions.add(entry.copy(id = java.util.UUID.randomUUID().toString()))
                }
                updateCurrent()
                knowledgeMessage = "Arkib berjaya diimport. Sejarah sedia ada dikekalkan."
                true
            }
        } catch (_: Exception) {
            knowledgeMessage = "Format arkib tidak sah. Tiada sesi diubah."
            false
        }
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
        if (!enabled) extras.clearMetrics()
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

    fun send(text: String, attachment: AttachmentDraft? = null): Boolean {
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
        val annotation = attachment?.displayName?.let { "\n[Lampiran: $it]" }.orEmpty()
        messages.add(ChatTurn(role = "user", content = question + annotation))
        updateCurrent()
        busy = true
        status = "Aksara sedang berfikir…"
        error = null
        lastLatencyMs = null
        val myRequest = ++activeRequestId
        val started = SystemClock.elapsedRealtime()
        val options = ChatRequestOptions(
            summary = current()?.summary.orEmpty(),
            memoryNotes = if (memoryEnabled) {
                AksaraMemorySelector.select(question, memoryNote)
            } else "",
            contextFallback = contextFallback,
            mediaFallback = mediaFallback,
            preferredProvider = lastProvider.orEmpty(),
            documentText = attachment?.documentText.orEmpty(),
            documentName = attachment?.documentName.orEmpty(),
            media = attachment?.media.orEmpty()
        )
        var assistantId: String? = null
        var lastPaintMs = 0L
        requestJob = viewModelScope.launch {
            try {
                val result = api.chatStream(question, mode, history, options) { partial ->
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
                        sources = result.sources, disclaimer = result.disclaimer,
                        id = assistantId ?: java.util.UUID.randomUUID().toString()
                    )
                    val index = messages.indexOfFirst { it.id == assistantId }
                    if (index >= 0) messages[index] = turn else messages.add(turn)
                    lastProvider = result.provider
                    lastLatencyMs = SystemClock.elapsedRealtime() - started
                    usageEvent(result.provider.orEmpty(), lastLatencyMs ?: 0, true)
                    statusReady = true
                    status = "Sedia"
                }
            } catch (e: CancellationException) {
                error = "Jawapan dihentikan. Bahagian yang sudah diterima dikekalkan."
                status = "Dihentikan"
            } catch (e: Exception) {
                usageEvent("failure", SystemClock.elapsedRealtime() - started, false)
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
