package my.aksara.nativeapp.feature.chat

import android.content.Intent

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import my.aksara.nativeapp.core.design.*

/** Search, conversations and optional memory in one discoverable native glass panel. */
@Composable
internal fun AksaraSearchHub(
    state: ChatState,
    onClose: () -> Unit,
    onSettings: () -> Unit,
    onRestore: () -> Unit,
    onRestoreSession: (String) -> Unit,
    onClear: () -> Unit,
    onJumpToMessage: (String) -> Unit,
    onExportSessions: () -> Unit,
    onImportSessions: () -> Unit
) {
    val context = LocalContext.current
    var tab by rememberSaveable { mutableIntStateOf(0) }
    var query by rememberSaveable { mutableStateOf("") }
    val sessions = remember(state.archive, state.sessionStarts, state.messages) {
        val stored = groupSessions(state.archive, state.sessionStarts)
        val current = state.messages
        if (current.isNotEmpty() && stored.none { session ->
            session.messages.any { it.id == current.first().id }
        }) stored + ArchivedConversation(current.first().id, current)
        else stored
    }.asReversed()
    val terms = query.trim()
    val messageResults = remember(sessions, terms) {
        if (terms.isBlank()) emptyList()
        else sessions.flatMap { session ->
            session.messages.filter { it.text.contains(terms, ignoreCase = true) }
                .map { message -> session to message }
        }.take(100)
    }
    // Compact for empty states, expands only as results require more room.
    val panelHeight = when (tab) {
        0 -> if (terms.isBlank()) 280.dp else
            (335 + messageResults.size.coerceAtMost(6) * 65).dp
        1 -> (405 + sessions.size.coerceAtMost(5) * 47).dp
        else -> if (state.memoryEnabled && state.memoryNotes.isNotBlank()) 400.dp else 270.dp
    }
    AksaraGlassModal(onClose = onClose, preferredHeight = panelHeight) {
        Column(Modifier.fillMaxSize().padding(16.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    AksaraIcon("search", Modifier.size(23.dp))
                    Spacer(Modifier.width(9.dp))
                    Column(Modifier.weight(1f)) {
                        AksaraText("Carian & Sejarah", size = 16f, weight = 700,
                            family = AksaraTypography.heading)
                        AksaraText("Cari dalam perbualan setempat yang disulitkan",
                            size = 10f, color = AksaraColors.muted)
                    }
                    AksaraButton("×", onClose, Modifier.width(36.dp), height = 37.dp, size = 22f, radius = 10.dp)
                }
                Spacer(Modifier.height(14.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    listOf("Cari Mesej", "Sesi & Sejarah", "Memori").forEachIndexed { index, label ->
                        AksaraButton(label, { tab = index; query = "" }, Modifier.weight(1f),
                            height = 39.dp, size = if (index == 1) 9.4f else 10f,
                            contentColor = if (tab == index) AksaraColors.gold else AksaraColors.text)
                    }
                }
                Spacer(Modifier.height(12.dp))
                if (tab == 0 || tab == 1 || (tab == 2 && state.memoryEnabled)) {
                    AksaraGlassSurface(Modifier.fillMaxWidth().height(43.dp), radius = 13.dp) {
                        BasicTextField(query, { query = it.take(120) },
                            Modifier.fillMaxSize().padding(horizontal = 12.dp, vertical = 10.dp)
                                .semantics { contentDescription = "Cari kandungan ${listOf("mesej", "sesi", "memori")[tab]}" },
                            singleLine = true, textStyle = AksaraTypography.style(12f, 19f),
                            cursorBrush = SolidColor(AksaraColors.gold),
                            decorationBox = { inner ->
                                Box {
                                    if (query.isBlank()) AksaraText(
                                        when (tab) {
                                            0 -> "Cari mesej dalam semua sesi"
                                            1 -> "Cari sesi atau tajuk perbualan"
                                            else -> "Cari dalam nota memori"
                                        }, size = 11f, color = AksaraColors.muted
                                    )
                                    inner()
                                }
                            })
                    }
                    Spacer(Modifier.height(11.dp))
                }
                Column(Modifier.weight(1f).verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    when (tab) {
                        0 -> {
                            AksaraText(if (terms.isBlank()) "Masukkan kata carian untuk melihat mesej lama."
                                else "${messageResults.size} mesej ditemui (maksimum 100).",
                                size = 11f, color = AksaraColors.muted)
                            messageResults.forEach { (session, message) ->
                                AksaraGlassSurface(
                                    Modifier.fillMaxWidth().clickable(enabled = !state.busy) {
                                        if (state.messages.none { it.id == message.id })
                                            onRestoreSession(session.startId)
                                        onJumpToMessage(message.id)
                                        onClose()
                                    },
                                    radius = 14.dp
                                ) {
                                    Column(Modifier.fillMaxWidth().padding(11.dp)) {
                                        AksaraText(session.title, size = 10f, color = AksaraColors.gold)
                                        Spacer(Modifier.height(4.dp))
                                        AksaraText(
                                            (if (message.role == "user") "Kau: " else "Aksara: ") +
                                                matchingExcerpt(message.text, terms),
                                            size = 11.5f, line = 17f
                                        )
                                        Spacer(Modifier.height(3.dp))
                                        AksaraText("Tekan untuk buka mesej asal",
                                            size = 9.5f, color = AksaraColors.muted)
                                    }
                                }
                            }
                            if (terms.isNotBlank() && messageResults.isEmpty())
                                AksaraText("Tiada mesej yang sepadan.", size = 12f,
                                    color = AksaraColors.muted)
                        }
                        1 -> {
                            AksaraText("${sessions.size} sesi tersedia pada peranti.",
                                size = 11f, color = AksaraColors.muted)
                            val filtered = sessions.filter { session ->
                                terms.isBlank() || session.title.contains(terms, ignoreCase = true) ||
                                    session.messages.any { it.text.contains(terms, ignoreCase = true) }
                            }
                            filtered.forEach { session ->
                                AksaraGlassSurface(
                                    Modifier.fillMaxWidth().clickable(enabled = !state.busy) {
                                        onRestoreSession(session.startId)
                                        onClose()
                                    }, radius = 14.dp
                                ) {
                                    Column(Modifier.fillMaxWidth().padding(11.dp)) {
                                        AksaraText(session.title, size = 12f, weight = 600)
                                        Spacer(Modifier.height(4.dp))
                                        AksaraText("${session.messages.size} mesej",
                                            size = 10f, color = AksaraColors.muted)
                                    }
                                }
                            }
                            if (filtered.isEmpty()) AksaraText(
                                if (sessions.isEmpty()) "Belum ada sesi tersimpan."
                                else "Tiada sesi sepadan dengan carian.",
                                size = 11f, color = AksaraColors.muted)
                            Spacer(Modifier.height(8.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                AksaraButton("Eksport JSON", onExportSessions, Modifier.weight(1f),
                                    height = 37.dp, size = 10f,
                                    enabled = !state.busy && sessions.isNotEmpty())
                                AksaraButton("Import JSON", onImportSessions, Modifier.weight(1f),
                                    height = 37.dp, size = 10f, enabled = !state.busy)
                            }
                            AksaraButton("Kongsi perbualan aktif", {
                                val body = state.messages.joinToString("\n\n") {
                                    (if (it.role == "user") "Kau" else "Aksara") + ": " + it.text
                                }
                                val intent = Intent(Intent.ACTION_SEND).setType("text/plain")
                                    .putExtra(Intent.EXTRA_TEXT, body)
                                context.startActivity(Intent.createChooser(intent, "Kongsi perbualan Aksara"))
                            }, Modifier.fillMaxWidth(), height = 37.dp, size = 10.5f,
                                enabled = state.messages.isNotEmpty())
                            AksaraText("Fail JSON yang dieksport ialah teks biasa. Lindungi fail tersebut.",
                                size = 10f, color = AksaraColors.muted)
                            AksaraButton("Buka semua mesej", { onRestore(); onClose() },
                                Modifier.fillMaxWidth(), enabled = !state.busy)
                            AksaraButton("Sesi baharu", { onClear(); onClose() },
                                Modifier.fillMaxWidth(), enabled = !state.busy)
                        }
                        else -> {
                            AksaraText(
                                if (state.memoryEnabled) "Memori pilihan diaktifkan."
                                else "Memori pilihan dimatikan. Tiada nota dihantar kepada A.I.",
                                size = 12f, color = AksaraColors.muted
                            )
                            if (state.memoryEnabled) {
                                val notes = state.memoryNotes
                                if (notes.isBlank()) AksaraText("Belum ada nota memori.",
                                    size = 12f, color = AksaraColors.muted)
                                else if (terms.isBlank() || notes.contains(terms, ignoreCase = true)) {
                                    AksaraGlassSurface(Modifier.fillMaxWidth(), radius = 13.dp) {
                                        AksaraText(notes, Modifier.padding(12.dp),
                                            size = 12f, line = 19f)
                                    }
                                } else AksaraText("Tiada nota sepadan.",
                                    size = 11f, color = AksaraColors.muted)
                            }
                            Spacer(Modifier.height(8.dp))
                            AksaraButton("Urus Memori & Privasi dalam Tetapan",
                                onSettings, Modifier.fillMaxWidth(), size = 11f)
                        }
                    }
                }
            }
    }
}

private fun matchingExcerpt(source: String, term: String): String {
    val clean = source.replace(Regex("\\s+"), " ").trim()
    if (term.isEmpty()) return clean.take(180)
    val at = clean.indexOf(term, ignoreCase = true).coerceAtLeast(0)
    val from = (at - 65).coerceAtLeast(0)
    val to = (at + term.length + 95).coerceAtMost(clean.length)
    return (if (from > 0) "…" else "") + clean.substring(from, to) +
        (if (to < clean.length) "…" else "")
}
