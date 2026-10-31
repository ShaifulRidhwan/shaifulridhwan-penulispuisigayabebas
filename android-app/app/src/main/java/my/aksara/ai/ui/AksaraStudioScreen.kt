package my.aksara.ai.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import my.aksara.ai.data.StudioAndroidApi
import my.aksara.ai.data.StudioContract
import my.aksara.ai.data.StudioEnhancement
import my.aksara.ai.data.StudioImageResult
import my.aksara.ai.data.StudioSettings
import java.io.IOException
import java.security.SecureRandom

private val StudioWhite = Color(0xFFF3F2FF)
private val StudioMuted = Color(0xFFDDD0B8)
private val StudioIce = Color(0xFFEAC17C)
private val StudioGlass = Color(0x6610141D)

@Composable
fun AksaraStudioScreen(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val client = remember { StudioAndroidApi() }
    var prompt by rememberSaveable { mutableStateOf("") }
    var preset by rememberSaveable { mutableStateOf("antara") }
    var model by rememberSaveable { mutableStateOf("schnell") }
    var ratio by rememberSaveable { mutableStateOf("1:1") }
    var quality by rememberSaveable { mutableStateOf("balanced") }
    var seedValue by rememberSaveable { mutableStateOf("") }
    var token by remember { mutableStateOf("") } // NEVER persist or log owner QA token.
    var busy by remember { mutableStateOf(false) }
    var action by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("") }
    var image by remember { mutableStateOf<StudioImageResult?>(null) }
    var proposed by remember { mutableStateOf<StudioEnhancement?>(null) }
    var work by remember { mutableStateOf<Job?>(null) }

    val savePng = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("image/png")
    ) { uri ->
        val current = image
        if (uri != null && current != null) {
            runCatching {
                context.contentResolver.openOutputStream(uri)?.use {
                    it.write(current.bytes)
                } ?: throw IOException("Tak dapat membuka fail output.")
            }.onSuccess { status = "Imej disimpan pada lokasi pilihan kau." }
                .onFailure { status = "Gagal menyimpan imej." }
        }
    }
    val saveJpeg = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("image/jpeg")
    ) { uri ->
        val current = image
        if (uri != null && current != null) {
            runCatching {
                context.contentResolver.openOutputStream(uri)?.use {
                    it.write(current.bytes)
                } ?: throw IOException("Tak dapat membuka fail output.")
            }.onSuccess { status = "Imej disimpan pada lokasi pilihan kau." }
                .onFailure { status = "Gagal menyimpan imej." }
        }
    }

    fun generate() {
        if (busy) return
        busy = true
        action = "generate"
        status = "Studio sedang menjana imej…"
        proposed = null
        work = scope.launch {
            try {
                val seed = if (model == "klein" && seedValue.isNotBlank()) {
                    seedValue.toIntOrNull()
                        ?: throw IllegalArgumentException("Seed bukan nombor sah.")
                } else null
                val settings = StudioSettings(
                    prompt = prompt, style = preset, model = model,
                    ratio = ratio, quality = quality, seed = seed
                ).validated()
                val response = client.generate(token.trim(), settings)
                image = response
                status = "Imej berjaya dijana · " + response.modelName +
                    " · " + response.width + " × " + response.height
            } catch (_: CancellationException) {
                status = "Permintaan dihentikan. Kuota mungkin sudah digunakan."
            } catch (error: Exception) {
                status = (error.message ?: "Penjanaan gagal.").take(240)
            } finally {
                busy = false
                work = null
                action = ""
            }
        }
    }

    fun enhance() {
        if (busy) return
        busy = true
        action = "enhance"
        status = "Aksara sedang memperkemas draf prompt…"
        work = scope.launch {
            try {
                proposed = client.enhance(token.trim(), prompt)
                status = "Cadangan disediakan. Semak sebelum mengguna."
            } catch (_: CancellationException) {
                status = "Perkemas dihentikan."
            } catch (error: Exception) {
                status = (error.message ?: "Tak dapat perkemas prompt.").take(240)
            } finally {
                busy = false
                work = null
                action = ""
            }
        }
    }

    LazyColumn(
        modifier = modifier.fillMaxSize().padding(horizontal = 14.dp),
        verticalArrangement = Arrangement.spacedBy(13.dp)
    ) {
        item {
            Column(modifier = Modifier.padding(top = 12.dp)) {
                Text("STUDIO ANTARA", color = StudioWhite,
                    fontSize = 22.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.2.sp)
                Text("CAHAYA MENCIPTA BENTUK · GELAP MEMBERI DIMENSI",
                    color = StudioMuted, fontSize = 10.sp, letterSpacing = 1.sp)
            }
        }
        item {
            StudioPanel {
                Text("PROMPT VISUAL", color = StudioIce,
                    fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                OutlinedTextField(
                    value = prompt,
                    onValueChange = { if (!busy) prompt = it.take(1200) },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 4, maxLines = 8,
                    label = { Text("Apa yang kau nak lihat?") },
                    supportingText = {
                        Text(prompt.length.toString() + " / 1200", color = StudioMuted)
                    }
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = {
                            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE)
                                as ClipboardManager
                            clipboard.setPrimaryClip(ClipData.newPlainText("AKSARA Studio", prompt))
                            status = "Prompt disalin."
                        },
                        enabled = prompt.isNotBlank()
                    ) { Text("Salin prompt") }
                    OutlinedButton(
                        onClick = { enhance() },
                        enabled = prompt.trim().length in 4..850 && !busy
                    ) { Text("Perkemas A.I.") }
                }
            }
        }
        if (proposed != null) {
            item {
                StudioPanel {
                    Text("CADANGAN A.I. · SEMAK DULU", color = StudioIce,
                        fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Text(proposed!!.prompt, color = StudioWhite, fontSize = 13.sp)
                    Text(proposed!!.note, color = StudioMuted, fontSize = 11.sp)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = {
                            prompt = proposed!!.prompt.take(1200)
                            proposed = null
                            status = "Cadangan digunakan. Kau masih boleh edit."
                        }) { Text("Guna cadangan") }
                        TextButton(onClick = { proposed = null }) { Text("Abaikan") }
                    }
                }
            }
        }
        item {
            StudioPanel {
                Text("GAYA VISUAL", color = StudioIce, fontWeight = FontWeight.Bold,
                    fontSize = 12.sp)
                StudioChoices(StudioContract.presets.toList(), preset, !busy) {
                    preset = it
                }
                Text("MODEL PENJANAAN", color = StudioIce, fontWeight = FontWeight.Bold,
                    fontSize = 12.sp)
                StudioChoices(StudioContract.models.toList(), model, !busy) {
                    model = it
                    if (model != "klein") {
                        ratio = "1:1"
                        seedValue = ""
                    }
                }
                Text("NISBAH IMEJ", color = StudioIce, fontSize = 12.sp)
                StudioChoices(
                    StudioContract.ratios.filter {
                        model == "klein" || it == "1:1"
                    }.map { it to it },
                    ratio, !busy
                ) { ratio = it }
                if (model != "ovh") {
                    Text("KUALITI", color = StudioIce, fontSize = 12.sp)
                    StudioChoices(
                        StudioContract.qualities.map {
                            it to when(it) {
                                "fast" -> "Pantas"
                                "balanced" -> "Seimbang"
                                else -> "Terperinci"
                            }
                        },
                        quality, !busy
                    ) { quality = it }
                }
                if (model == "klein") {
                    OutlinedTextField(
                        value = seedValue,
                        onValueChange = {
                            if (!busy && it.length <= 10 && it.all(Char::isDigit)) seedValue = it
                        },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Seed · kosong = rawak") },
                        singleLine = true
                    )
                    TextButton(
                        onClick = {
                            seedValue = SecureRandom().nextInt(Int.MAX_VALUE).toString()
                        },
                        enabled = !busy
                    ) { Text("Seed rawak", color = StudioIce) }
                }
            }
        }
        item {
            StudioPanel {
                Text("SAMBUNGAN STUDIO ANDROID · QA PEMILIK", color = StudioIce,
                    fontWeight = FontWeight.Bold, fontSize = 12.sp)
                Text(
                    "Penjanaan menggunakan endpoint mudah alih yang dilindungi. " +
                        "Masukkan token QA peribadi selepas backend dan kebenaran Netlify disediakan.",
                    color = StudioMuted, fontSize = 12.sp
                )
                OutlinedTextField(
                    value = token,
                    onValueChange = { token = it.take(128) },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Token QA sementara") },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                    enabled = !busy
                )
                Text(
                    "Token tidak disimpan dalam APK, sesi peranti, clipboard atau log. " +
                        "Jangan masukkan API key Gemini/Cloudflare di sini.",
                    color = StudioMuted, fontSize = 11.sp
                )
                Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    Button(
                        onClick = { generate() },
                        enabled = !busy && prompt.trim().length in 4..1200 &&
                            token.length in 32..128
                    ) { Text("Jana Imej") }
                    if (busy) OutlinedButton(
                        onClick = {
                            work?.cancel()
                            status = "Permintaan dihentikan. Kuota mungkin digunakan."
                        }
                    ) { Text("Henti") }
                }
                if (busy) Text(
                    if (action == "enhance") "Memperkemas prompt…" else "Menjana visual…",
                    color = StudioIce, fontSize = 12.sp
                )
                Text(status.ifBlank { "Menunggu arahan." },
                    color = StudioMuted, fontSize = 12.sp)
            }
        }
        if (image != null) {
            item {
                StudioPanel {
                    val current = image!!
                    Text("HASIL IMEJ", color = StudioIce, fontWeight = FontWeight.Bold,
                        fontSize = 12.sp)
                    Image(
                        bitmap = current.bitmap.asImageBitmap(),
                        contentDescription = "Imej hasil jana Studio Antara",
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.fillMaxWidth().height(325.dp)
                    )
                    Text(
                        current.modelName + " · " + current.width + " × " +
                            current.height + " · " + current.durationMs + " ms",
                        color = StudioMuted, fontSize = 12.sp
                    )
                    Text("Prompt sebenar: " + current.usedPrompt,
                        color = StudioMuted, fontSize = 11.sp)
                    Button(onClick = {
                        if (current.mime == "image/png") {
                            savePng.launch("aksara-studio.png")
                        } else {
                            saveJpeg.launch("aksara-studio.jpg")
                        }
                    }) { Text("Simpan imej") }
                    if (model == "klein" && current.seed != null) {
                        TextButton(onClick = {
                            seedValue = current.seed.toString()
                            status = "Seed hasil dimasukkan ke tetapan. Jana imej baru jika mahu variasi."
                        }) { Text("Guna seed hasil", color = StudioIce) }
                    }
                }
            }
        }
        item {
            Text(
                "Nota: Backend web sedia ada tidak dipintas. Studio QA ini " +
                    "tidak berfungsi sehingga token dan endpoint Android dideploy. " +
                    "Hasil imej hanya disimpan selepas kau memilih lokasi.",
                color = StudioMuted, fontSize = 11.sp
            )
        }
        item { Spacer(Modifier.height(28.dp)) }
    }
}

@Composable
private fun StudioPanel(content: @Composable () -> Unit) {
    AksaraGlassPanel(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        blurRadius = 12.dp,
        tint = Color(0x6410141D),
        border = Color(0x88EAC17C)
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) { content() }
    }
}

@Composable
private fun StudioChoices(
    values: List<Pair<String, String>>,
    selected: String,
    enabled: Boolean,
    choose: (String) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(7.dp)
    ) {
        values.forEach { (value, display) ->
            FilterChip(
                selected = value == selected,
                onClick = { choose(value) },
                enabled = enabled,
                label = { Text(display, fontSize = 11.sp) }
            )
        }
    }
}
