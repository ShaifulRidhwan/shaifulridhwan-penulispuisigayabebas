package my.aksara.nativeapp.feature.chat

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import my.aksara.nativeapp.BuildConfig
import my.aksara.nativeapp.core.network.*
import my.aksara.nativeapp.core.storage.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

data class ChatState(val messages: List<Message> = emptyList(), val archive: List<Message> = emptyList(), val busy: Boolean = false,
    val error: String? = null, val providers: List<Pair<String, String>> = emptyList(), val mode: String = "cahaya", val loaded: Boolean = false, val nextJourney: String? = null,
    val memoryEnabled: Boolean = false, val memoryNotes: String = "", val summaryStatus: String = "not_requested",
    val lastProvider: String = "", val lastModel: String = "", val lastResearchStatus: String = "", val lastToolsUsed: List<String> = emptyList(),
    val lastEvidenceLevel: String = "not_checked")
class ChatViewModel(app: Application) : AndroidViewModel(app) {
    private val api = ChatApi(BuildConfig.API_ORIGIN)
    private val store = SessionStore(app)
    private val contextStore = SessionContextStore(app)
    private val contextMutex = Mutex()
    private var savedContext = SavedConversationContext()
    private var contextReadable = true
    private val mutable = MutableStateFlow(ChatState())
    val state = mutable.asStateFlow()
    private var requestJob: Job? = null
    private var storageReadable = true
    init {
        viewModelScope.launch {
            try {
                val archive = store.load()
                try { savedContext = contextStore.load() }
                catch (_: Exception) {
                    contextReadable = false
                    mutable.update { it.copy(error = "Tetapan konteks tersulit tidak dapat dibaca. Fail asal dikekalkan.") }
                }
                mutable.update { it.copy(archive = archive, loaded = true,
                    memoryEnabled = savedContext.memoryEnabled, memoryNotes = savedContext.memoryNotes) }
            } catch (_: Exception) {
                storageReadable = false
                mutable.update { it.copy(error = "Sesi tersimpan belum dapat dibaca. Fail asal dikekalkan.", loaded = true) }
            }
        }
        refreshProviders()
    }
    fun setMode(mode: String) { if(mode in listOf("cahaya","gelap")) mutable.update { it.copy(mode = mode) } }
    private suspend fun persistContext() {
        if (contextReadable) contextMutex.withLock { contextStore.save(savedContext) }
    }
    fun setMemory(enabled: Boolean, notes: String) {
        if (!state.value.loaded || !contextReadable) {
            mutable.update { it.copy(error = "Tetapan memori belum boleh disimpan. Fail asal dikekalkan.") }
            return
        }
        savedContext = savedContext.copy(memoryEnabled = enabled, memoryNotes = notes.take(8000))
        mutable.update { it.copy(memoryEnabled = enabled, memoryNotes = savedContext.memoryNotes) }
        viewModelScope.launch {
            try { persistContext() }
            catch (_: Exception) { mutable.update { it.copy(error = "Gagal menyimpan nota memori. Cuba lagi.") } }
        }
    }
    fun dismissError() { mutable.update { it.copy(error = null) } }
    fun restore() { if (!state.value.busy) mutable.update { it.copy(messages = it.archive) } }
    fun clearScreen() { if (!state.value.busy) {
        savedContext = savedContext.copy(sessionFirstId = "", summary = "", summarizedThrough = 0)
        mutable.update { it.copy(messages = emptyList(), summaryStatus = "not_requested") }
        viewModelScope.launch { runCatching { persistContext() } }
    } }
    fun refreshProviders() = viewModelScope.launch {
        try {
            val rows = api.post(BackendRoutes.CHAT, JSONObject().put("providerStatus", true)).optJSONArray("providers") ?: throw java.io.IOException("Provider health returned invalid JSON.")
            mutable.update { it.copy(providers = (0 until rows.length()).map { i -> rows.getJSONObject(i).let { p -> p.optString("id") to p.optString("status", "unknown") } }) }
        } catch (e: Exception) { if (e !is CancellationException) mutable.update {
            val reason = if(e.message?.startsWith("Backend unreachable") == true) "Backend unreachable"
                else "Backend error: " + (e.message ?: "unavailable").take(90)
            it.copy(providers = listOf("backend" to reason))
        } }
    }
    fun journey(question: String) {
        if(state.value.busy || !state.value.loaded)return
        viewModelScope.launch {
            val rows = withContext(Dispatchers.IO) { JSONArray(getApplication<Application>().assets.open("journey.json").bufferedReader().use {it.readText()}) }
            val normal: (String)->String = {it.lowercase().replace(Regex("[^a-z0-9]"),"")}
            val i=(0 until rows.length()).firstOrNull {normal(rows.getJSONObject(it).getString("question"))==normal(question)}?:return@launch
            val row=rows.getJSONObject(i)
            val messages=state.value.messages+Message(UUID.randomUUID().toString(),"user",row.getString("question"))+Message(UUID.randomUUID().toString(),"assistant",row.getString("answer"),provider="aksara_local")
            mutable.update {it.copy(messages=messages,nextJourney=rows.optJSONObject(i+1)?.optString("question"))}
            if(storageReadable)try{val combined=mergeSessionArchive(state.value.archive,messages);store.save(combined);mutable.update{it.copy(archive=combined)}}catch(_:Exception){mutable.update{it.copy(error="Sesi belum berjaya disimpan.")}}
        }
    }
    fun send(question: String, documentText: String = "", documentName: String = "", media: JSONArray? = null): Boolean {
        if (question.isBlank() || state.value.busy || !state.value.loaded) return false
        val previous = state.value.messages
        val user = Message(UUID.randomUUID().toString(), "user", question)
        val assistant = Message(UUID.randomUUID().toString(), "assistant", "", incomplete = true)
        mutable.update { it.copy(messages = previous + user + assistant, busy = true, error = null, nextJourney = null) }
        requestJob = viewModelScope.launch(start = CoroutineStart.UNDISPATCHED) {
            try {
                // Persist the user's prompt before any summarization or inference.
                // Cancellation, process death or upstream failure must not erase this turn.
                if (!storageReadable) throw java.io.IOException("Sesi asal tidak dapat dibaca. Mesej kekal di skrin; permintaan belum dihantar.")
                try {
                    withContext(NonCancellable) {
                        val pending = mergeSessionArchive(state.value.archive, state.value.messages)
                        store.save(pending)
                        mutable.update { it.copy(archive = pending) }
                    }
                } catch (e: CancellationException) { throw e }
                catch (e: Exception) {
                    throw java.io.IOException("Simpanan awal gagal. Mesej kekal di skrin; permintaan belum dihantar.", e)
                }
                val firstId = previous.firstOrNull()?.id ?: user.id
                if (savedContext.sessionFirstId != firstId) {
                    savedContext = savedContext.copy(sessionFirstId = firstId, summary = "", summarizedThrough = 0)
                }
                val completed = previous.filterNot { it.incomplete }
                val window = ContextPolicy.summaryWindow(completed.size, savedContext.summarizedThrough)
                if (window != null) {
                    val segment = completed.slice(window)
                    if (segment.size >= 4) {
                        try {
                            val body = JSONObject().put("summarize", true).put("summary", savedContext.summary)
                                .put("history", JSONArray().apply { segment.forEach {
                                    put(JSONObject().put("role", it.role).put("content", it.text))
                                } })
                            val response = withTimeout(28_000) { api.post(BackendRoutes.CHAT, body) }
                            val next = response.optString("summary").trim().take(4000)
                            if (next.isNotBlank()) {
                                savedContext = savedContext.copy(summary = next, summarizedThrough = window.last + 1)
                                persistContext()
                                mutable.update { it.copy(summaryStatus = "saved") }
                            } else mutable.update { it.copy(summaryStatus = "unavailable") }
                        } catch (e: CancellationException) { throw e }
                        catch (_: Exception) { mutable.update { it.copy(summaryStatus = "unavailable") } }
                    }
                }
                val history = JSONArray().apply {
                    ContextPolicy.selectHistory(completed, question).forEach {
                        put(JSONObject().put("role", it.role).put("content", it.text))
                    }
                }
                val notes = if (savedContext.memoryEnabled) ContextPolicy.selectMemory(savedContext.memoryNotes, question) else ""
                val payload = JSONObject().put("question", question).put("history", history)
                    // Web requires explicit consent before private notes/documents
                    // can be sent to a fallback provider. Android has no consent UI.
                    .put("thoughtMode", state.value.mode).put("contextFallback", false)
                    .put("mediaFallback", false).put("summary", savedContext.summary)
                    .put("memoryNotes", notes).put("thoughtLedger", JSONArray())
                    .put("documentText", documentText).put("documentName", documentName)
                    .put("media", if (media != null && media.length() > 0) media else JSONObject.NULL)
                require(payload.toString().toByteArray(Charsets.UTF_8).size <= 5_350_000) {
                    "Jumlah mesej, sejarah dan lampiran melebihi had API 5.35 MB."
                }
                api.chat(payload).collect { event ->
                    mutable.update { value -> value.copy(messages = value.messages.map { m ->
                        if (m.id != assistant.id) m else when (event) {
                            is ChatEvent.Delta -> m.copy(text = m.text + event.text)
                            is ChatEvent.Done -> m.copy(text = event.reply + if(event.sources.isEmpty()) "" else
                                "\n\n" + event.sources.joinToString("\n") { "[" + it.first + "](" + it.second + ")" }, incomplete = false, provider = ProviderIdentity.normalize(event.provider))
                        }
                    }, lastProvider = if(event is ChatEvent.Done) event.provider else value.lastProvider,
                        lastModel = if(event is ChatEvent.Done) event.model else value.lastModel,
                        lastResearchStatus = if(event is ChatEvent.Done) event.researchStatus else value.lastResearchStatus,
                        lastToolsUsed = if(event is ChatEvent.Done) event.toolsUsed else value.lastToolsUsed,
                        lastEvidenceLevel = if(event is ChatEvent.Done) event.evidenceLevel else value.lastEvidenceLevel) }
                }
            } catch (e: CancellationException) {
                mutable.update { it.copy(error = "Penjanaan dihentikan. Teks separa dikekalkan.") }
            } catch (e: Exception) {
                val retry = (e as? ApiFailure)?.retryAfter?.toIntOrNull()
                val message = (e.message ?: "Sambungan gagal. Cuba lagi.") +
                    if(retry != null && retry > 0) " Cuba semula selepas "+retry+" saat." else ""
                mutable.update { it.copy(error = message) }
            } finally {
                mutable.update { it.copy(busy = false) }
                withContext(NonCancellable) {
                    try {
                        check(storageReadable) { "Fail sesi asal belum dapat dibaca." }
                        val combined = mergeSessionArchive(state.value.archive, state.value.messages)
                        store.save(combined)
                        mutable.update { it.copy(archive = combined) }
                        persistContext()
                    } catch (_: Exception) {
                        mutable.update { current -> current.copy(error = current.error
                            ?: "Sesi belum berjaya disimpan. Mesej kekal di skrin.") }
                    }
                }
            }
        }
        return true
    }
    fun stop() { requestJob?.cancel() }
}
