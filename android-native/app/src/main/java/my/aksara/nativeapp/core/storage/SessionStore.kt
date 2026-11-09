package my.aksara.nativeapp.core.storage

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

data class Message(val id: String, val role: String, val text: String, val at: Long = System.currentTimeMillis(), val incomplete: Boolean = false, val provider: String? = null)
data class SessionSnapshot(val messages: List<Message>, val sessionStarts: List<String> = emptyList())
class SessionStore(context: Context) {
    private val file = AtomicFile(File(context.noBackupFilesDir, "conversation.enc"))
    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        return (store.getKey("aksara.sessions.v1", null) as? SecretKey) ?: KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder("aksara.sessions.v1", KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }
    suspend fun load(): List<Message> = loadSnapshot().messages
    suspend fun loadSnapshot(): SessionSnapshot = withContext(Dispatchers.IO) {
        if (!file.baseFile.exists()) return@withContext SessionSnapshot(emptyList())
        val bytes = file.readFully()
        require(bytes.size > 29 && bytes[0].toInt() == 1) { "Format sesi tidak dikenali." }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes.copyOfRange(1, 13)))
        val plaintext = String(cipher.doFinal(bytes.copyOfRange(13, bytes.size)), Charsets.UTF_8)
        val rows: JSONArray
        val starts: List<String>
        if (plaintext.trimStart().startsWith("[")) {
            // Legacy encrypted archive: preserve every original message.
            rows = JSONArray(plaintext)
            starts = emptyList()
        } else {
            val payload = JSONObject(plaintext)
            rows = payload.getJSONArray("messages")
            val saved = payload.optJSONArray("sessionStarts") ?: JSONArray()
            starts = (0 until saved.length()).mapNotNull { saved.optString(it).takeIf(String::isNotBlank) }.distinct()
        }
        val messages = (0 until rows.length()).map { rows.getJSONObject(it) }.map {
            Message(it.getString("id"), it.getString("role"), it.getString("text"),
                it.getLong("at"), it.optBoolean("incomplete"),
                it.optString("provider").takeIf { id -> !it.isNull("provider") && id.isNotBlank() && id != "null" })
        }
        SessionSnapshot(messages, starts)
    }
    suspend fun save(messages: List<Message>, starts: List<String> = emptyList()) = withContext(Dispatchers.IO) {
        val rows = JSONArray().apply { messages.forEach { put(JSONObject().put("id", it.id).put("role", it.role).put("text", it.text).put("at", it.at).put("incomplete", it.incomplete).put("provider", it.provider ?: JSONObject.NULL)) } }
        val data = JSONObject().put("messages", rows).put("sessionStarts", JSONArray().apply { starts.distinct().forEach { put(it) } })
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
        val encrypted = byteArrayOf(1) + cipher.iv + cipher.doFinal(data.toString().toByteArray())
        val stream = file.startWrite()
        try { stream.write(encrypted); file.finishWrite(stream) } catch (e: Exception) { file.failWrite(stream); throw e }
    }
}
