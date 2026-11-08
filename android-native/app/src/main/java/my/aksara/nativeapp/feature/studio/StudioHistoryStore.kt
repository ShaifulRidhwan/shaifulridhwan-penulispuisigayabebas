package my.aksara.nativeapp.feature.studio

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

/** App-private history; Android exported gallery images are intentionally independent. */
internal data class StudioRecord(
    val id: String,
    val createdAt: Long,
    val engine: String,
    val model: String,
    val prompt: String,
    val width: Int,
    val height: Int,
    val durationMs: Long,
    val seed: Long?,
    val ratio: String,
    val quality: String,
    val style: String = "none"
)

internal class StudioHistoryStore(context: Context) {
    private val root = File(context.filesDir, "studio-v2").apply { mkdirs() }
    private val mutex = Mutex()
    private val index = File(root, "history.json")
    private fun file(id: String) = File(root, "$id.png")
    private fun parse(): List<StudioRecord> {
        if (!index.exists()) return emptyList()
        val array = JSONArray(index.readText())
        return (0 until array.length()).map { i ->
            val obj = array.getJSONObject(i)
            StudioRecord(
                obj.getString("id"), obj.getLong("createdAt"), obj.getString("engine"),
                obj.getString("model"), obj.getString("prompt"), obj.getInt("width"),
                obj.getInt("height"), obj.getLong("durationMs"),
                if (obj.isNull("seed")) null else obj.getLong("seed"),
                obj.optString("ratio", "1:1"), obj.optString("quality", "balanced"),
                obj.optString("style", "none")
            )
        }
    }
    private fun persist(items: List<StudioRecord>) {
        val array = JSONArray()
        items.forEach { item ->
            array.put(JSONObject().put("id", item.id).put("createdAt", item.createdAt)
                .put("engine", item.engine).put("model", item.model).put("prompt", item.prompt)
                .put("width", item.width).put("height", item.height)
                .put("durationMs", item.durationMs).put("seed", item.seed ?: JSONObject.NULL)
                .put("ratio", item.ratio).put("quality", item.quality).put("style",item.style))
        }
        val temp = File(root, "history.json.tmp")
        temp.writeText(array.toString())
        check(temp.renameTo(index)) { "Tidak dapat menyimpan indeks sejarah." }
    }
    suspend fun list(): List<StudioRecord> = withContext(Dispatchers.IO) {
        mutex.withLock { parse().sortedByDescending { it.createdAt } }
    }
    suspend fun save(
        bitmap: Bitmap, engine: String, model: String, prompt: String, elapsed: Long,
        seed: Long?, ratio: String, quality: String, style: String = "none"
    ): StudioRecord = withContext(Dispatchers.IO) {
        mutex.withLock {
            val id = UUID.randomUUID().toString()
            val record = StudioRecord(id, System.currentTimeMillis(), engine, model, prompt,
                bitmap.width, bitmap.height, elapsed, seed, ratio, quality, style)
            val temp = File(root, "$id.tmp")
            try {
                FileOutputStream(temp).use { output ->
                    check(bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)) { "Pengekodan imej gagal." }
                    output.fd.sync()
                }
                check(temp.renameTo(file(id))) { "Gagal memasang imej sejarah." }
                persist(listOf(record) + parse())
                record
            } catch (e: Exception) {
                temp.delete()
                file(id).delete()
                throw e
            }
        }
    }
    suspend fun bitmap(record: StudioRecord): Bitmap? = withContext(Dispatchers.IO) {
        if (!record.id.matches(Regex("[a-f0-9-]{36}"))) null else BitmapFactory.decodeFile(file(record.id).path)
    }
    /** Decode persistent originals at thumbnail scale to avoid loading many full images into gallery RAM. */
    suspend fun thumbnail(record: StudioRecord, maxEdge: Int = 320): Bitmap? = withContext(Dispatchers.IO) {
        if (!record.id.matches(Regex("[a-f0-9-]{36}"))) return@withContext null
        val path=file(record.id).path
        val bounds=BitmapFactory.Options().apply { inJustDecodeBounds=true }
        BitmapFactory.decodeFile(path,bounds)
        if (bounds.outWidth<=0 || bounds.outHeight<=0) return@withContext null
        var sample=1
        while (bounds.outWidth/sample>maxEdge*2 || bounds.outHeight/sample>maxEdge*2) sample*=2
        val opts=BitmapFactory.Options().apply {
            inSampleSize=sample
            inPreferredConfig=Bitmap.Config.RGB_565
        }
        BitmapFactory.decodeFile(path,opts)
    }
    suspend fun delete(id: String) = withContext(Dispatchers.IO) {
        mutex.withLock {
            if (!id.matches(Regex("[a-f0-9-]{36}"))) return@withLock
            persist(parse().filterNot { it.id == id })
            file(id).delete()
        }
    }
    suspend fun clear() = withContext(Dispatchers.IO) {
        mutex.withLock {
            val entries = parse()
            persist(emptyList())
            entries.forEach { file(it.id).delete() }
        }
    }
}