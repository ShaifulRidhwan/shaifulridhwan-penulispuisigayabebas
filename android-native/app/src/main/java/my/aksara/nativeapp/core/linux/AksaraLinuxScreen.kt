package my.aksara.nativeapp.core.linux

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.hazeSource
import my.aksara.nativeapp.core.design.*
import my.aksara.nativeapp.feature.chat.ChatWallpaper
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Android shell preview only. Not yet an embedded Linux distribution or PTY.
 * A real userland bootstrap and terminal emulation are still required.
 */
@Composable
fun AksaraLinuxScreen(
    onBack: () -> Unit,
    onDialogVisibilityChange: (Boolean) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val backdrop = remember { HazeState() }
    val margins = aksaraDeviceMargins()
    val history = remember { mutableStateListOf<String>() }
    val scroll = rememberLazyListState()
    var input by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var rootMode by remember { mutableStateOf(false) }
    var showRootApproval by remember { mutableStateOf(false) }

    fun submit(command: String) {
        val cmd = command.trim()
        if (cmd.isEmpty() || busy) return
        input = ""
        if (cmd == "clear") { history.clear(); return }
        history.add((if (rootMode) "# " else "$ ") + cmd)
        busy = true
        scope.launch {
            val result = withContext(Dispatchers.IO) {
                var process: Process? = null
                try {
                    val argv = if (rootMode) listOf("su", "-c", cmd)
                        else listOf("/system/bin/sh", "-c", cmd)
                    process = ProcessBuilder(argv)
                        .directory(context.filesDir)
                        .redirectErrorStream(true)
                        .start()
                    val finished = process.waitFor(30, TimeUnit.SECONDS)
                    if (!finished) {
                        process.destroyForcibly()
                        "Process timed out after 30 seconds."
                    } else {
                        val output = process.inputStream.bufferedReader().use { it.readText() }
                        val clipped = output.take(12000)
                        val truncated = if (output.length > 12000) "\n[Output truncated]" else ""
                        val exit = if (process.exitValue() != 0) "\n[exit " + process.exitValue() + "]" else ""
                        (clipped + truncated + exit).ifEmpty { "[exit 0]" }
                    }
                } catch (error: Exception) {
                    error.message ?: "Could not start Android shell."
                } finally {
                    process?.destroy()
                }
            }
            history.add(result)
            busy = false
        }
    }

    LaunchedEffect(history.size) {
        if (history.isNotEmpty()) scroll.animateScrollToItem(history.lastIndex)
    }
    LaunchedEffect(showRootApproval) { onDialogVisibilityChange(showRootApproval) }
    DisposableEffect(Unit) { onDispose { onDialogVisibilityChange(false) } }
    BackHandler { if (showRootApproval) showRootApproval = false else onBack() }
    CompositionLocalProvider(LocalBackdrop provides backdrop) {
        Box(Modifier.fillMaxSize()) {
            ChatWallpaper(Modifier.fillMaxSize().hazeSource(backdrop))
            Column(
                Modifier.fillMaxSize().safeDrawingPadding()
                    .padding(horizontal = margins.horizontal)
                    .padding(top = margins.top, bottom = margins.bottom),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                AksaraGlassSurface(Modifier.fillMaxWidth(), radius = 18.dp, blur = 8.dp) {
                    Row(Modifier.fillMaxWidth().padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        AksaraIcon("terminal", Modifier.size(34.dp))
                        Column(Modifier.weight(1f)) {
                            AksaraText("Aksara Linux", size = 16f, weight = 650,
                                family = AksaraTypography.heading)
                            AksaraText("ANDROID SHELL · LINUX USERLAND BELUM DIPASANG",
                                size = 9.5f, color = AksaraColors.muted)
                        }
                        AksaraText("‹", Modifier.clickable { onBack() }, size = 24f,
                            color = AksaraColors.gold)
                    }
                }
                AksaraGlassSurface(Modifier.fillMaxWidth(), radius = 14.dp, blur = 8.dp) {
                    Row(Modifier.fillMaxWidth().padding(9.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        AksaraText("SESSION 01", Modifier.weight(1f), size = 11f,
                            color = AksaraColors.gold)
                        AksaraText(if (rootMode) "ROOT REQUESTED" else "USER",
                            Modifier.clickable {
                                if (rootMode) rootMode = false else showRootApproval = true
                            }, size = 11f, color = if (rootMode) Color(0xFFFFA5A5)
                                else Color(0xFF91E2B0))
                    }
                }
                Box(Modifier.weight(1f).fillMaxWidth()
                    .background(Color(0xEF070B13))) {
                    if (history.isEmpty()) {
                        AksaraText(
                            "Aksara shell preview\nAndroid /system/bin/sh · aplikasi sandbox\n" +
                                "Linux distribution, PTY, apt/pkg dan full-screen programs belum tersedia.\n" +
                                "Taip perintah untuk menguji shell Android sedia ada.",
                            Modifier.padding(16.dp), size = 11.5f, line = 19f,
                            color = AksaraColors.muted)
                    } else {
                        LazyColumn(
                            state = scroll, modifier = Modifier.fillMaxSize().padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            itemsIndexed(history) { _, item ->
                                androidx.compose.material3.Text(
                                    text = item,
                                    style = TextStyle(
                                        fontFamily = FontFamily.Monospace,
                                        fontSize = 12.sp,
                                        lineHeight = 18.sp,
                                        color = Color(0xFFD8E4F2)
                                    )
                                )
                            }
                        }
                    }
                }
                AksaraGlassSurface(Modifier.fillMaxWidth(), radius = 14.dp, blur = 8.dp) {
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        AksaraText(if (rootMode) "#" else "$", size = 16f,
                            color = AksaraColors.gold)
                        BasicTextField(
                            value = input, onValueChange = { input = it },
                            modifier = Modifier.weight(1f),
                            singleLine = true,
                            textStyle = TextStyle(
                                fontFamily = FontFamily.Monospace,
                                fontSize = 13.sp,
                                color = Color.White
                            ),
                            cursorBrush = SolidColor(AksaraColors.gold),
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                            keyboardActions = KeyboardActions(onSend = { submit(input) }),
                            decorationBox = { inner ->
                                Box {
                                    if (input.isEmpty()) AksaraText("Masukkan arahan...",
                                        size = 12f, color = AksaraColors.muted)
                                    inner()
                                }
                            }
                        )
                        AksaraText(if (busy) "..." else "RUN",
                            Modifier.clickable(enabled = !busy) { submit(input) },
                            size = 12f, color = AksaraColors.gold)
                    }
                }
            }
            if (showRootApproval) {
                Dialog(onDismissRequest = { showRootApproval = false }) {
                    AksaraGlassSurface(Modifier.fillMaxWidth(), radius = 20.dp, blur = 8.dp) {
                        Column(Modifier.padding(20.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            AksaraText("Buka sesi ROOT?", size = 17f, weight = 650)
                            AksaraText(
                                "Ini memanggil su sebenar dan mungkin memaparkan permintaan " +
                                    "kelulusan pengurus root telefon. Tidak tersedia pada peranti " +
                                    "tanpa root. Arahan root boleh mengubah atau merosakkan sistem.",
                                size = 12f, line = 19f, color = AksaraColors.muted
                            )
                            AksaraButton("Batal", { showRootApproval = false },
                                Modifier.fillMaxWidth())
                            AksaraButton("Saya faham · Cuba ROOT", {
                                rootMode = true
                                showRootApproval = false
                            }, Modifier.fillMaxWidth())
                        }
                    }
                }
            }
        }
    }
}
