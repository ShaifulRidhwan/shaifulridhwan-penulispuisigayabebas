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
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

data class ChatState(val messages: List<Message> = emptyList(), val archive: List<Message> = emptyList(), val busy: Boolean = false,
    val error: String? = null, val providers: List<Pair<String, String>> = emptyList(), val mode: String = "cahaya", val loaded: Boolean = false)
class ChatViewModel(app: Application) : AndroidViewModel(app) {
    private val api = ChatApi(BuildConfig.API_ORIGIN)
    private val store = SessionStore(app)
    private val mutable = MutableStateFlow(ChatState())
    val state = mutable.asStateFlow()
    private var requestJob: Job? = null
    init {
        viewModelScope.launch {
            try { mutable.update { it.copy(archive = store.load(), loaded = true) } }
            catch (_: Exception) { mutable.update { it.copy(error = "Sesi tersimpan belum dapat dibaca. Fail asal dikekalkan.", loaded = true) } }
        }
        refreshProviders()
    }
    fun setMode(mode: String) { mutable.update { it.copy(mode = mode) } }
    fun dismissError() { mutable.update { it.copy(error = null) } }
    fun restore() { if (!state.value.busy) mutable.update { it.copy(messages = it.archive) } }
    fun clearScreen() { if (!state.value.busy) mutable.update { it.copy(messages = emptyList()) } }
    fun refreshProviders() = viewModelScope.launch {
        try {
            val rows = api.post("/.netlify/functions/bilik-antara", JSONObject().put("providerStatus", true)).optJSONArray("providers") ?: JSONArray()
            mutable.update { it.copy(providers = (0 until rows.length()).map { i -> rows.getJSONObject(i).let { p -> p.optString("id") to p.optString("status", "unknown") } }) }
        } catch (e: Exception) { if (e !is CancellationException) mutable.update { it.copy(providers = listOf("Connection" to "unavailable")) } }
    }
    fun send(question: String, documentText: String = "", documentName: String = "") {
        if (question.isBlank() || state.value.busy || !state.value.loaded) return
        val previous = state.value.messages
        val user = Message(UUID.randomUUID().toString(), "user", question)
        val assistant = Message(UUID.randomUUID().toString(), "assistant", "", incomplete = true)
        mutable.update { it.copy(messages = previous + user + assistant, busy = true, error = null) }
        requestJob = viewModelScope.launch {
            try {
                val history = JSONArray().apply { previous.filter { !it.incomplete }.takeLast(24).forEach { put(JSONObject().put("role", it.role).put("content", it.text)) } }
                val payload = JSONObject().put("question", question).put("history", history).put("thoughtMode", state.value.mode)
                    .put("contextFallback", true).put("mediaFallback", false).put("summary", "").put("memoryNotes", "")
                    .put("documentText", documentText).put("documentName", documentName)
                api.chat(payload).collect { event ->
                    mutable.update { value -> value.copy(messages = value.messages.map { m -> if (m.id != assistant.id) m else when (event) {
                        is ChatEvent.Delta -> m.copy(text = m.text + event.text)
                        is ChatEvent.Done -> m.copy(text = event.reply, incomplete = false)
                    } }) }
                }
            } catch (e: CancellationException) { /* preserve partial text and mark interruption */ }
            catch (e: Exception) { mutable.update { it.copy(error = e.message ?: "Sambungan gagal. Cuba lagi.") } }
            finally {
                mutable.update { it.copy(busy = false) }
                withContext(NonCancellable) {
                    try { store.save(state.value.messages); mutable.update { it.copy(archive = it.messages) } }
                    catch (_: Exception) { mutable.update { it.copy(error = "Jawapan ada di skrin tetapi sesi belum berjaya disimpan.") } }
                }
            }
        }
    }
    fun stop() { requestJob?.cancel() }
}
