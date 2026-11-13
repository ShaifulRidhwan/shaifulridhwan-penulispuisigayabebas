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

data class Message(
    val id: String, val role: String, val text: String,
    val at: Long = System.currentTimeMillis(), val incomplete: Boolean = false,
    val provider: String? = null,
    // Optional per-answer backend facts. Defaults preserve older encrypted archives.
    val model: String? = null, val researchStatus: String? = null,
    val toolsUsed: List<String> = emptyList(), val evidenceLevel: String? = null,
    val reviewApplied: Boolean? = null
)
data class SessionSnapshot(val messages: List<Message>, val sessionStarts: List<String> = emptyList())

/** Conversation v1 stays an encrypted JSON array for downgrade compatibility.
 * Session boundaries live in a second encrypted AtomicFile, never plaintext preferences. */
class SessionStore(context: Context) {
    private val file = AtomicFile(File(context.noBackupFilesDir, "conversation.enc"))
    private val index = AtomicFile(File(context.noBackupFilesDir, "session-index-v1.enc"))
    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        return (store.getKey("aksara.sessions.v1", null) as? SecretKey) ?: KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder("aksara.sessions.v1", KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }
    private fun readEncrypted(target: AtomicFile): String {
        val bytes = target.readFully()
        require(bytes.size > 29 && bytes[0].toInt() == 1) { "Format sesi tidak dikenali." }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes.copyOfRange(1, 13)))
        return String(cipher.doFinal(bytes.copyOfRange(13, bytes.size)), Charsets.UTF_8)
    }
    private fun writeEncrypted(target: AtomicFile, plaintext: String) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
        val encrypted = byteArrayOf(1) + cipher.iv + cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))
        val stream = target.startWrite()
        try { stream.write(encrypted); target.finishWrite(stream) }
        catch (e: Exception) { target.failWrite(stream); throw e }
    }
    suspend fun load(): List<Message> = loadSnapshot().messages
    suspend fun loadSnapshot(): SessionSnapshot = withContext(Dispatchers.IO) {
        if (!file.baseFile.exists()) return@withContext SessionSnapshot(emptyList())
        val payload = readEncrypted(file)
        // A previous experimental snapshot may have written an object; retain compatibility.
        val rows = if (payload.trimStart().startsWith("[")) JSONArray(payload)
            else JSONObject(payload).getJSONArray("messages")
        val embedded = if (payload.trimStart().startsWith("[")) emptyList()
            else JSONObject(payload).optJSONArray("sessionStarts")?.let { saved ->
                (0 until saved.length()).map { saved.optString(it) }
            } ?: emptyList()
        val messages = (0 until rows.length()).map { rows.getJSONObject(it) }.map {
            Message(it.getString("id"), it.getString("role"), it.getString("text"), it.getLong("at"),
                it.optBoolean("incomplete"), it.optString("provider").takeIf { id ->
                    !it.isNull("provider") && id.isNotBlank() && id != "null"
                },
                it.optString("model").takeIf { v -> v.isNotBlank() && v != "null" },
                it.optString("researchStatus").takeIf { v -> v.isNotBlank() && v != "null" },
                it.optJSONArray("toolsUsed")?.let { tools ->
                    (0 until minOf(tools.length(),12)).mapNotNull { index ->
                        tools.optString(index).takeIf { entry -> entry.isNotBlank() }
                    }
                } ?: emptyList(),
                it.optString("evidenceLevel").takeIf { v -> v.isNotBlank() && v != "null" },
                it.opt("reviewApplied") as? Boolean)
        }
        val fromIndex = runCatching {
            if (!index.baseFile.exists()) emptyList()
            else JSONArray(readEncrypted(index)).let { arr ->
                (0 until arr.length()).map { arr.optString(it) }
            }
        }.getOrDefault(emptyList())
        val validIds = messages.mapTo(HashSet()) { it.id }
        SessionSnapshot(messages, (embedded + fromIndex).distinct().filter { it in validIds })
    }
    suspend fun save(messages: List<Message>, starts: List<String>? = null) = withContext(Dispatchers.IO) {
        val data = JSONArray().apply {
            messages.forEach { put(JSONObject().put("id", it.id).put("role", it.role)
                .put("text", it.text).put("at", it.at).put("incomplete", it.incomplete)
                .put("provider", it.provider ?: JSONObject.NULL)
                .put("model", it.model ?: JSONObject.NULL)
                .put("researchStatus", it.researchStatus ?: JSONObject.NULL)
                .put("toolsUsed", JSONArray(it.toolsUsed.take(12)))
                .put("evidenceLevel", it.evidenceLevel ?: JSONObject.NULL)
                .put("reviewApplied", it.reviewApplied ?: JSONObject.NULL)) }
        }
        // Write the original v1 shape so an older APK can still open this archive.
        writeEncrypted(file, data.toString())
        if (starts != null) {
            val allowed = messages.mapTo(HashSet()) { it.id }
            writeEncrypted(index, JSONArray().apply { starts.distinct().filter { it in allowed }.forEach { put(it) } }.toString())
        }
    }
}
