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
    val lastEvidenceLevel: String = "not_checked", val lastReviewApplied: Boolean? = null,
    val capabilities: List<P3Intelligence.Capability> = emptyList(),
    val modelRegistry: List<P3Intelligence.ModelInfo> = emptyList(),
    val pendingDrafts: List<PendingDraft> = emptyList(),
    val completedRequests: Int = 0, val failedRequests: Int = 0)
class ChatViewModel(app: Application) : AndroidViewModel(app) {
    private val api = ChatApi(BuildConfig.API_ORIGIN)
    private val store = SessionStore(app)
    private val contextStore = SessionContextStore(app)
    private val pendingStore = PendingDraftStore(app)
    private val pendingMutex = Mutex()
    private var pendingReadable = true
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
                val drafts=try { pendingStore.load() } catch(_:Exception) {
                    pendingReadable=false
                    mutable.update{it.copy(error="Draf tersulit tidak dapat dibaca. Fail asal dikekalkan.")}
                    emptyList()
                }
                mutable.update { it.copy(archive = archive, sessionStarts = snapshot.sessionStarts, loaded = true,
                    memoryEnabled = savedContext.memoryEnabled, memoryNotes = savedContext.memoryNotes,
                    pendingDrafts = drafts) }
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
    private fun clearAnswerDiagnostics(value: ChatState) = value.copy(
        lastProvider = "", lastModel = "", lastResearchStatus = "",
        lastToolsUsed = emptyList(), lastEvidenceLevel = "not_checked",
        lastReviewApplied = null
    )
    fun dismissError() { mutable.update { it.copy(error = null) } }
    fun restore() { if (!state.value.busy) {
        activeAttachment=null
        mutable.update { clearAnswerDiagnostics(it.copy(messages = it.archive, resumedFromHistory = false)) }
    } }
    fun restoreSession(startId: String) {
        if (state.value.busy) return
        activeAttachment=null
        val selected = groupSessions(state.value.archive, state.value.sessionStarts)
            .firstOrNull { it.startId == startId } ?: return
        mutable.update { clearAnswerDiagnostics(it.copy(messages = selected.messages,
            nextJourney = null, error = null, resumedFromHistory = true)) }
    }
    fun clearScreen() { if (!state.value.busy) {
        activeAttachment=null
        savedContext = savedContext.copy(sessionFirstId = "", summary = "", summarizedThrough = 0, thoughtLedger = emptyList())
        mutable.update { clearAnswerDiagnostics(it.copy(messages = emptyList(),
            summaryStatus = "not_requested", resumedFromHistory = false)) }
        viewModelScope.launch { runCatching { persistContext() } }
    } }
    fun refreshProviders() = viewModelScope.launch {
        try {
            val response = api.post(BackendRoutes.CHAT, JSONObject().put("providerStatus", true))
            val capabilities = P3Intelligence.inventory(response)
            val modelRegistry = P3Intelligence.models(response)
            val rows = response.optJSONArray("providers")
                ?: throw java.io.IOException("Provider health returned invalid JSON.")
            val entries = (0 until rows.length()).map { rows.getJSONObject(it) }
            val statuses = entries.map { it.optString("id") to ProviderConnectionStatus.state(
                it.optString("status", "unknown"), it.optInt("http"), it.optString("reason")) }
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
            mutable.update { it.copy(providers = statuses, providerDetails = details,
                capabilities = capabilities,modelRegistry=modelRegistry) }
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
        mutable.update { clearAnswerDiagnostics(it.copy(messages = previous + user + assistant,
            sessionStarts = if (previous.isEmpty() || it.resumedFromHistory) (it.sessionStarts + user.id).distinct() else it.sessionStarts,
            resumedFromHistory = false, busy = true, error = null, nextJourney = null)) }
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
                            val body = WebBrainBridge.summaryPayload(segment, savedContext.summary)
                            val response = withTimeout(28_000) { api.post(BackendRoutes.CHAT, body) }
                            val next = response.optString("summary").trim().take(4000)
                            if (next.isNotBlank()) {
                                savedContext = savedContext.copy(summary = next, summarizedThrough = window.last + 1)
                                persistContext()
                                mutable.update { it.copy(summaryStatus = "saved") }
                            } else mutable.update { it.copy(summaryStatus = "unavailable") }
                        } catch (_: TimeoutCancellationException) {
                            mutable.update { it.copy(summaryStatus = "unavailable") }
                        } catch (e: CancellationException) { throw e }
                        catch (_: Exception) { mutable.update { it.copy(summaryStatus = "unavailable") } }
                    }
                }
                val payload = WebBrainBridge.chatPayload(
                    question = question, completed = completed, thoughtMode = state.value.mode,
                    summary = savedContext.summary, memoryEnabled = savedContext.memoryEnabled,
                    memoryNotes = savedContext.memoryNotes, thoughtLedger = savedContext.thoughtLedger,
                    documentText = effective?.documentText ?: documentText,
                    documentName = effective?.documentName ?: documentName,
                    media = effective?.let { JSONArray(it.mediaJson) },
                    fileUploads = effective?.let { JSONArray(it.receiptsJson) }
                )
                api.chat(payload).collect { event ->
                    if(event is ChatEvent.Done && event.thoughtLedger.isNotEmpty()) {
                        savedContext = savedContext.copy(thoughtLedger = ContextPolicy.mergeThoughtLedger(savedContext.thoughtLedger,event.thoughtLedger))
                    }
                    mutable.update { value -> value.copy(messages = value.messages.map { m ->
                        if (m.id != assistant.id) m else when (event) {
                            is ChatEvent.Delta -> m.copy(text = m.text + event.text)
                            is ChatEvent.Done -> m.copy(text = event.reply +
                                my.aksara.nativeapp.core.network.EvidenceIntegrity.formatSources(
                                    event.sources,event.evidenceLevel),
                                incomplete = false, provider = ProviderIdentity.normalize(event.provider))
                        }
                    }, lastProvider = if(event is ChatEvent.Done) event.provider else value.lastProvider,
                        lastModel = if(event is ChatEvent.Done) event.model else value.lastModel,
                        lastResearchStatus = if(event is ChatEvent.Done) event.researchStatus else value.lastResearchStatus,
                        lastToolsUsed = if(event is ChatEvent.Done) event.toolsUsed else value.lastToolsUsed,
                        lastEvidenceLevel = if(event is ChatEvent.Done) event.evidenceLevel else value.lastEvidenceLevel,
                        lastReviewApplied = if(event is ChatEvent.Done) event.reviewApplied else value.lastReviewApplied,
                        completedRequests = if(event is ChatEvent.Done) value.completedRequests+1 else value.completedRequests) }
                }
            } catch (e: CancellationException) {
                mutable.update { it.copy(error = "Penjanaan dihentikan. Teks separa dikekalkan.") }
            } catch (e: Exception) {
                mutable.update { it.copy(failedRequests=it.failedRequests+1) }
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
    /** Edit creates a fork, never silently rewrites an already encrypted session. */
    fun forkAndSendFrom(userId: String, revisedQuestion: String): Boolean {
        val snapshot = state.value
        val original = snapshot.messages.firstOrNull { it.id == userId } ?: return false
        if (!snapshot.loaded || snapshot.busy || !storageReadable || !ChatBranching.editable(original)) {
            mutable.update { it.copy(error = "Mesej ini tidak boleh diedit. Lampiran asal perlu dimuat naik semula.") }
            return false
        }
        val question = revisedQuestion.trim()
        if (question.isBlank()) return false
        val prefix = ChatBranching.prefix(snapshot.messages, userId, includeSelected = false) ?: return false
        openBranch(prefix)
        return send(question)
    }

    /** Regeneration creates an independent answer to the original user question. */
    fun regenerateFrom(answerId: String): Boolean {
        val question = ChatBranching.questionForRegeneration(state.value.messages, answerId)
        if(question==null) {
            mutable.update { it.copy(error = "Jawapan ini tidak boleh dijana semula tanpa lampiran asal. Muat naik lampiran sekali lagi.") }
            return false
        }
        return forkAndSendFrom(question.id, question.text)
    }

    fun forkFrom(messageId: String): Boolean {
        val snapshot = state.value
        if (!snapshot.loaded || snapshot.busy || !storageReadable) return false
        val copy = ChatBranching.prefix(snapshot.messages, messageId, includeSelected = true)
            ?: return false
        if (copy.isEmpty()) return false
        openBranch(copy)
        viewModelScope.launch {
            try {
                persistArchive()
                persistContext()
            } catch (_: Exception) {
                mutable.update { it.copy(error = "Cabang baharu belum berjaya disimpan; teks masih ada di skrin.") }
            }
        }
        return true
    }

    private fun openBranch(copied: List<Message>) {
        activeAttachment = null
        savedContext = savedContext.copy(sessionFirstId = "", summary = "",
            summarizedThrough = 0, thoughtLedger = emptyList())
        mutable.update {
            clearAnswerDiagnostics(it.copy(messages = copied,
                sessionStarts = (it.sessionStarts + listOfNotNull(copied.firstOrNull()?.id)).distinct(),
                resumedFromHistory = false, nextJourney = null,
                summaryStatus = "not_requested", error = null))
        }
    }

    /** The user explicitly exports plain JSON; never include encrypted memory or tokens. */
    fun exportSessions(): String {
        check(state.value.loaded && !state.value.busy && storageReadable) { "Arkib belum tersedia." }
        return SessionTransferCodec.encode(
            mergeSessionArchive(state.value.archive,state.value.messages),state.value.sessionStarts)
    }

    /** Validate before modifying any encrypted file; preserve original archive on failure. */
    suspend fun importSessions(content: String): Int = withContext(Dispatchers.Main.immediate) {
        check(state.value.loaded && !state.value.busy && storageReadable) { "Arkib belum tersedia." }
        val incoming=withContext(Dispatchers.Default) { SessionTransferCodec.decode(content) }
        archiveMutex.withLock {
            val current=state.value
            check(!current.busy && storageReadable) { "Tunggu sehingga respons tamat." }
            val combined=mergeSessionArchive(current.archive,current.messages)+incoming.messages
            val starts=(current.sessionStarts+incoming.sessionStarts).distinct()
            store.save(combined,starts)
            mutable.update { it.copy(archive=combined,sessionStarts=starts,error=null) }
        }
        incoming.sessionStarts.size
    }


    suspend fun saveOfflineDraft(text:String):Boolean = withContext(Dispatchers.Main.immediate) {
        if(!pendingReadable || !state.value.loaded || state.value.busy)return@withContext false
        try {
            pendingMutex.withLock {
                val next=OfflineDraftPolicy.add(state.value.pendingDrafts,text)
                pendingStore.save(next)
                mutable.update{it.copy(pendingDrafts=next,error=null)}
            }
            true
        } catch(e:Exception) {
            mutable.update{it.copy(error="Draf gagal disulitkan: "+(e.message?:"cuba lagi").take(110))}
            false
        }
    }

    suspend fun removeOfflineDraft(id:String):Boolean = withContext(Dispatchers.Main.immediate) {
        if(!pendingReadable || state.value.busy)return@withContext false
        try {
            pendingMutex.withLock {
                val next=OfflineDraftPolicy.remove(state.value.pendingDrafts,id)
                pendingStore.save(next)
                mutable.update{it.copy(pendingDrafts=next)}
            }
            true
        } catch(e:Exception) {
            mutable.update{it.copy(error="Draf gagal dipadam: "+(e.message?:"cuba lagi").take(110))}
            false
        }
    }

    /** User-confirmed deletion on this device, not a guarantee of remote erasure. */
    suspend fun eraseLocalData():Boolean = withContext(Dispatchers.Main.immediate) {
        if(!state.value.loaded || state.value.busy || !storageReadable ||
            !contextReadable || !pendingReadable)return@withContext false
        try {
            archiveMutex.withLock {
                contextMutex.withLock {
                    pendingMutex.withLock {
                        store.save(emptyList(),emptyList())
                        contextStore.save(SavedConversationContext())
                        pendingStore.save(emptyList())
                        savedContext=SavedConversationContext()
                        activeAttachment=null
                        mutable.update { current ->
                            clearAnswerDiagnostics(current.copy(messages=emptyList(),archive=emptyList(),
                                sessionStarts=emptyList(),memoryEnabled=false,memoryNotes="",
                                pendingDrafts=emptyList(),resumedFromHistory=false,
                                summaryStatus="not_requested",nextJourney=null,error=null))
                        }
                    }
                }
            }
            true
        } catch(e:Exception) {
            mutable.update { it.copy(error="Padam data tidak lengkap: "+(e.message?:"periksa storan").take(120)+
                ". Semak arkib dan cuba lagi.") }
            false
        }
    }

    fun stop() { requestJob?.cancel() }
}
