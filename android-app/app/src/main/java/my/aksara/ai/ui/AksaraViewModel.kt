package my.aksara.ai.ui

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import my.aksara.ai.data.AksaraApi
import my.aksara.ai.data.ChatStore
import my.aksara.ai.data.ChatTurn

class AksaraViewModel(application: Application) : AndroidViewModel(application) {
    private val api = AksaraApi()
    private val store = ChatStore(application)
    private val saved = store.load()
    private var requestJob: Job? = null

    val messages = mutableStateListOf<ChatTurn>().apply { addAll(saved.messages) }

    var mode by mutableStateOf(saved.mode)
        private set
    var saveSession by mutableStateOf(saved.saveEnabled)
        private set
    var busy by mutableStateOf(false)
        private set
    var status by mutableStateOf("Semak backend")
        private set
    var statusReady by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var streamingTick by mutableStateOf(0)
        private set
    var lastProvider by mutableStateOf<String?>(null)
        private set

    init {
        viewModelScope.launch {
            val configured = api.probe()
            if (!busy) {
                statusReady = configured
                status = if (configured) "Backend tersedia · belum diuji" else "Backend tidak tersedia"
            }
        }
    }

    private fun persist() = store.persist(messages.toList(), mode, saveSession)

    fun selectMode(next: String) {
        if (next == "cahaya" || next == "gelap") {
            mode = next
            persist()
        }
    }

    fun updateSessionSaving(enabled: Boolean) {
        saveSession = enabled
        persist() // Immediately purges stored turns when disabled.
    }

    fun clear() {
        if (busy) return
        messages.clear()
        store.clear()
        error = null
        lastProvider = null
        persist()
    }

    fun stop() {
        if (!busy) return
        api.cancelStream()
        requestJob?.cancel()
        status = "Dihentikan"
    }

    fun send(text: String): Boolean {
        val question = text.trim()
        if (question.isBlank() || question.length > 12_000 || busy) return false
        val history = messages.toList()
        messages.add(ChatTurn(role = "user", content = question))
        persist()
        busy = true
        status = "Aksara sedang berfikir…"
        error = null
        var assistantIndex = -1
        requestJob = viewModelScope.launch {
            try {
                val result = api.chatStream(question, mode, history) { partial ->
                    withContext(Dispatchers.Main.immediate) {
                        if (assistantIndex == -1) {
                            assistantIndex = messages.size
                            messages.add(
                                ChatTurn(
                                    role = "assistant",
                                    content = partial,
                                    complete = false
                                )
                            )
                        } else if (assistantIndex in messages.indices) {
                            messages[assistantIndex] = messages[assistantIndex].copy(
                                content = partial, complete = false
                            )
                        }
                        status = "Aksara sedang menjawab…"
                        streamingTick++
                    }
                }
                val done = ChatTurn(
                    role = "assistant",
                    content = result.reply,
                    provider = result.provider,
                    complete = true
                )
                if (assistantIndex in messages.indices) messages[assistantIndex] = done
                else messages.add(done)
                lastProvider = result.provider
                statusReady = true
                status = "Sedia"
            } catch (e: CancellationException) {
                if (assistantIndex in messages.indices) {
                    messages[assistantIndex] = messages[assistantIndex].copy(complete = false)
                }
                error = "Jawapan dihentikan. Bahagian yang sudah diterima dikekalkan."
                status = "Dihentikan"
            } catch (e: Exception) {
                error = (e.message ?: "Sambungan terputus. Cuba lagi.").take(260)
                status = "Gangguan sambungan"
                statusReady = false
            } finally {
                busy = false
                requestJob = null
                persist()
            }
        }
        return true
    }
}
