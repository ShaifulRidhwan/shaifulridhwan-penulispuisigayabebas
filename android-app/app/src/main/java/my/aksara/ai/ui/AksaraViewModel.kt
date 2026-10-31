package my.aksara.ai.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch
import my.aksara.ai.data.AksaraApi
import my.aksara.ai.data.ChatTurn

class AksaraViewModel : ViewModel() {
    private val api = AksaraApi()
    val messages = mutableStateListOf<ChatTurn>()
    var mode by mutableStateOf("cahaya")
        private set
    var busy by mutableStateOf(false)
        private set
    var backendStatus by mutableStateOf("Memeriksa backend…")
        private set
    var error by mutableStateOf<String?>(null)
        private set

    init {
        viewModelScope.launch {
            // Probe verifies configuration, not a completed AI answer.
            backendStatus = if (api.probe()) "Backend tersedia" else "Backend belum tersedia"
        }
    }

    fun selectMode(next: String) {
        if (next == "cahaya" || next == "gelap") mode = next
    }

    fun clear() {
        if (!busy) {
            messages.clear()
            error = null
        }
    }

    fun send(text: String) {
        val question = text.trim()
        if (question.isBlank() || question.length > 12_000 || busy) return
        val history = messages.toList()
        messages.add(ChatTurn(role = "user", content = question))
        busy = true
        error = null
        viewModelScope.launch {
            try {
                val result = api.chat(question, mode, history)
                messages.add(ChatTurn(role = "assistant", content = result.reply, provider = result.provider))
                backendStatus = "Aksara membalas"
            } catch (e: Exception) {
                error = e.message?.take(260) ?: "Sambungan terputus. Cuba lagi."
                // Keep the user's question visible; it is not silently lost.
            } finally {
                busy = false
            }
        }
    }
}
