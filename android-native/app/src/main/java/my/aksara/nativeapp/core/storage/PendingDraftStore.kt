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
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Encrypted, user-created offline drafts. NEVER auto-resend a chat or tool call. */
data class PendingDraft(val id:String,val text:String,val savedAt:Long)
object OfflineDraftPolicy {
    const val MAX_COUNT=20
    const val MAX_TEXT=2400
    fun add(existing:List<PendingDraft>,text:String,now:Long=System.currentTimeMillis()):List<PendingDraft> {
        val clean=text.trim()
        require(clean.isNotEmpty() && clean.length<=MAX_TEXT) { "Draf mesti 1–2400 aksara." }
        require(!clean.contains("[Lampiran: ")) { "Lampiran mesti dipilih semula sebelum dihantar." }
        return (existing.filterNot { it.text==clean }+PendingDraft(UUID.randomUUID().toString(),clean,now))
            .takeLast(MAX_COUNT)
    }
    fun remove(existing:List<PendingDraft>,id:String):List<PendingDraft> = existing.filterNot{it.id==id}
}
class PendingDraftStore(context:Context) {
    private val encrypted=AtomicFile(File(context.noBackupFilesDir,"offline-drafts-v1.enc"))
    private fun secret():SecretKey {
        val keys=KeyStore.getInstance("AndroidKeyStore").apply{load(null)}
        return (keys.getKey("aksara.offline.drafts.v1",null) as? SecretKey)
            ?:KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore").apply {
                init(KeyGenParameterSpec.Builder("aksara.offline.drafts.v1",
                    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
            }.generateKey()
    }
    suspend fun load():List<PendingDraft> = withContext(Dispatchers.IO) {
        if(!encrypted.baseFile.exists())return@withContext emptyList()
        val data=encrypted.readFully()
        require(data.size>29 && data[0].toInt()==1) { "Draf tersulit tidak boleh dibaca." }
        val cipher=Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE,secret(),GCMParameterSpec(128,data.copyOfRange(1,13)))
        val plaintext=cipher.doFinal(data.copyOfRange(13,data.size))
        require(plaintext.size<=70_000) { "Arkib draf melebihi had." }
        val rows=JSONArray(String(plaintext,Charsets.UTF_8))
        require(rows.length()<=OfflineDraftPolicy.MAX_COUNT) { "Terlalu banyak draf tersimpan." }
        (0 until rows.length()).map { i ->
            val obj=rows.getJSONObject(i)
            PendingDraft(obj.getString("id").take(100),
                obj.getString("text").take(OfflineDraftPolicy.MAX_TEXT),
                obj.optLong("savedAt"))
        }
    }
    suspend fun save(items:List<PendingDraft>) = withContext(Dispatchers.IO) {
        require(items.size<=OfflineDraftPolicy.MAX_COUNT)
        val payload=JSONArray().apply{items.forEach {
            require(it.text.length<=OfflineDraftPolicy.MAX_TEXT)
            put(JSONObject().put("id",it.id.take(100)).put("text",it.text)
                .put("savedAt",it.savedAt))
        }}.toString().toByteArray(Charsets.UTF_8)
        val cipher=Cipher.getInstance("AES/GCM/NoPadding").apply{init(Cipher.ENCRYPT_MODE,secret())}
        val data=byteArrayOf(1)+cipher.iv+cipher.doFinal(payload)
        val out=encrypted.startWrite()
        try{out.write(data);encrypted.finishWrite(out)}
        catch(e:Exception){encrypted.failWrite(out);throw e}
    }
}
