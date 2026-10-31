package my.aksara.ai.ui

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.speech.RecognizerIntent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.launch
import my.aksara.ai.R
import my.aksara.ai.data.ChatSession
import my.aksara.ai.data.AttachmentDraft
import my.aksara.ai.data.AndroidAttachmentReader
import my.aksara.ai.data.ChatTurn

private val Night = Color(0xFF080D1A)
private val Glass = Color(0xC21A243C)
private val Ice = Color(0xFFA8BFFF)
private val Orchid = Color(0xFFC3A7FF)
private val Border = Color(0x36FFFFFF)
private val Soft = Color(0xFFB7C4DF)

@Composable
fun AksaraApp(vm: AksaraViewModel = viewModel()) {
    var tab by rememberSaveable { mutableStateOf("Chat") }
    var sessionsOpen by remember { mutableStateOf(false) }
    var featuresOpen by remember { mutableStateOf(false) }
    var providersOpen by remember { mutableStateOf(false) }
    val tint = if (vm.mode == "gelap") Color(0xFF322047) else Color(0xFF13264B)
    Box(
        modifier = Modifier.fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(tint, Night, Color(0xFF0A0D18))
                )
            )
    ) {
        Image(
            painter = painterResource(R.drawable.aksara_bilik_background),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize().graphicsLayer {
                alpha = if (vm.mode == "gelap") 0.22f else 0.32f
            }
        )
        Box(
            Modifier.fillMaxSize().background(
                Brush.verticalGradient(
                    listOf(Color(0x88141A35), Color(0x77080D1A), Color(0xD9080D1A))
                )
            )
        )
        Scaffold(
            containerColor = Color.Transparent,
            topBar = {
                AksaraHeader(
                    vm,
                    onSessions = { tab = "Chat"; sessionsOpen = true },
                    onFeatures = { featuresOpen = true },
                    onProviders = { providersOpen = true },
                    onVoice = { tab = "Voice" }
                )
            },
            bottomBar = {
                Row(
                    modifier = Modifier.fillMaxWidth()
                        .background(Glass)
                        .border(1.dp, Border)
                        .navigationBarsPadding()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(3.dp)
                ) {
                    listOf("Chat", "Voice", "Studio", "Novel").forEach { target ->
                        val selected = tab == target
                        TextButton(
                            modifier = Modifier.weight(1f),
                            onClick = { tab = target },
                            colors = ButtonDefaults.textButtonColors(
                                contentColor = if (selected) Ice else Soft
                            )
                        ) {
                            Text(
                                target,
                                fontSize = 13.sp,
                                fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal
                            )
                        }
                    }
                }
            }
        ) { insets ->
            when (tab) {
                "Chat" -> ChatPage(vm, Modifier.padding(insets))
                "Voice" -> AksaraVoiceScreen(vm, Modifier.padding(insets), openChat = { tab = "Chat" })
                "Studio" -> AksaraStudioScreen(Modifier.padding(insets))
                else -> AksaraNovelScreen(Modifier.padding(insets))
            }
        }
        if (sessionsOpen) {
            SessionManager(vm, onClose = { sessionsOpen = false })
        }
        if (featuresOpen) {
            AksaraFeatureHub(
                vm,
                onDismiss = { featuresOpen = false },
                onNavigate = { tab = it; featuresOpen = false },
                onSessions = { featuresOpen = false; tab = "Chat"; sessionsOpen = true },
                onProviders = { featuresOpen = false; providersOpen = true }
            )
        }
        if (providersOpen) {
            AksaraProviderDialog(vm, onDismiss = { providersOpen = false })
        }
    }
}

@Composable
private fun AksaraHeader(
    vm: AksaraViewModel,
    onSessions: () -> Unit,
    onFeatures: () -> Unit,
    onProviders: () -> Unit,
    onVoice: () -> Unit
) {
    val activeTitle = vm.sessions.firstOrNull { it.id == vm.activeId }?.title ?: "Sesi Baharu"
    Column(
        modifier = Modifier.fillMaxWidth().statusBarsPadding()
            .padding(horizontal = 14.dp, vertical = 5.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Image(
                painter = painterResource(R.drawable.aksara_site_icon),
                contentDescription = null,
                modifier = Modifier.size(31.dp).clip(CircleShape)
            )
            Spacer(Modifier.size(8.dp))
            Column(Modifier.weight(1f)) {
                Text("AKSARA A.I.", color = Color(0xFFF3F4FF), fontSize = 19.sp,
                    letterSpacing = 1.7.sp, fontWeight = FontWeight.Bold)
                Text("Antara cahaya dan gelap", color = Soft, fontSize = 10.sp)
            }
            TextButton(
                onClick = onSessions,
                modifier = Modifier.background(Color(0x551A2B48), RoundedCornerShape(14.dp))
            ) {
                Text(
                    if (activeTitle.length > 13) activeTitle.take(12) + "…" else activeTitle,
                    color = Ice, fontSize = 11.sp
                )
            }
            TextButton(onClick = onFeatures) {
                Text("☷", color = Ice, fontSize = 24.sp)
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(7.dp)
        ) {
            TextButton(
                onClick = onProviders,
                modifier = Modifier.weight(1f)
                    .background(Glass, RoundedCornerShape(16.dp))
                    .border(1.dp, Border, RoundedCornerShape(16.dp))
            ) {
                Box(
                    Modifier.size(7.dp).clip(CircleShape)
                        .background(if (vm.statusReady) Color(0xFF92DDC2)
                            else Color(0xFFB7C2DE))
                )
                Spacer(Modifier.size(7.dp))
                Text("Multi A.I. Connected", color = Ice, fontSize = 11.sp,
                    maxLines = 1)
            }
            TextButton(
                onClick = onVoice,
                modifier = Modifier.weight(1f)
                    .background(Glass, RoundedCornerShape(16.dp))
                    .border(1.dp, Border, RoundedCornerShape(16.dp))
            ) {
                Text("◉  Jom Voice Chat", color = Ice, fontSize = 11.sp,
                    maxLines = 1)
            }
        }
        Text(vm.status, color = Soft, fontSize = 10.sp, maxLines = 1,
            modifier = Modifier.padding(start = 4.dp))
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SessionManager(vm: AksaraViewModel, onClose: () -> Unit) {
    var query by remember { mutableStateOf("") }
    var rename by remember { mutableStateOf<ChatSession?>(null) }
    var renameDraft by remember { mutableStateOf("") }
    var delete by remember { mutableStateOf<ChatSession?>(null) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val sessions = vm.sessions.filter { session ->
        query.isBlank() ||
            session.title.contains(query, ignoreCase = true) ||
            session.messages.any { it.content.contains(query, ignoreCase = true) }
    }.sortedWith(compareByDescending<ChatSession> { it.pinned }.thenByDescending { it.updatedAt })

    ModalBottomSheet(
        onDismissRequest = onClose,
        sheetState = sheetState,
        containerColor = Color(0xFF121B2E)
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("SESI & MEMORI", color = Color.White, fontWeight = FontWeight.Bold,
                    fontSize = 19.sp)
                TextButton(onClick = {
                    vm.newSession()
                    if (vm.sessions.any { it.id == vm.activeId && it.messages.isEmpty() }) {
                        onClose()
                    }
                }, enabled = !vm.busy) { Text("+ Sesi baharu") }
            }
            Text(
                "Arkib hanya pada peranti ini. Ia bukan semantic memory atau sync web.",
                color = Soft, fontSize = 12.sp
            )
            OutlinedTextField(
                value = query,
                onValueChange = { query = it.take(80) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                label = { Text("Cari sesi atau mesej") }
            )
            Text(
                if (vm.saveSession) "Simpan sesi: ON · dalam storan aplikasi"
                else "Simpan sesi: OFF · hilang selepas aplikasi ditutup",
                color = if (vm.saveSession) Color(0xFF9DDFBB) else Color(0xFFE3B3AE),
                fontSize = 12.sp
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(
                    onClick = { vm.updateSessionSaving(!vm.saveSession) },
                    enabled = !vm.busy
                ) { Text(if (vm.saveSession) "Matikan simpanan" else "Aktifkan simpanan") }
                TextButton(onClick = vm::checkBackend, enabled = !vm.busy) {
                    Text("Semak backend")
                }
            }
            LazyColumn(
                modifier = Modifier.fillMaxWidth().height(380.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(sessions, key = { it.id }) { session ->
                    Column(
                        modifier = Modifier.fillMaxWidth()
                            .background(
                                if (session.id == vm.activeId) Color(0xFF2A3858)
                                else Color(0xFF1C2940),
                                RoundedCornerShape(16.dp)
                            )
                            .clickable(enabled = !vm.busy) {
                                vm.openSession(session.id)
                                onClose()
                            }
                            .padding(13.dp),
                        verticalArrangement = Arrangement.spacedBy(5.dp)
                    ) {
                        Text((if (session.pinned) "★  " else "") + session.title, color = Color.White,
                            fontWeight = FontWeight.SemiBold, maxLines = 2)
                        Text(
                            session.messages.lastOrNull()?.content?.take(85) ?: "Belum ada mesej",
                            color = Soft, fontSize = 12.sp, maxLines = 2
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                            TextButton(
                                onClick = { vm.togglePinSession(session.id) },
                                enabled = !vm.busy
                            ) { Text(if (session.pinned) "Nyahpin" else "Pin", fontSize = 12.sp) }
                            TextButton(onClick = {
                                rename = session
                                renameDraft = session.title
                            }, enabled = !vm.busy) { Text("Namakan", fontSize = 12.sp) }
                            TextButton(onClick = { delete = session }, enabled = !vm.busy) {
                                Text("Padam", color = Color(0xFFFFC1C6), fontSize = 12.sp)
                            }
                        }
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
        }
    }
    rename?.let { selected ->
        AlertDialog(
            onDismissRequest = { rename = null },
            title = { Text("Namakan sesi") },
            text = {
                OutlinedTextField(
                    value = renameDraft,
                    onValueChange = { renameDraft = it.take(64) },
                    label = { Text("Tajuk sesi") }
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    vm.renameSession(selected.id, renameDraft)
                    rename = null
                }) { Text("Simpan") }
            },
            dismissButton = { TextButton(onClick = { rename = null }) { Text("Batal") } }
        )
    }
    delete?.let { selected ->
        AlertDialog(
            onDismissRequest = { delete = null },
            title = { Text("Padam sesi?") },
            text = { Text("Perbualan dalam sesi ini akan dipadam daripada peranti.") },
            confirmButton = {
                TextButton(onClick = {
                    vm.deleteSession(selected.id)
                    delete = null
                }) { Text("Padam", color = Color(0xFFC95465)) }
            },
            dismissButton = { TextButton(onClick = { delete = null }) { Text("Batal") } }
        )
    }
}

@Composable
private fun ChatPage(vm: AksaraViewModel, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    var draft by rememberSaveable { mutableStateOf("") }
    var speechNote by remember { mutableStateOf("") }
    var attachment by remember { mutableStateOf<AttachmentDraft?>(null) }
    var modeOpen by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val attachmentReader = remember(context) {
        AndroidAttachmentReader(context.contentResolver)
    }
    val picker = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenMultipleDocuments()
    ) { files ->
        if (files.isNotEmpty()) {
            scope.launch {
                runCatching { attachmentReader.load(files) }
                    .onSuccess {
                        attachment = it
                        speechNote = "Lampiran: " + it.displayName
                    }
                    .onFailure { error ->
                        attachment = null
                        speechNote = error.message ?: "Fail ini tidak dapat dibaca."
                    }
            }
        }
    }
    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { outcome ->
        if (outcome.resultCode == Activity.RESULT_OK) {
            val spoken = outcome.data
                ?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
                ?.firstOrNull()
            if (!spoken.isNullOrBlank()) {
                draft = (draft + " " + spoken).trim().take(12_000)
                speechNote = ""
            }
        }
    }
    fun speak() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ms-MY")
            putExtra(RecognizerIntent.EXTRA_PROMPT, "Cakap kepada Aksara…")
        }
        try { launcher.launch(intent) }
        catch (_: ActivityNotFoundException) {
            speechNote = "Telefon ini tiada servis pengecaman suara Android."
        } catch (_: SecurityException) {
            speechNote = "Kebenaran pengecaman suara tidak tersedia."
        }
    }
    val listState = rememberLazyListState()
    var pinnedBottom by remember { mutableStateOf(true) }
    LaunchedEffect(listState.isScrollInProgress) {
        if (listState.isScrollInProgress) {
            val last = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            pinnedBottom = last >= listState.layoutInfo.totalItemsCount - 3
        }
    }
    LaunchedEffect(vm.activeId) {
        pinnedBottom = true
        attachment = null
    }
    LaunchedEffect(vm.activeId, vm.messages.size, vm.streamingTick) {
        if (pinnedBottom) {
            val index = listState.layoutInfo.totalItemsCount - 1
            if (index >= 0) listState.scrollToItem(index)
        }
    }
    fun submit() {
        val question = draft.trim().ifBlank {
            if (attachment != null) "Terangkan kandungan lampiran yang disertakan." else ""
        }
        if (vm.send(question, attachment)) {
            draft = ""
            attachment = null
            speechNote = ""
            pinnedBottom = true
        }
    }

    Column(
        modifier = modifier.fillMaxSize().imePadding().padding(horizontal = 13.dp),
        verticalArrangement = Arrangement.spacedBy(5.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            TextButton(onClick = { modeOpen = true }) {
                Text("Thinking Mode · " + vm.mode.uppercase(), color = Ice,
                    fontSize = 12.sp)
            }
            Spacer(Modifier.weight(1f))
            if (!pinnedBottom) {
                TextButton(onClick = {
                    pinnedBottom = true
                    scope.launch {
                        val index = listState.layoutInfo.totalItemsCount - 1
                        if (index >= 0) listState.animateScrollToItem(index)
                    }
                }) { Text("↓ Bawah", fontSize = 12.sp) }
            }
            TextButton(onClick = { vm.newSession() }, enabled = !vm.busy) {
                Text("+", fontSize = 24.sp, color = Ice)
            }
        }

        LazyColumn(
            modifier = Modifier.weight(1f).fillMaxWidth(),
            state = listState,
            verticalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = PaddingValues(top = 4.dp, bottom = 12.dp)
        ) {
            if (vm.messages.isEmpty()) {
                item(key = "welcome") {
                    Column(
                        modifier = Modifier.fillMaxWidth()
                            .padding(top = 40.dp, bottom = 22.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        AksaraOrb(vm.mode)
                        Text("Antara aksara dan code,", color = Color.White,
                            fontSize = 18.sp, fontWeight = FontWeight.SemiBold,
                            textAlign = TextAlign.Center)
                        Text(
                            "GAYA yang bebas,\nBEBAS dalam bentuk,\nLUAS dalam pemikiran.",
                            color = Soft, fontSize = 14.sp, textAlign = TextAlign.Center
                        )
                    }
                }
            }
            if (vm.messages.isEmpty()) {
                item(key = "starters") {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        listOf(
                            "Siapa Aku",
                            "The Coder Poet",
                            "Apa itu Puisi Gaya Bebas"
                        ).forEach { prompt ->
                            OutlinedButton(
                                onClick = { vm.send(prompt); pinnedBottom = true },
                                enabled = !vm.busy,
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(16.dp)
                            ) {
                                Text(prompt, color = Ice, fontSize = 12.sp)
                            }
                        }
                    }
                }
            }
            items(vm.messages, key = { it.id }) { turn ->
                val latest = vm.messages.lastOrNull()?.id == turn.id
                MessageBubble(turn, latest && !vm.busy,
                    onRegenerate = vm::regenerateLast)
            }
            if (!vm.busy && vm.messages.size >= 2 &&
                vm.messages.lastOrNull()?.role == "assistant" &&
                vm.messages.dropLast(1).lastOrNull()?.role == "user" &&
                vm.messages.dropLast(1).last().content.trim().lowercase()
                    .matches(Regex("siapa aku[?!., ]*"))
            ) {
                item(key = "coder-poet-followup") {
                    OutlinedButton(
                        onClick = { vm.send("The Coder Poet"); pinnedBottom = true },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !vm.busy
                    ) { Text("Nak tahu tentang The Coder Poet pulak ke?", color = Ice) }
                }
            }
            if (vm.busy) {
                item(key = "busy") {
                    Text(
                        if (vm.messages.lastOrNull()?.role == "assistant")
                            "Menerima jawapan…" else "Aksara sedang berfikir…",
                        color = Orchid, modifier = Modifier.padding(10.dp),
                        fontSize = 12.sp
                    )
                }
            }
            item(key = "end") { Spacer(Modifier.height(3.dp)) }
        }

        vm.error?.let { issue ->
            Column(
                modifier = Modifier.fillMaxWidth()
                    .background(Color(0x664B273C), RoundedCornerShape(13.dp))
                    .padding(10.dp)
            ) {
                Text(issue, color = Color(0xFFFFC6CE), fontSize = 12.sp)
                if (vm.canRetry()) {
                    TextButton(onClick = { vm.retryLast(); pinnedBottom = true }) {
                        Text("Cuba semula secara manual", color = Color(0xFFF5D5DB))
                    }
                }
            }
        }
        if (speechNote.isNotBlank()) Text(speechNote, color = Ice,
            fontSize = 11.sp)
        if (attachment != null) {
            Row(
                modifier = Modifier.fillMaxWidth()
                    .background(Glass, RoundedCornerShape(13.dp))
                    .padding(horizontal = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("＋ " + attachment!!.displayName, color = Soft, fontSize = 11.sp,
                    modifier = Modifier.weight(1f), maxLines = 1)
                TextButton(onClick = { attachment = null; speechNote = "" }) {
                    Text("Buang", color = Color(0xFFFFC6CE), fontSize = 11.sp)
                }
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth().padding(bottom = 5.dp),
            horizontalArrangement = Arrangement.spacedBy(7.dp),
            verticalAlignment = Alignment.Bottom
        ) {
            TextButton(
                onClick = {
                    picker.launch(arrayOf("image/*", "video/mp4", "video/webm",
                        "application/pdf", "text/*", "audio/*"))
                },
                enabled = !vm.busy
            ) { Text("＋", fontSize = 22.sp, color = Ice) }
            TextButton(
                onClick = ::speak,
                enabled = !vm.busy
            ) { Text("🎙", fontSize = 17.sp, color = Ice) }
            OutlinedTextField(
                value = draft,
                onValueChange = { if (it.length <= 12_000) draft = it },
                modifier = Modifier.weight(1f),
                placeholder = { Text("Tulis kepada Aksara…") },
                minLines = 1, maxLines = 5,
                enabled = !vm.busy,
                shape = RoundedCornerShape(19.dp),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                keyboardActions = KeyboardActions(onSend = { submit() })
            )
            Button(
                onClick = { if (vm.busy) vm.stop() else submit() },
                enabled = vm.busy || draft.isNotBlank() || attachment != null,
                modifier = Modifier.height(56.dp),
                shape = RoundedCornerShape(16.dp)
            ) { Text(if (vm.busy) "Henti" else "➤") }
        }
        if (vm.lastLatencyMs != null && !vm.busy) {
            Text("Respons " + (vm.lastLatencyMs!! / 1000.0).toString().take(4) +
                "s" + (vm.lastProvider?.let { " · " + it } ?: ""),
                color = Soft, fontSize = 10.sp,
                modifier = Modifier.padding(start = 6.dp, bottom = 2.dp))
        }
    }
    if (modeOpen) {
        AlertDialog(
            onDismissRequest = { modeOpen = false },
            title = { Text("Thinking Mode · AKSARA") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("CAHAYA: santai, jelas dan praktikal. GELAP: kritis, falsafah dan memeriksa premis.")
                    FilterChip(
                        selected = vm.mode == "cahaya",
                        onClick = { vm.selectMode("cahaya"); modeOpen = false },
                        enabled = !vm.busy,
                        label = { Text("☼  CAHAYA") }
                    )
                    FilterChip(
                        selected = vm.mode == "gelap",
                        onClick = { vm.selectMode("gelap"); modeOpen = false },
                        enabled = !vm.busy,
                        label = { Text("☾  GELAP") }
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = { modeOpen = false }) { Text("Tutup") }
            }
        )
    }
}

@Composable
private fun MessageBubble(
    message: ChatTurn,
    isLast: Boolean,
    onRegenerate: () -> Boolean
) {
    val context = LocalContext.current
    val mine = message.role == "user"
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(if (mine) 0.93f else 0.97f)
                .clip(RoundedCornerShape(19.dp))
                .background(
                    Brush.verticalGradient(
                        if (mine) listOf(Color(0xC43E547D), Color(0xA126385A))
                        else listOf(Color(0xD1212A45), Color(0xAF172039))
                    )
                )
                .border(1.dp, if (mine) Color(0x668FA8FF) else Border,
                    RoundedCornerShape(19.dp))
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(7.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (!mine) {
                    Image(
                        painter = painterResource(R.drawable.aksara_chat_portrait),
                        contentDescription = null,
                        modifier = Modifier.size(22.dp).clip(CircleShape)
                    )
                    Spacer(Modifier.size(7.dp))
                }
                Text(
                    if (mine) "KAU" else "AKSARA",
                    color = if (mine) Ice else Orchid,
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold
                )
                Spacer(Modifier.weight(1f))
                Text(
                    java.text.DateFormat.getTimeInstance(
                        java.text.DateFormat.SHORT,
                        java.util.Locale.forLanguageTag("ms-MY")
                    ).format(java.util.Date(message.timestamp)),
                    color = Soft, fontSize = 10.sp
                )
            }
            SelectionContainer {
                if (mine) {
                    Text(message.content, color = Color(0xFFF0F3FF),
                        style = MaterialTheme.typography.bodyLarge)
                } else {
                    MarkdownMessage(message.content)
                }
            }
            if (!mine && message.disclaimer.isNotBlank()) {
                Text(
                    message.disclaimer,
                    color = Color(0xFFD8C79F),
                    fontSize = 11.sp
                )
            }
            if (!mine && message.sources.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text("SUMBER SEMAKAN", color = Ice, fontSize = 10.sp,
                        fontWeight = FontWeight.Bold)
                    message.sources.forEach { source ->
                        TextButton(onClick = {
                            runCatching {
                                context.startActivity(
                                    Intent(Intent.ACTION_VIEW, Uri.parse(source.url))
                                )
                            }
                        }) {
                            Text(source.title + " ↗", color = Ice, fontSize = 12.sp,
                                maxLines = 2)
                        }
                    }
                }
            }
            if (!mine && !message.complete) {
                Text("Jawapan belum lengkap", color = Color(0xFFD9B9E6),
                    style = MaterialTheme.typography.labelSmall)
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextButton(
                    onClick = {
                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE)
                            as ClipboardManager
                        clipboard.setPrimaryClip(
                            ClipData.newPlainText("AKSARA A.I.", message.content)
                        )
                    }
                ) { Text("Salin", fontSize = 11.sp) }
                if (!mine && isLast && message.complete) {
                    TextButton(onClick = { onRegenerate() }) {
                        Text("Jana semula", fontSize = 11.sp)
                    }
                }
                if (!mine && !message.provider.isNullOrBlank()) {
                    Text("· " + message.provider, color = Soft, fontSize = 11.sp)
                }
            }
        }
    }
}

@Composable
private fun AksaraOrb(mode: String) {
    val pulse by rememberInfiniteTransition(label = "aksara-orb")
        .animateFloat(
            initialValue = 0.97f,
            targetValue = 1.045f,
            animationSpec = infiniteRepeatable(
                animation = tween(2600), repeatMode = RepeatMode.Reverse
            ),
            label = "breath"
        )
    Box(
        modifier = Modifier.size(90.dp)
            .graphicsLayer { scaleX = pulse; scaleY = pulse }
            .clip(CircleShape)
            .background(
                Brush.radialGradient(
                    if (mode == "gelap")
                        listOf(Color(0xFF7756B1), Color(0xFF35295A), Night)
                    else
                        listOf(Color(0xFF7186CA), Color(0xFF293B68), Night)
                )
            )
            .border(1.dp, Color(0x888FAFFF), CircleShape),
        contentAlignment = Alignment.Center
    ) {
        Text("A", fontSize = 45.sp, fontWeight = FontWeight.Light, color = Color.White)
    }
}
