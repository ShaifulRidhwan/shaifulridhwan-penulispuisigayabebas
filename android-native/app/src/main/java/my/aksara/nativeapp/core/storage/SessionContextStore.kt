package my.aksara.nativeapp.core.storage

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Separate encrypted session summary and opt-in memory. Old conversation.enc format is untouched. */
data class SavedConversationContext(
    val sessionFirstId:String="",
    val summary:String="",
    val summarizedThrough:Int=0,
    val memoryEnabled:Boolean=false,
    val memoryNotes:String=""
)
class SessionContextStore(context:Context) {
    private val file=AtomicFile(File(context.noBackupFilesDir,"context-v1.enc"))
    private fun key():SecretKey {
        val store=KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        return (store.getKey("aksara.context.v1",null) as? SecretKey)
            ?:KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore").apply {
                init(KeyGenParameterSpec.Builder("aksara.context.v1",
                    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
            }.generateKey()
    }
    suspend fun load():SavedConversationContext=withContext(Dispatchers.IO) {
        if(!file.baseFile.exists())return@withContext SavedConversationContext()
        val bytes=file.readFully()
        require(bytes.size>29&&bytes[0].toInt()==1){"Format konteks tersulit tidak dikenali."}
        val cipher=Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE,key(),GCMParameterSpec(128,bytes.copyOfRange(1,13)))
        val obj=JSONObject(String(cipher.doFinal(bytes.copyOfRange(13,bytes.size)),Charsets.UTF_8))
        SavedConversationContext(
            sessionFirstId=obj.optString("sessionFirstId").take(120),
            summary=obj.optString("summary").take(4000),
            summarizedThrough=obj.optInt("summarizedThrough",0).coerceIn(0,200),
            memoryEnabled=obj.optBoolean("memoryEnabled",false),
            memoryNotes=obj.optString("memoryNotes").take(8000)
        )
    }
    suspend fun save(data:SavedConversationContext)=withContext(Dispatchers.IO) {
        val obj=JSONObject().put("sessionFirstId",data.sessionFirstId.take(120))
            .put("summary",data.summary.take(4000))
            .put("summarizedThrough",data.summarizedThrough.coerceIn(0,200))
            .put("memoryEnabled",data.memoryEnabled)
            .put("memoryNotes",data.memoryNotes.take(8000))
        val cipher=Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE,key()) }
        val bytes=byteArrayOf(1)+cipher.iv+cipher.doFinal(obj.toString().toByteArray(Charsets.UTF_8))
        val stream=file.startWrite()
        try{stream.write(bytes);file.finishWrite(stream)}
        catch(e:Exception){file.failWrite(stream);throw e}
    }
}
