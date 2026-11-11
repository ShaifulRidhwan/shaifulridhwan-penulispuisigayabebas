package my.aksara.nativeapp.feature.chat

import android.content.Intent
import android.widget.Toast
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.*
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import my.aksara.nativeapp.core.design.*

/**
 * PR #314. A single universal search, recent conversations, and a dedicated
 * management view share the existing Liquid Glass dialog and safe IME insets.
 * Memory is status-only here: its OFF-by-default privacy policy lives in Settings.
 */
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
    onExportSession: (String?) -> Unit,
    onImportSessions: () -> Unit,
    onDeleteSession: suspend (String) -> Boolean
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var query by rememberSaveable { mutableStateOf("") }
    var management by rememberSaveable { mutableStateOf(false) }
    var selectedSessionId by rememberSaveable { mutableStateOf<String?>(null) }
    var choosingSession by rememberSaveable { mutableStateOf(false) }
    var confirmDelete by rememberSaveable { mutableStateOf(false) }
    var deleting by remember { mutableStateOf(false) }
    val sessions = remember(state.archive, state.sessionStarts, state.messages) {
        val stored = groupSessions(state.archive, state.sessionStarts)
        val current = state.messages
        if (current.isNotEmpty() && stored.none { saved ->
                saved.messages.any { it.id == current.first().id }
            }) stored + ArchivedConversation(current.first().id, current)
        else stored
    }.asReversed()
    val terms = query.trim()
    val matches = remember(sessions, terms) { findUnifiedHistory(sessions, terms) }
    val selected = sessions.firstOrNull { it.startId == selectedSessionId }
    val canManage = state.loaded && !state.busy && !deleting

    AksaraGlassModal(onClose = onClose, preferredHeight = 720.dp) {
        Column(Modifier.fillMaxSize().padding(16.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                AksaraIcon(if (management) "settings" else "search", Modifier.size(22.dp))
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    AksaraText(
                        if (management) "Urus Sesi & Memori" else "Carian & Sejarah",
                        size = 16f, weight = 700, family = AksaraTypography.heading
                    )
                    AksaraText(
                        if (management) "Pilihan selamat untuk sejarah perbualan."
                        else "Cari, sambung dan urus perbualan.",
                        size = 10.5f, color = AksaraColors.muted
                    )
                }
                AksaraButton(
                    if (management) "‹" else "×",
                    onClick = {
                        if (management) {
                            management = false
                            choosingSession = false
                            confirmDelete = false
                        } else onClose()
                    }, modifier = Modifier.width(44.dp).semantics {
                        contentDescription = if (management) "Kembali ke carian" else "Tutup carian"
                    }, height = 44.dp, size = 21f, radius = 13.dp
                )
            }
            Spacer(Modifier.height(13.dp))

            if (!management) {
                AksaraGlassSurface(Modifier.fillMaxWidth().height(52.dp), radius = 14.dp) {
                    Row(
                        Modifier.fillMaxSize().padding(horizontal = 12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        AksaraIcon("search", Modifier.size(18.dp))
                        Spacer(Modifier.width(10.dp))
                        BasicTextField(
                            value = query,
                            onValueChange = { query = it.take(160) },
                            modifier = Modifier.weight(1f).semantics {
                                contentDescription = "Cari mesej, tajuk atau sesi"
                            },
                            singleLine = true,
                            textStyle = AksaraTypography.style(12f, 19f),
                            cursorBrush = SolidColor(AksaraColors.gold),
                            decorationBox = { inner ->
                                Box {
                                    if (query.isBlank()) AksaraText(
                                        "Cari mesej, tajuk atau sesi...",
                                        size = 11.5f, color = AksaraColors.muted
                                    )
                                    inner()
                                }
                            }
                        )
                        if (query.isNotEmpty()) AksaraButton(
                            "×", { query = "" }, Modifier.width(30.dp).semantics {
                                contentDescription = "Kosongkan carian"
                            }, height = 30.dp, size = 15f
                        )
                    }
                }
                Spacer(Modifier.height(12.dp))
                LazyColumn(
                    Modifier.weight(1f).fillMaxWidth(),
                    contentPadding = PaddingValues(bottom = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (terms.isBlank()) {
                        item {
                            AksaraText(
                                "Sesi Terkini (" + sessions.size + ")",
                                size = 12.5f, weight = 650, color = AksaraColors.gold
                            )
                        }
                    } else {
                        item {
                            AksaraText(
                                "Sesi sepadan (" + matches.sessions.size + ")",
                                size = 12.5f, weight = 650, color = AksaraColors.gold
                            )
                        }
                    }
                    items(
                        if (terms.isBlank()) sessions.take(70) else matches.sessions,
                        key = { "session-" + it.startId }
                    ) { session ->
                        AksaraGlassSurface(
                            Modifier.fillMaxWidth().clickable(enabled = canManage) {
                                onRestoreSession(session.startId)
                                onClose()
                            },
                            radius = 14.dp
                        ) {
                            Row(
                                Modifier.fillMaxWidth().padding(start = 12.dp, end = 7.dp, top = 9.dp, bottom = 9.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                AksaraIcon("chat", Modifier.size(18.dp))
                                Spacer(Modifier.width(9.dp))
                                Column(Modifier.weight(1f)) {
                                    AksaraText(
                                        session.title, size = 12f, weight = 650,
                                        line = 16f, maxLines = 2
                                    )
                                    Spacer(Modifier.height(3.dp))
                                    AksaraText(
                                        session.messages.size.toString() + " mesej · " +
                                            session.messages.lastOrNull()?.text.orEmpty()
                                                .replace("\n", " ").take(65),
                                        size = 10f, line = 14f,
                                        color = AksaraColors.muted, maxLines = 2
                                    )
                                }
                                AksaraButton(
                                    "⋯", {
                                        selectedSessionId = session.startId
                                        choosingSession = false
                                        confirmDelete = false
                                        management = true
                                    },
                                    Modifier.width(40.dp).semantics {
                                        contentDescription = "Urus sesi " + session.title
                                    }, height = 40.dp, size = 20f, enabled = canManage
                                )
                            }
                        }
                    }
                    if (sessions.isEmpty()) item {
                        AksaraText(
                            "Belum ada sesi perbualan pada peranti ini.",
                            size = 11f, color = AksaraColors.muted
                        )
                    } else if (terms.isNotBlank() && matches.sessions.isEmpty()) item {
                        AksaraText(
                            "Tiada tajuk atau sesi yang sepadan.",
                            size = 11f, color = AksaraColors.muted
                        )
                    }
                    if (terms.isNotBlank()) {
                        item {
                            Spacer(Modifier.height(6.dp))
                            AksaraText(
                                "Mesej sepadan (" + matches.messages.size + ")",
                                size = 12.5f, weight = 650, color = AksaraColors.gold
                            )
                        }
                        items(matches.messages, key = { "message-" + it.second.id }) { (session, message) ->
                            AksaraGlassSurface(
                                Modifier.fillMaxWidth().clickable(enabled = canManage) {
                                    if (state.messages.none { it.id == message.id }) {
                                        onRestoreSession(session.startId)
                                    }
                                    onJumpToMessage(message.id)
                                    onClose()
                                }, radius = 14.dp
                            ) {
                                Column(Modifier.fillMaxWidth().padding(11.dp)) {
                                    AksaraText(session.title, size = 10f, color = AksaraColors.gold)
                                    Spacer(Modifier.height(4.dp))
                                    AksaraText(
                                        (if (message.role == "user") "Kau: " else "Aksara: ") +
                                            matchingExcerpt(message.text, terms),
                                        size = 11.5f, line = 17f, maxLines = 3
                                    )
                                    Spacer(Modifier.height(3.dp))
                                    AksaraText(
                                        "Tekan untuk buka mesej asal",
                                        size = 9.5f, color = AksaraColors.muted
                                    )
                                }
                            }
                        }
                        if (matches.messages.isEmpty()) item {
                            AksaraText(
                                "Tiada kandungan mesej yang sepadan.",
                                size = 11f, color = AksaraColors.muted
                            )
                        }
                    }
                }
                Spacer(Modifier.height(8.dp))
                AksaraButton(
                    "Urus Sesi & Memori", {
                        management = true
                        choosingSession = false
                        confirmDelete = false
                    }, Modifier.fillMaxWidth(), icon = "settings", height = 45.dp, size = 11.5f
                )
            } else {
                Column(
                    Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(9.dp)
                ) {
                    AksaraGlassSurface(Modifier.fillMaxWidth(), radius = 14.dp) {
                        Row(
                            Modifier.fillMaxWidth().padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            AksaraIcon("brain", Modifier.size(21.dp))
                            Spacer(Modifier.width(11.dp))
                            Column(Modifier.weight(1f)) {
                                AksaraText("Memori Aksara", size = 12f, weight = 650)
                                AksaraText(
                                    if (state.memoryEnabled) "Diaktifkan" else "Dimatikan",
                                    size = 10.5f, color = AksaraColors.muted
                                )
                            }
                            AksaraButton("›", onSettings, Modifier.width(39.dp).semantics {
                                contentDescription = "Buka tetapan Memori dan Privasi"
                            }, height = 39.dp, size = 20f)
                        }
                    }
                    AksaraText(
                        "Tetapan memori tidak diubah oleh Carian & Sejarah.",
                        size = 10f, color = AksaraColors.muted
                    )
                    Spacer(Modifier.height(3.dp))
                    AksaraText("Sesi dipilih", size = 12f, weight = 650, color = AksaraColors.gold)
                    AksaraGlassSurface(
                        Modifier.fillMaxWidth().clickable {
                            choosingSession = !choosingSession
                            confirmDelete = false
                        }, radius = 14.dp
                    ) {
                        Row(
                            Modifier.fillMaxWidth().padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            AksaraIcon("chat", Modifier.size(18.dp))
                            Spacer(Modifier.width(10.dp))
                            Column(Modifier.weight(1f)) {
                                AksaraText(
                                    selected?.title ?: "Pilih sesi untuk diurus",
                                    size = 12f, weight = 600, maxLines = 2
                                )
                                AksaraText(
                                    selected?.let { it.messages.size.toString() + " mesej" }
                                        ?: sessions.size.toString() + " sesi tersedia",
                                    size = 10f, color = AksaraColors.muted
                                )
                            }
                            AksaraText(if (choosingSession) "⌃" else "⌄", size = 18f)
                        }
                    }
                    if (choosingSession) {
                        if (sessions.isEmpty()) AksaraText(
                            "Tiada sesi untuk dipilih.", size = 11f,
                            color = AksaraColors.muted
                        )
                        else LazyColumn(
                            Modifier.fillMaxWidth().heightIn(max = 200.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            items(sessions, key = { "manage-" + it.startId }) { session ->
                                AksaraGlassSurface(
                                    Modifier.fillMaxWidth().clickable {
                                        selectedSessionId = session.startId
                                        choosingSession = false
                                        confirmDelete = false
                                    }, radius = 12.dp,
                                    border = if (selectedSessionId == session.startId)
                                        AksaraColors.gold else AksaraColors.border
                                ) {
                                    AksaraText(
                                        session.title,
                                        Modifier.fillMaxWidth().padding(10.dp),
                                        size = 11f, maxLines = 2
                                    )
                                }
                            }
                        }
                    }
                    Spacer(Modifier.height(3.dp))
                    AksaraButton(
                        "Buka sesi dipilih", {
                            selected?.let {
                                onRestoreSession(it.startId)
                                onClose()
                            }
                        }, Modifier.fillMaxWidth(),
                        icon = "chat", height = 43.dp, size = 11f,
                        enabled = canManage && selected != null
                    )
                    AksaraButton(
                        "Import JSON", onImportSessions,
                        Modifier.fillMaxWidth(), icon = "file-text",
                        height = 43.dp, size = 11f, enabled = canManage
                    )
                    AksaraButton(
                        "Eksport JSON · semua sesi", onExportSessions,
                        Modifier.fillMaxWidth(), icon = "file-text",
                        height = 43.dp, size = 11f,
                        enabled = canManage && sessions.isNotEmpty()
                    )
                    AksaraButton(
                        "Eksport JSON · sesi dipilih", {
                            selected?.let { onExportSession(it.startId) }
                        }, Modifier.fillMaxWidth(), icon = "file-text",
                        height = 43.dp, size = 11f,
                        enabled = canManage && selected != null
                    )
                    AksaraButton(
                        "Kongsi sesi dipilih", {
                            val selectedMessages = selected?.messages.orEmpty()
                            val body = selectedMessages.joinToString("\n\n") { message ->
                                (if (message.role == "user") "Kau" else "Aksara") + ": " + message.text
                            }
                            val intent = Intent(Intent.ACTION_SEND)
                                .setType("text/plain")
                                .putExtra(Intent.EXTRA_TEXT, body)
                            context.startActivity(Intent.createChooser(intent, "Kongsi perbualan Aksara"))
                        }, Modifier.fillMaxWidth(), icon = "chat",
                        height = 43.dp, size = 11f,
                        enabled = canManage && selected != null
                    )
                    if (confirmDelete && selected != null) {
                        AksaraGlassSurface(Modifier.fillMaxWidth(), radius = 14.dp) {
                            Column(Modifier.fillMaxWidth().padding(11.dp)) {
                                AksaraText(
                                    "Padam sesi ini secara kekal dari storan tempatan? Tindakan ini tidak boleh dibatalkan.",
                                    size = 11f, line = 17f
                                )
                                Spacer(Modifier.height(10.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    AksaraButton(
                                        "Batal", { confirmDelete = false },
                                        Modifier.weight(1f), height = 39.dp, size = 11f
                                    )
                                    AksaraButton(
                                        "Ya, padam", {
                                            val target = selectedSessionId ?: return@AksaraButton
                                            deleting = true
                                            scope.launch {
                                                val success = try {
                                                    onDeleteSession(target)
                                                } catch (_: Exception) { false }
                                                deleting = false
                                                if (success) {
                                                    selectedSessionId = null
                                                    confirmDelete = false
                                                    Toast.makeText(context, "Sesi berjaya dipadam.", Toast.LENGTH_SHORT).show()
                                                } else {
                                                    Toast.makeText(context, "Padam gagal. Arkib asal dikekalkan.", Toast.LENGTH_LONG).show()
                                                }
                                            }
                                        }, Modifier.weight(1f), height = 39.dp, size = 11f,
                                        enabled = canManage
                                    )
                                }
                            }
                        }
                    } else AksaraButton(
                        "Padam sesi dipilih", { confirmDelete = true },
                        Modifier.fillMaxWidth(), height = 43.dp, size = 11f,
                        enabled = canManage && selected != null
                    )
                    AksaraText(
                        "Eksport dan perkongsian menggunakan teks biasa. Fail JSON tidak mengandungi nota memori atau rahsia API.",
                        size = 10f, line = 15f, color = AksaraColors.muted
                    )
                    Spacer(Modifier.height(4.dp))
                    AksaraButton(
                        "Sesi baharu", { onClear(); onClose() },
                        Modifier.fillMaxWidth(), height = 43.dp, size = 11f,
                        enabled = canManage
                    )
                    AksaraButton(
                        "Buka semua mesej", { onRestore(); onClose() },
                        Modifier.fillMaxWidth(), height = 43.dp, size = 11f,
                        enabled = canManage && sessions.isNotEmpty()
                    )
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
