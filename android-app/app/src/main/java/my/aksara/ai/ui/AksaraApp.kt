package my.aksara.ai.ui

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.launch
import my.aksara.ai.data.ChatTurn

private val Night = Color(0xFF080D1A)
private val Glass = Color(0xBB18223A)
private val Ice = Color(0xFFA8BFFF)
private val Orchid = Color(0xFFC3A7FF)
private val Border = Color(0x30FFFFFF)

@Composable
fun AksaraApp(vm: AksaraViewModel = viewModel()) {
    var tab by rememberSaveable { mutableStateOf("Chat") }
    Box(
        modifier = Modifier.fillMaxSize().background(
            Brush.verticalGradient(
                listOf(Color(0xFF141A35), Night, Color(0xFF0A0D18))
            )
        )
    ) {
        Scaffold(
            containerColor = Color.Transparent,
            topBar = { AksaraHeader(vm.status, vm.statusReady) },
            bottomBar = {
                Row(
                    modifier = Modifier.fillMaxWidth()
                        .background(Glass)
                        .border(width = 1.dp, color = Border)
                        .navigationBarsPadding()
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    listOf("Chat", "Studio", "Novel").forEach { name ->
                        val selected = tab == name
                        TextButton(
                            modifier = Modifier.weight(1f),
                            onClick = { tab = name },
                            colors = ButtonDefaults.textButtonColors(
                                contentColor = if (selected) Ice else Color(0xFFABB5D0)
                            )
                        ) {
                            Text(
                                name,
                                fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal
                            )
                        }
                    }
                }
            }
        ) { insets ->
            when (tab) {
                "Chat" -> ChatPage(vm, Modifier.padding(insets))
                "Studio" -> ComingSoon(
                    "STUDIO ANTARA",
                    "Native image generation, presets dan galeri sedang dibangunkan.",
                    Modifier.padding(insets)
                )
                else -> ComingSoon(
                    "PERPUSTAKAAN AKSARA",
                    "Pembaca novel native akan dibangunkan selepas chat stabil.",
                    Modifier.padding(insets)
                )
            }
        }
    }
}

@Composable
private fun AksaraHeader(status: String, ready: Boolean) {
    Column(
        modifier = Modifier.fillMaxWidth()
            .statusBarsPadding()
            .padding(horizontal = 20.dp, vertical = 9.dp),
        verticalArrangement = Arrangement.spacedBy(5.dp)
    ) {
        Text(
            text = "AKSARA A.I.",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            letterSpacing = 2.sp,
            color = Color(0xFFF0F2FF)
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(7.dp).clip(CircleShape)
                    .background(if (ready)
                        Color(0xFF8CDBBA) else Color(0xFF9EA9CA))
            )
            Spacer(Modifier.size(7.dp))
            Text(status, style = MaterialTheme.typography.labelSmall, color = Color(0xFFB4BFDB))
        }
    }
}

@Composable
private fun ChatPage(vm: AksaraViewModel, modifier: Modifier = Modifier) {
    var draft by rememberSaveable { mutableStateOf("") }
    var menuExpanded by remember { mutableStateOf(false) }
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()
    val totalItems = listState.layoutInfo.totalItemsCount
    val lastVisible = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
    val nearBottom = lastVisible >= totalItems - 3
    LaunchedEffect(vm.messages.size, vm.streamingTick) {
        if (vm.messages.isNotEmpty() && (nearBottom || vm.messages.size <= 2)) {
            val last = listState.layoutInfo.totalItemsCount - 1
            if (last >= 0) listState.scrollToItem(last)
        }
    }
    LaunchedEffect(Unit) {
        if (vm.messages.isNotEmpty()) {
            val last = listState.layoutInfo.totalItemsCount - 1
            if (last >= 0) listState.scrollToItem(last)
        }
    }
    fun submit() {
        if (vm.send(draft)) {
            draft = ""
            scope.launch {
                val last = listState.layoutInfo.totalItemsCount - 1
                if (last >= 0) listState.scrollToItem(last)
            }
        }
    }

    Column(
        modifier = modifier.fillMaxSize().imePadding()
            .padding(horizontal = 14.dp),
        verticalArrangement = Arrangement.spacedBy(5.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            FilterChip(
                selected = vm.mode == "cahaya",
                onClick = { vm.selectMode("cahaya") },
                label = { Text("CAHAYA") }
            )
            FilterChip(
                selected = vm.mode == "gelap",
                onClick = { vm.selectMode("gelap") },
                label = { Text("GELAP") }
            )
            Spacer(Modifier.weight(1f))
            if (vm.messages.isNotEmpty() && !nearBottom) {
                TextButton(onClick = {
                    scope.launch {
                        val last = listState.layoutInfo.totalItemsCount - 1
                        if (last >= 0) listState.animateScrollToItem(last)
                    }
                }) { Text("↓", fontSize = 20.sp) }
            }
            Box {
                TextButton(onClick = { menuExpanded = true }) {
                    Text("⋮", fontSize = 23.sp, color = Ice)
                }
                DropdownMenu(
                    expanded = menuExpanded,
                    onDismissRequest = { menuExpanded = false }
                ) {
                    DropdownMenuItem(
                        text = {
                            Text(
                                if (vm.saveSession) "Simpan sesi: ON" else "Simpan sesi: OFF"
                            )
                        },
                        onClick = {
                            vm.setSaveSession(!vm.saveSession)
                            menuExpanded = false
                        }
                    )
                    DropdownMenuItem(
                        text = { Text("Kosongkan perbualan") },
                        enabled = vm.messages.isNotEmpty() && !vm.busy,
                        onClick = {
                            vm.clear()
                            menuExpanded = false
                        }
                    )
                    DropdownMenuItem(
                        text = { Text("Mod tersedia di bahagian atas chat") },
                        enabled = false,
                        onClick = {}
                    )
                }
            }
        }

        LazyColumn(
            modifier = Modifier.weight(1f).fillMaxWidth(),
            state = listState,
            verticalArrangement = Arrangement.spacedBy(11.dp),
            contentPadding = PaddingValues(top = 2.dp, bottom = 10.dp)
        ) {
            if (vm.messages.isEmpty()) {
                item(key = "welcome") {
                    Column(
                        modifier = Modifier.fillMaxWidth()
                            .padding(top = 34.dp, bottom = 22.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        AksaraOrb()
                        Text(
                            "Antara Aksara dan Code.",
                            color = Color(0xFFF0F2FF),
                            fontSize = 19.sp,
                            fontWeight = FontWeight.SemiBold,
                            textAlign = TextAlign.Center
                        )
                        Text(
                            "Kau bawa soalan, aku bawa logik.\nKalau tak cukup, kita persoalkan jawapan.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color(0xFFB7C2DF),
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
            items(vm.messages) { message ->
                MessageBubble(message)
            }
            if (vm.busy) {
                item(key = "busy") {
                    Text(
                        if (vm.messages.lastOrNull()?.role == "assistant") "Menerima jawapan…" else "Aksara sedang berfikir…",
                        modifier = Modifier.padding(12.dp),
                        color = Orchid,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
            item(key = "end") { Spacer(Modifier.height(4.dp)) }
        }

        vm.error?.let { issue ->
            Text(
                issue,
                modifier = Modifier.fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color(0x554A2738))
                    .padding(10.dp),
                color = Color(0xFFFFC7D1),
                style = MaterialTheme.typography.bodySmall
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth().padding(bottom = 6.dp),
            verticalAlignment = Alignment.Bottom,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedTextField(
                value = draft,
                onValueChange = { if (it.length <= 12_000) draft = it },
                modifier = Modifier.weight(1f),
                placeholder = { Text("Tulis kepada Aksara…") },
                enabled = !vm.busy,
                minLines = 1,
                maxLines = 5,
                shape = RoundedCornerShape(20.dp),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                keyboardActions = KeyboardActions(onSend = { submit() })
            )
            Button(
                onClick = { if (vm.busy) vm.stop() else submit() },
                enabled = vm.busy || draft.isNotBlank(),
                modifier = Modifier.height(56.dp),
                shape = RoundedCornerShape(16.dp)
            ) { Text(if (vm.busy) "Henti" else "Hantar") }
        }
    }
}

@Composable
private fun MessageBubble(message: ChatTurn) {
    val mine = message.role == "user"
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(if (mine) 0.94f else 0.97f)
                .clip(RoundedCornerShape(19.dp))
                .background(if (mine) Color(0xB940527A) else Glass)
                .border(1.dp, if (mine) Color(0x668FA8FF) else Border, RoundedCornerShape(19.dp))
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(7.dp)
        ) {
            Text(
                if (mine) "KAU" else "AKSARA",
                color = if (mine) Ice else Orchid,
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold
            )
            SelectionContainer {
                if (mine) {
                    Text(
                        message.content,
                        color = Color(0xFFF0F3FF),
                        style = MaterialTheme.typography.bodyLarge
                    )
                } else {
                    MarkdownMessage(message.content)
                }
            }
            if (!mine && !message.complete) {
                Text(
                    "Jawapan belum lengkap",
                    color = Color(0xFFD9B9E6),
                    style = MaterialTheme.typography.labelSmall
                )
            }
            if (!mine && !message.provider.isNullOrBlank()) {
                Text(
                    "Model · " + message.provider,
                    color = Color(0xFFA1AEC9),
                    style = MaterialTheme.typography.labelSmall
                )
            }
        }
    }
}

@Composable
private fun AksaraOrb() {
    val pulse by rememberInfiniteTransition(label = "aksara-orb").animateFloat(
        initialValue = 0.96f,
        targetValue = 1.04f,
        animationSpec = infiniteRepeatable(tween(2400), RepeatMode.Reverse),
        label = "orb-pulse"
    )
    Box(
        modifier = Modifier.size(94.dp)
            .graphicsLayer { scaleX = pulse; scaleY = pulse }
            .clip(CircleShape)
            .background(Brush.radialGradient(listOf(Color(0xFF667AC5), Color(0xFF292A5A), Night)))
            .border(1.dp, Color(0x8897B6FF), CircleShape),
        contentAlignment = Alignment.Center
    ) {
        Text("A", fontSize = 48.sp, fontWeight = FontWeight.Light, color = Color.White)
    }
}

@Composable
private fun ComingSoon(title: String, detail: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxSize().padding(26.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        AksaraOrb()
        Spacer(Modifier.height(26.dp))
        Text(title, fontSize = 22.sp, color = Color.White, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(12.dp))
        Text(
            detail,
            textAlign = TextAlign.Center,
            color = Color(0xFFB4C0DD),
            style = MaterialTheme.typography.bodyLarge
        )
        Spacer(Modifier.height(10.dp))
        Text("Dalam pembangunan · Native Android", color = Ice, fontSize = 12.sp)
    }
}
