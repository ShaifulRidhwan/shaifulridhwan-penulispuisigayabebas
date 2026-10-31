package my.aksara.ai.ui

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import org.json.JSONObject

private data class Chapter(val title: String, val paragraphs: List<String>)
private fun readChapters(context: Context): List<Chapter> = runCatching {
    val raw = context.assets.open("antara_cahaya_dan_gelap.json")
        .bufferedReader().use { it.readText() }
    val chapters = JSONObject(raw).getJSONArray("chapters")
    List(chapters.length()) { i ->
        val entry = chapters.getJSONObject(i)
        val texts = entry.getJSONArray("paragraphs")
        Chapter(entry.getString("title"), List(texts.length()) { j -> texts.getString(j) })
    }
}.getOrDefault(emptyList())

private val recommended = listOf(
    Triple("The Metamorphosis", "Franz Kafka", "https://www.gutenberg.org/cache/epub/5200/pg5200-images.html"),
    Triple("Crime and Punishment", "Fyodor Dostoevsky", "https://www.gutenberg.org/cache/epub/2554/pg2554-images.html"),
    Triple("The Brothers Karamazov", "Fyodor Dostoevsky", "https://www.gutenberg.org/cache/epub/28054/pg28054-images.html"),
    Triple("Frankenstein", "Mary Shelley", "https://www.gutenberg.org/cache/epub/84/pg84-images.html")
)

@Composable
fun AksaraNovelScreen(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val content = remember { readChapters(context) }
    val prefs = remember { context.getSharedPreferences("aksara_reader_v1", Context.MODE_PRIVATE) }
    var reading by rememberSaveable { mutableStateOf(false) }
    var index by rememberSaveable {
        mutableIntStateOf(prefs.getInt("chapter", 0).coerceIn(0, maxOf(0, content.lastIndex)))
    }
    var font by rememberSaveable { mutableIntStateOf(prefs.getInt("font", 18).coerceIn(15, 26)) }
    var light by rememberSaveable { mutableStateOf(prefs.getBoolean("light", false)) }
    if (reading && content.isNotEmpty()) {
        val chapter = content[index]
        val paper = if (light) Color(0xFFF4EDE0) else Color(0xFF12151D)
        val ink = if (light) Color(0xFF2B2A29) else Color(0xFFEAE4D6)
        val gold = if (light) Color(0xFF806E53) else Color(0xFFC6AD7F)
        Column(modifier.fillMaxSize().background(paper)) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                TextButton(onClick = { reading = false }) { Text("‹ Katalog", color = gold) }
                Text((index + 1).toString() + "/" + content.size, color = gold, fontSize = 12.sp)
                Row {
                    TextButton(onClick = {
                        font = (font - 1).coerceAtLeast(15)
                        prefs.edit().putInt("font", font).apply()
                    }) { Text("A−", color = gold) }
                    TextButton(onClick = {
                        font = (font + 1).coerceAtMost(26)
                        prefs.edit().putInt("font", font).apply()
                    }) { Text("A+", color = gold) }
                    TextButton(onClick = {
                        light = !light
                        prefs.edit().putBoolean("light", light).apply()
                    }) { Text(if (light) "☾" else "☀", color = gold) }
                }
            }
            key(index) {
                val listState = rememberLazyListState(
                    initialFirstVisibleItemIndex = prefs.getInt("paragraph_" + index, 0)
                        .coerceIn(0, chapter.paragraphs.size + 1)
                )
                LaunchedEffect(listState, index) {
                    snapshotFlow { listState.firstVisibleItemIndex }
                        .distinctUntilChanged()
                        .debounce(650)
                        .collect { pos ->
                            prefs.edit().putInt("paragraph_" + index, pos)
                                .putInt("chapter", index).apply()
                        }
                }
                LazyColumn(
                    modifier = Modifier.weight(1f).fillMaxWidth().padding(horizontal = 22.dp),
                    state = listState,
                    verticalArrangement = Arrangement.spacedBy(20.dp)
                ) {
                    item {
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 25.dp),
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            Text("BAHAGIAN " + (index + 1), color = gold, letterSpacing = 3.sp,
                                fontSize = 12.sp)
                            Text(chapter.title, color = ink, fontFamily = FontFamily.Serif,
                                fontSize = (font + 8).sp, lineHeight = (font + 13).sp)
                        }
                    }
                    items(chapter.paragraphs) { paragraph ->
                        Text(paragraph, color = ink, fontFamily = FontFamily.Serif,
                            fontSize = font.sp, lineHeight = (font * 1.7f).sp)
                    }
                    item { Spacer(Modifier.height(30.dp)) }
                }
            }
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextButton(enabled = index > 0, onClick = {
                    index--
                    prefs.edit().putInt("chapter", index).apply()
                }) { Text("‹ Sebelum", color = gold) }
                Text("Kemajuan disimpan", color = gold, fontSize = 10.sp)
                TextButton(enabled = index < content.lastIndex, onClick = {
                    index++
                    prefs.edit().putInt("chapter", index).apply()
                }) { Text("Seterusnya ›", color = gold) }
            }
        }
    } else {
        LazyColumn(
            modifier = modifier.fillMaxSize().padding(horizontal = 18.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            item {
                Column(modifier = Modifier.padding(vertical = 20.dp)) {
                    Text("PERPUSTAKAAN AKSARA", color = Color(0xFFE9E2CC),
                        fontWeight = FontWeight.Bold, letterSpacing = 1.sp, fontSize = 19.sp)
                    Text("Sastera dan falsafah dalam Android native.", color = Color(0xFFB7C0D6))
                }
            }
            item {
                Column(
                    modifier = Modifier.fillMaxWidth()
                        .background(Color(0xCC1C2235), RoundedCornerShape(20.dp))
                        .border(1.dp, Color(0x55B9A26B), RoundedCornerShape(20.dp))
                        .clickable(enabled = content.isNotEmpty()) { reading = true }
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("KARYA ASLI · OFFLINE", color = Color(0xFFD8B878), fontSize = 11.sp)
                    Text("ANTARA CAHAYA\nDAN GELAP", color = Color(0xFFF0E8D4),
                        fontFamily = FontFamily.Serif, fontSize = 24.sp)
                    Text("Shaiful Ridhwan · Prosa Falsafah",
                        color = Color(0xFFB9B4AC), fontSize = 13.sp)
                    Text(if (content.isNotEmpty()) "Baca / Sambung Bahagian " + (index + 1) + " ›"
                        else "Kandungan offline belum tersedia",
                        color = Color(0xFFE8C688), fontWeight = FontWeight.SemiBold)
                }
            }
            item {
                Text("RUJUKAN KARYA DUNIA", color = Color(0xFFBCC9EB), fontSize = 12.sp)
                Text("Judul ini dibuka pada sumber luar, bukan dalam WebView AKSARA.",
                    color = Color(0xFF909DB8), fontSize = 12.sp)
            }
            items(recommended) { entry ->
                Column(
                    modifier = Modifier.fillMaxWidth()
                        .background(Color(0x991B263D), RoundedCornerShape(14.dp))
                        .clickable {
                            runCatching {
                                context.startActivity(
                                    Intent(Intent.ACTION_VIEW, Uri.parse(entry.third))
                                )
                            }
                        }.padding(14.dp)
                ) {
                    Text(entry.first, color = Color.White, fontWeight = FontWeight.Medium)
                    Text(entry.second + " · Buka sumber ↗",
                        color = Color(0xFFB8C7EA), fontSize = 12.sp)
                }
            }
            item { Spacer(Modifier.height(25.dp)) }
        }
    }
}
