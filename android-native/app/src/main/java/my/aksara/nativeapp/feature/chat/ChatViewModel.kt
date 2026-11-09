package my.aksara.nativeapp.feature.chat

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import my.aksara.nativeapp.BuildConfig
import my.aksara.nativeapp.core.network.*
import my.aksara.nativeapp.core.storage.*
import my.aksara.engine.voice.VoiceContextTurn
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

data class ChatState(val messages: List<Message> = emptyList(), val archive: List<Message> = emptyList(), val busy: Boolean = false,
    val error: String? = null, val providers: List<Pair<String, String>> = emptyList(), val providerDetails: Map<String, String> = emptyMap(), val sessionStarts: List<String> = emptyList(), val mode: String = "cahaya", val loaded: Boolean = false, val nextJourney: String? = null,
    val memoryEnabled: Boolean = false, val memoryNotes: String = "", val summaryStatus: String = "not_requested",
    val resumedFromHistory: Boolean = false,
    val lastProvider: String = "", val lastModel: String = "", val lastResearchStatus: String = "", val lastToolsUsed: List<String> = emptyList(),
    val lastEvidenceLevel: String = "not_checked")
class ChatViewModel(app: Application) : AndroidViewModel(app) {
    private val api = ChatApi(BuildConfig.API_ORIGIN)
    private val store = SessionStore(app)
    private val contextStore = SessionContextStore(app)
    private val contextMutex = Mutex()
    private val archiveMutex = Mutex()
    private var savedContext = SavedConversationContext()
    private var contextReadable = true
    private val mutable = MutableStateFlow(ChatState())
    val state = mutable.asStateFlow()
    private var requestJob: Job? = null
    private var storageReadable = true
    private var activeAttachment: ActiveAttachment? = null
    init {
        viewModelScope.launch {
            try {
                val snapshot = store.loadSnapshot()
                val archive = snapshot.messages
                try { savedContext = contextStore.load() }
                catch (_: Exception) {
                    contextReadable = false
                    mutable.update { it.copy(error = "Tetapan konteks tersulit tidak dapat dibaca. Fail asal dikekalkan.") }
                }
                mutable.update { it.copy(archive = archive, sessionStarts = snapshot.sessionStarts, loaded = true,
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
    private suspend fun persistArchive() = archiveMutex.withLock {
        check(storageReadable) { "Fail sesi asal belum dapat dibaca." }
        val combined = mergeSessionArchive(state.value.archive, state.value.messages)
        store.save(combined, state.value.sessionStarts)
        mutable.update { it.copy(archive = mergeSessionArchive(it.archive, combined)) }
    }
    fun acceptVoiceTurns(turns: List<VoiceContextTurn>) {
        // Gemini callbacks arrive off the main thread. Never store raw audio or
        // unfinished fragments; completed transcript turns are ordinary session history.
        viewModelScope.launch(Dispatchers.Main.immediate) {
            val messages = turns.filter { it.role in setOf("user", "assistant") && it.content.isNotBlank() }
                .map { Message(UUID.randomUUID().toString(), it.role, it.content,
                    provider = if (it.role == "assistant") "gemini" else null) }
            if (messages.isEmpty()) return@launch
            state.first { it.loaded }
            mutable.update { it.copy(messages = it.messages + messages,
                sessionStarts = if (it.messages.isEmpty() || it.resumedFromHistory) (it.sessionStarts + messages.first().id).distinct() else it.sessionStarts,
                resumedFromHistory = false) }
            try { withContext(NonCancellable) { persistArchive() } }
            catch (_: Exception) { mutable.update { it.copy(error = "Transkrip suara belum berjaya disimpan. Teks kekal di skrin.") } }
        }
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
    fun restore() { if (!state.value.busy) {
        activeAttachment=null
        mutable.update { it.copy(messages = it.archive, resumedFromHistory = false) }
    } }
    fun restoreSession(startId: String) {
        if (state.value.busy) return
        activeAttachment=null
        val selected = groupSessions(state.value.archive, state.value.sessionStarts)
            .firstOrNull { it.startId == startId } ?: return
        mutable.update { it.copy(messages = selected.messages, nextJourney = null, error = null, resumedFromHistory = true) }
    }
    fun clearScreen() { if (!state.value.busy) {
        activeAttachment=null
        savedContext = savedContext.copy(sessionFirstId = "", summary = "", summarizedThrough = 0, thoughtLedger = emptyList())
        mutable.update { it.copy(messages = emptyList(), summaryStatus = "not_requested", resumedFromHistory = false) }
        viewModelScope.launch { runCatching { persistContext() } }
    } }
    fun refreshProviders() = viewModelScope.launch {
        try {
            val rows = api.post(BackendRoutes.CHAT, JSONObject().put("providerStatus", true))
                .optJSONArray("providers") ?: throw java.io.IOException("Provider health returned invalid JSON.")
            val entries = (0 until rows.length()).map { rows.getJSONObject(it) }
            val statuses = entries.map { it.optString("id") to it.optString("status", "unknown") }
            val details = entries.associate { provider ->
                val reason = provider.optString("reason").takeIf { it.isNotBlank() && it != "null" }
                val pool = provider.optJSONArray("pool")
                val poolSummary = if (pool != null) {
                    val online = (0 until pool.length()).count { pool.optJSONObject(it)?.optString("status") == "online" }
                    val ready = (0 until pool.length()).count { pool.optJSONObject(it)?.optString("status") == "ready" }
                    "Gemini slots: " + online + " online, " + ready + " ready, " + pool.length() + " configured"
                } else null
                provider.optString("id") to listOfNotNull(reason, poolSummary).joinToString(" · ")
            }
            mutable.update { it.copy(providers = statuses, providerDetails = details) }
        } catch (e: Exception) {
            if (e !is CancellationException) mutable.update {
                val reason = if (e.message?.startsWith("Backend unreachable") == true) "Backend unreachable"
                    else "Backend error: " + (e.message ?: "unavailable").take(90)
                it.copy(providers = listOf("backend" to reason), providerDetails = mapOf("backend" to reason))
            }
        }
    }
    fun journey(question: String) {
        if(state.value.busy || !state.value.loaded)return
        viewModelScope.launch {
            val rows = withContext(Dispatchers.IO) { JSONArray(getApplication<Application>().assets.open("journey.json").bufferedReader().use {it.readText()}) }
            val normal: (String)->String = {it.lowercase().replace(Regex("[^a-z0-9]"),"")}
            val i=(0 until rows.length()).firstOrNull {normal(rows.getJSONObject(it).getString("question"))==normal(question)}?:return@launch
            val row=rows.getJSONObject(i)
            val prior=state.value.messages
            val user=Message(UUID.randomUUID().toString(),"user",row.getString("question"))
            val messages=prior+user+Message(UUID.randomUUID().toString(),"assistant",row.getString("answer"),provider="aksara_local")
            mutable.update {it.copy(messages=messages,
                sessionStarts=if(prior.isEmpty() || it.resumedFromHistory) (it.sessionStarts+user.id).distinct() else it.sessionStarts,
                resumedFromHistory=false,
                nextJourney=rows.optJSONObject(i+1)?.optString("question"))}
            if(storageReadable)try{persistArchive()}catch(_:Exception){mutable.update{it.copy(error="Sesi belum berjaya disimpan.")}}
        }
    }
    fun send(question: String, documentText: String = "", documentName: String = "", media: JSONArray? = null,
             uploadedFiles: JSONArray? = null, attachmentNames: List<String> = emptyList()): Boolean {
        if (question.isBlank() || state.value.busy || !state.value.loaded) return false
        val previous = state.value.messages
        val newAttachment = attachmentNames.isNotEmpty() ||
            documentText.isNotBlank() || (media?.length() ?: 0)>0 || (uploadedFiles?.length() ?: 0)>0
        val now = System.currentTimeMillis()
        val historicalNames = previous.asReversed().firstOrNull { it.role=="user" && it.text.contains("[Lampiran: ") }
            ?.text?.substringAfter("[Lampiran: ")?.substringBefore("]")?.split(", ") ?: emptyList()
        val available = activeAttachment
        val usesOld = !newAttachment &&
            (available?.let { AttachmentContinuity.references(question,it.names) } == true ||
                (available==null && historicalNames.isNotEmpty() &&
                    AttachmentContinuity.references(question,historicalNames)))
        if (usesOld && available==null) {
            mutable.update { it.copy(error="Rujukan lampiran terdahulu tidak lagi tersedia selepas sesi dimuat semula. Muat naik fail asal sekali lagi supaya AI dapat membacanya.") }
            return false
        }
        if (usesOld && available!=null && !AttachmentContinuity.receiptValid(available,now)) {
            activeAttachment=null
            mutable.update { it.copy(error="Resit Gemini Files sudah menghampiri tamat tempoh. Muat naik semula fail sebelum meneruskan analisis.") }
            return false
        }
        val effective = if(newAttachment) ActiveAttachment(
            names=attachmentNames,documentText=documentText,documentName=documentName,
            mediaJson=(media?:JSONArray()).toString(),receiptsJson=(uploadedFiles?:JSONArray()).toString(),
            sinceMs=now) else if(usesOld) available else null
        val note = if(newAttachment) "\n\n[Lampiran: "+AttachmentContinuity.manifest(attachmentNames)+"]" else ""
        val user = Message(UUID.randomUUID().toString(), "user", question+note)
        val assistant = Message(UUID.randomUUID().toString(), "assistant", "", incomplete = true)
        if (newAttachment) activeAttachment=effective
        mutable.update { it.copy(messages = previous + user + assistant,
            sessionStarts = if (previous.isEmpty() || it.resumedFromHistory) (it.sessionStarts + user.id).distinct() else it.sessionStarts,
            resumedFromHistory = false, busy = true, error = null, nextJourney = null) }
        requestJob = viewModelScope.launch(start = CoroutineStart.UNDISPATCHED) {
            try {
                // Persist the user's prompt before any summarization or inference.
                // Cancellation, process death or upstream failure must not erase this turn.
                if (!storageReadable) throw java.io.IOException("Sesi asal tidak dapat dibaca. Mesej kekal di skrin; permintaan belum dihantar.")
                try {
                    withContext(NonCancellable) {
                        persistArchive()
                    }
                } catch (e: CancellationException) { throw e }
                catch (e: Exception) {
                    throw java.io.IOException("Simpanan awal gagal. Mesej kekal di skrin; permintaan belum dihantar.", e)
                }
                val firstId = previous.firstOrNull()?.id ?: user.id
                if (savedContext.sessionFirstId != firstId) {
                    savedContext = savedContext.copy(sessionFirstId = firstId, summary = "", summarizedThrough = 0, thoughtLedger = emptyList())
                }
                val completed = previous.filterNot { it.incomplete }
                val window = ContextPolicy.summaryWindow(completed.size, savedContext.summarizedThrough)
                if (window != null) {
                    val segment = completed.slice(window)
                    if (segment.size >= 4) {
                        try {
                            val body = JSONObject().put("summarize", true).put("summary", savedContext.summary)
                                .put("contextFallback", false)
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
                    .put("memoryNotes", notes).put("thoughtLedger", JSONArray().apply {
                        savedContext.thoughtLedger.takeLast(8).forEach { put(JSONObject().put("idea",it.idea).put("status",it.status)) }
                    })
                    .put("documentText", effective?.documentText ?: documentText)
                    .put("documentName", effective?.documentName ?: documentName)
                    .put("media", effective?.let { JSONArray(it.mediaJson).takeIf { arr -> arr.length()>0 } } ?: JSONObject.NULL)
                    .put("fileUploads", effective?.let { JSONArray(it.receiptsJson).takeIf { arr -> arr.length()>0 } } ?: JSONObject.NULL)
                require(payload.toString().toByteArray(Charsets.UTF_8).size <= 5_350_000) {
                    "Jumlah mesej, sejarah dan lampiran melebihi had API 5.35 MB."
                }
                api.chat(payload).collect { event ->
                    if(event is ChatEvent.Done && event.thoughtLedger.isNotEmpty()) {
                        savedContext = savedContext.copy(thoughtLedger = ContextPolicy.mergeThoughtLedger(savedContext.thoughtLedger,event.thoughtLedger))
                    }
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
                        persistArchive()
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
