package my.aksara.ai.data

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

private const val STUDIO_ENDPOINT =
    "https://shaifulridhwan-penulispuisigayabebas.netlify.app/.netlify/functions/"
private const val MAX_IMAGE_BYTES = 3_500_000

data class StudioSettings(
    val prompt: String,
    val style: String = "antara",
    val model: String = "schnell",
    val ratio: String = "1:1",
    val quality: String = "balanced",
    val seed: Int? = null
) {
    fun validated(): StudioSettings {
        require(prompt.trim().length in 4..1200) { "Prompt mesti 4 hingga 1200 aksara." }
        require(style in StudioContract.presets.keys) { "Preset tidak sah." }
        require(model in StudioContract.models.keys) { "Model tidak disokong." }
        require(ratio in StudioContract.ratios) { "Nisbah tidak disokong." }
        require(quality in StudioContract.qualities) { "Kualiti tidak disokong." }
        require(model == "klein" || (ratio == "1:1" && seed == null)) {
            "Nisbah bukan 1:1 dan seed hanya untuk FLUX.2 Klein."
        }
        return this
    }

    fun json(): JSONObject = JSONObject()
        .put("prompt", prompt.trim())
        .put("style", style)
        .put("model", model)
        .put("ratio", ratio)
        .put("quality", quality)
        .put("seed", seed ?: JSONObject.NULL)
}

data class StudioImageResult(
    val bytes: ByteArray,
    val bitmap: Bitmap,
    val mime: String,
    val width: Int,
    val height: Int,
    val modelName: String,
    val usedPrompt: String,
    val durationMs: Long,
    val seed: Int?
)

data class StudioEnhancement(
    val prompt: String,
    val method: String,
    val note: String
)

/** Native app never stores secrets or bypasses website-only Origin protection. */
object StudioContract {
    val presets = linkedMapOf(
        "none" to "Ikut prompt sahaja",
        "antara" to "Antara Cahaya dan Gelap",
        "sastera" to "Sastera Moden",
        "langit" to "Langit dan Renungan",
        "falsafah" to "Falsafah Gelap",
        "cinta" to "Cinta Sinematik",
        "futuristik" to "Futuristik",
        "realistic" to "Fotorealistik",
        "illustration" to "Ilustrasi Artistik",
        "minimal" to "Minimalis",
        "fantasy" to "Fantasi"
    )
    val models = linkedMapOf(
        "schnell" to "FLUX.1 Schnell",
        "klein" to "FLUX.2 Klein 4B",
        "ovh" to "OVHcloud SDXL · Beta"
    )
    val ratios = listOf("1:1", "4:5", "9:16", "16:9", "3:2")
    val qualities = listOf("fast", "balanced", "detail")
}

class StudioAndroidApi {
    suspend fun enhance(token: String, prompt: String): StudioEnhancement {
        require(prompt.trim().length in 4..850) {
            "Prompt perkemas mestilah 4 hingga 850 aksara."
        }
        val response = post(
            token,
            "studio-enhance-android",
            JSONObject().put("prompt", prompt.trim())
        )
        val suggested = response.optString("prompt")
        if (suggested.isBlank() || suggested.length > 1200) {
            throw IOException("Cadangan AI tidak sah. Prompt asal tidak diubah.")
        }
        return StudioEnhancement(
            prompt = suggested,
            method = response.optString("method", "unknown"),
            note = response.optString("note", "Semak cadangan sebelum menjana.")
        )
    }

    suspend fun generate(token: String, settings: StudioSettings): StudioImageResult {
        val json = post(token, "studio-android", settings.validated().json())
        val mime = json.optString("mime")
        if (mime != "image/png" && mime != "image/jpeg") {
            throw IOException("Studio memulangkan format imej tidak disokong.")
        }
        val encoded = json.optString("image")
        if (encoded.isEmpty() || encoded.length > 4_700_000 ||
            !encoded.matches(Regex("""^[A-Za-z0-9+/]+={0,2}$"""))) {
            throw IOException("Data imej daripada Studio tidak sah.")
        }
        val raw = try { Base64.decode(encoded, Base64.DEFAULT) }
        catch (_: IllegalArgumentException) {
            throw IOException("Data imej rosak.")
        }
        if (raw.size !in 100..MAX_IMAGE_BYTES) {
            throw IOException("Saiz imej melebihi had aplikasi.")
        }
        val bitmap = BitmapFactory.decodeByteArray(raw, 0, raw.size)
            ?: throw IOException("Imej tidak dapat dibaca oleh Android.")
        val w = json.optInt("width", 0)
        val h = json.optInt("height", 0)
        if (w !in 256..1920 || h !in 256..1920 ||
            w != bitmap.width || h != bitmap.height) {
            bitmap.recycle()
            throw IOException("Dimensi imej tidak sepadan dengan hasil Studio.")
        }
        val applied = json.optJSONObject("settings")
        return StudioImageResult(
            bytes = raw,
            bitmap = bitmap,
            mime = mime,
            width = w,
            height = h,
            modelName = json.optString("modelName", "Studio"),
            usedPrompt = json.optString("promptUsed"),
            durationMs = json.optLong("durationMs").coerceAtLeast(0),
            seed = applied?.optInt("seed", -1)?.takeIf { it >= 0 }
        )
    }

    private suspend fun post(
        token: String, route: String, body: JSONObject
    ): JSONObject = withContext(Dispatchers.IO) {
        if (!token.matches(Regex("""^[A-Za-z0-9_-]{32,128}$"""))) {
            throw IOException("Masukkan token QA Studio yang sah (32 hingga 128 aksara).")
        }
        val url = URL(STUDIO_ENDPOINT + route)
        val conn = url.openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "POST"
            conn.connectTimeout = 15_000
            conn.readTimeout = 60_000
            conn.doOutput = true
            conn.instanceFollowRedirects = false
            conn.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            conn.setRequestProperty("Accept", "application/json")
            conn.setRequestProperty("Authorization", "Bearer " + token)
            val request = body.toString().toByteArray(Charsets.UTF_8)
            if (request.size > 7000) {
                throw IOException("Permintaan Studio terlalu besar.")
            }
            conn.outputStream.use { it.write(request) }
            val status = conn.responseCode
            // Existing backend image output is ~4.7 MB base64; do not read unbounded.
            val lengthLimit = if (route == "studio-android") 5_100_000 else 5_000
            val stream = if (status in 200..299) conn.inputStream else conn.errorStream
            val raw = stream?.use { input ->
                val output = java.io.ByteArrayOutputStream()
                val buffer = ByteArray(8192)
                while (true) {
                    val read = input.read(buffer)
                    if (read < 0) break
                    if (output.size() + read > lengthLimit) {
                        throw IOException("Hasil Studio terlalu besar.")
                    }
                    output.write(buffer, 0, read)
                }
                output.toString("UTF-8")
            } ?: "{}"
            val parsed = try { JSONObject(raw) }
                catch (_: Exception) {
                    if (status == 404) throw IOException(
                        "Studio Android belum di-deploy ke Netlify."
                    )
                    throw IOException("Respons Studio tidak sah (HTTP " + status + ").")
                }
            if (status !in 200..299) {
                val reason = parsed.optString("error").takeIf { it.isNotBlank() }
                    ?: "Studio belum tersedia (HTTP " + status + ")."
                throw IOException(reason.take(270))
            }
            if (!parsed.optBoolean("ok", false)) {
                throw IOException("Studio tidak berjaya menyiapkan permintaan.")
            }
            parsed
        } finally {
            conn.disconnect()
        }
    }
}
