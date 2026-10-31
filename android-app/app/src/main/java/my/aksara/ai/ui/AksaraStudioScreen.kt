package my.aksara.ai.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val visualPresets = linkedMapOf(
    "Antara" to "cinematic chiaroscuro, warm golden light, deep blue shadows",
    "Sastera" to "contemporary literary editorial aesthetic, tactile detail",
    "Falsafah" to "philosophical visual mood, subtle symbolism, directional lighting",
    "Fotorealistik" to "photorealistic, natural textures, believable lighting",
    "Futuristik" to "futuristic visual design, blue and amber illumination",
    "Minimalis" to "minimal composition, generous negative space, clean forms"
)

@Composable
fun AksaraStudioScreen(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    var prompt by rememberSaveable { mutableStateOf("") }
    var preset by rememberSaveable { mutableStateOf("Antara") }
    var ratio by rememberSaveable { mutableStateOf("1:1") }
    var note by remember { mutableStateOf("") }
    val result = (prompt.trim() + if (prompt.isBlank()) "" else
        ", " + (visualPresets[preset] ?: "")).take(1350)

    LazyColumn(
        modifier = modifier.fillMaxSize().padding(horizontal = 18.dp),
        verticalArrangement = Arrangement.spacedBy(15.dp)
    ) {
        item {
            Column(modifier = Modifier.padding(top = 20.dp)) {
                Text("STUDIO ANTARA", color = Color(0xFFF0EDFF),
                    fontSize = 23.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
                Text("Ruang reka prompt native · Cahaya mencipta bentuk, gelap memberi dimensi.",
                    color = Color(0xFFB7C3DC), fontSize = 13.sp)
            }
        }
        item {
            OutlinedTextField(
                value = prompt,
                onValueChange = { if (it.length <= 1200) prompt = it },
                modifier = Modifier.fillMaxWidth(),
                minLines = 5,
                maxLines = 9,
                label = { Text("Apa yang kau nak lihat?") },
                shape = RoundedCornerShape(18.dp)
            )
        }
        item {
            Text("GAYA VISUAL", color = Color(0xFFC5CEF1), fontSize = 12.sp)
            Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                visualPresets.keys.chunked(3).forEach { group ->
                    Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                        group.forEach { name ->
                            FilterChip(selected = preset == name, onClick = { preset = name },
                                label = { Text(name, fontSize = 11.sp) })
                        }
                    }
                }
            }
        }
        item {
            Text("NISBAH CADANGAN", color = Color(0xFFC5CEF1), fontSize = 12.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("1:1", "4:5", "9:16").forEach { value ->
                    FilterChip(selected = ratio == value, onClick = { ratio = value },
                        label = { Text(value) })
                }
            }
        }
        item {
            Column(
                modifier = Modifier.fillMaxWidth()
                    .background(Color(0x99212B42), RoundedCornerShape(18.dp))
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text("PROMPT TERHASIL", color = Color(0xFFD8C6FF),
                    fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                Text(if (prompt.isBlank()) "Tulis idea untuk bina prompt…" else result,
                    color = Color(0xFFE6EBFF), fontSize = 13.sp)
                Text("Cadangan nisbah: " + ratio, color = Color(0xFFBAC5E1), fontSize = 11.sp)
                Button(
                    enabled = prompt.trim().length >= 4,
                    onClick = {
                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE)
                            as ClipboardManager
                        clipboard.setPrimaryClip(ClipData.newPlainText("AKSARA Studio", result))
                        note = "Prompt disalin. Tetapan nisbah: " + ratio
                    }
                ) { Text("Salin prompt") }
            }
        }
        item {
            Column(
                modifier = Modifier.fillMaxWidth()
                    .background(Color(0x99292636), RoundedCornerShape(15.dp))
                    .padding(14.dp)
            ) {
                Text("Jana Imej · belum aktif dalam APK",
                    color = Color(0xFFE5CDA3), fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(7.dp))
                Text(
                    "Backend Studio sekarang hanya menerima permintaan daripada laman web. " +
                    "Kami tidak akan memintas perlindungan Origin; fungsi jana imej native " +
                    "akan disambung selepas endpoint Android mempunyai kebenaran yang sah.",
                    color = Color(0xFFC7C0B9), fontSize = 12.sp
                )
            }
        }
        if (note.isNotEmpty()) item {
            Text(note, color = Color(0xFFBDE9CD), fontSize = 12.sp)
        }
        item { Spacer(Modifier.height(24.dp)) }
    }
}
