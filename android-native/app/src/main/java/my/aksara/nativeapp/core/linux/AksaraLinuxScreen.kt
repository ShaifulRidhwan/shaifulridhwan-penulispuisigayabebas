package my.aksara.nativeapp.core.linux

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.viewmodel.compose.viewModel
import com.termux.view.TerminalView
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.hazeSource
import my.aksara.nativeapp.core.design.*
import my.aksara.nativeapp.feature.chat.ChatWallpaper

/**
 * Linux V2 Control Deck: branded glass chrome around a real, opaque native PTY.
 * Compose never parses terminal output or emulates shell commands.
 */
@Composable
fun AksaraLinuxScreen(
    onBack: () -> Unit,
    onDialogVisibilityChange: (Boolean) -> Unit,
    vm: AksaraLinuxViewModel = viewModel()
) {
    val backdrop = remember { HazeState() }
    val margins = aksaraDeviceMargins()
    val current = vm.slots.getOrNull(vm.selected)
    var deck by rememberSaveable { mutableStateOf("keys") }
    var commandCategory by rememberSaveable { mutableStateOf("FILES") }
    BackHandler { onBack() }
    DisposableEffect(Unit) {
        onDialogVisibilityChange(false)
        onDispose { onDialogVisibilityChange(false) }
    }
    CompositionLocalProvider(LocalBackdrop provides backdrop) {
        Box(Modifier.fillMaxSize()) {
            ChatWallpaper(Modifier.fillMaxSize().hazeSource(backdrop))
            Column(
                Modifier.fillMaxSize().safeDrawingPadding()
                    .padding(horizontal = margins.horizontal)
                    .padding(top = margins.top, bottom = margins.bottom),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                AksaraGlassSurface(Modifier.fillMaxWidth(), radius = 20.dp, blur = 9.dp) {
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 13.dp, vertical = 11.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Box(
                            Modifier.size(43.dp).clip(RoundedCornerShape(14.dp))
                                .background(Brush.linearGradient(listOf(Color(0x664D7091), Color(0x345C4329))))
                                .border(1.dp, Color(0x66E6C58B), RoundedCornerShape(14.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            AksaraIcon("terminal", Modifier.size(26.dp))
                        }
                        Column(Modifier.weight(1f)) {
                            AksaraText("AKSARA / LINUX", size = 15.5f, weight = 700,
                                family = AksaraTypography.heading, tracking = .6f)
                            AksaraText(
                                if (vm.installed) "ALPINE ${AksaraLinuxRuntime.alpineVersion} · ARM64 · PROOT"
                                else if (vm.bundled) "ARM64 · ALPINE READY TO INSTALL"
                                else "ANDROID SHELL · NATIVE PTY",
                                size = 9.3f, color = AksaraColors.muted
                            )
                        }
                        LinuxRuntimePulse(current != null && !current.ended)
                        Column(horizontalAlignment = Alignment.End) {
                            AksaraText(if (current?.ended == true) "STOPPED" else "LIVE PTY",
                                size = 9.5f, weight = 650,
                                color = if (current?.ended == true) LinuxDeckRose else LinuxDeckMint)
                            AksaraText("ROOTLESS", size = 8.7f, color = AksaraColors.muted)
                        }
                    }
                }

                // Three equal-width facts stay readable without horizontal status scrolling.
                AksaraGlassSurface(Modifier.fillMaxWidth(), radius = 15.dp, blur = 7.dp) {
                    Row(Modifier.fillMaxWidth().padding(6.dp),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        LinuxDeckStat("RUNTIME", if (vm.installed) "ALPINE" else "ANDROID",
                            LinuxDeckBlue, Modifier.weight(1f))
                        LinuxDeckStat("SESSIONS", "${vm.slots.count { !it.ended }}/${vm.slots.size} LIVE",
                            AksaraColors.gold, Modifier.weight(1f))
                        LinuxDeckStat("STORAGE", if (vm.installed) "/workspace" else "PRIVATE",
                            LinuxDeckMint, Modifier.weight(1f))
                    }
                }

                AksaraGlassSurface(Modifier.fillMaxWidth(), radius = 16.dp, blur = 8.dp) {
                    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())
                        .padding(horizontal = 8.dp, vertical = 7.dp),
                        horizontalArrangement = Arrangement.spacedBy(7.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        vm.slots.forEachIndexed { index, slot ->
                            val active = vm.selected == index
                            Row(
                                Modifier.clip(RoundedCornerShape(11.dp))
                                    .background(if (active) Color(0x66406179) else Color(0x20253443))
                                    .border(1.dp, if (active) Color(0x77E6C58B) else Color(0x263F566A),
                                        RoundedCornerShape(11.dp))
                                    .clickable { vm.selectSession(index) }
                                    .padding(start = 11.dp, end = 7.dp, top = 8.dp, bottom = 8.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(Modifier.size(6.dp).clip(CircleShape)
                                    .background(if (slot.ended) LinuxDeckRose
                                        else if (active) LinuxDeckMint else AksaraColors.muted))
                                AksaraText(slot.name, size = 11f,
                                    color = if (active) AksaraColors.text else AksaraColors.muted)
                                AksaraText("×",
                                    Modifier.testTag("linux-close-session-$index")
                                        .clickable { vm.closeSession(index) }
                                        .padding(horizontal = 3.dp),
                                    size = 15f, color = AksaraColors.gold)
                            }
                        }
                        if (vm.slots.size < 6 && !vm.installing) {
                            Box(Modifier.size(33.dp).clip(RoundedCornerShape(10.dp))
                                .border(1.dp, Color(0x77E6C58B), RoundedCornerShape(10.dp))
                                .clickable { vm.addSession() }.testTag("linux-add-session"),
                                contentAlignment = Alignment.Center) {
                                AksaraText("+", size = 19f, weight = 600, color = AksaraColors.gold)
                            }
                        }
                    }
                }

                if (current?.ended == true) {
                    AksaraButton(if (vm.restarting) "Memulakan sesi..." else "Sesi terhenti · Mulakan semula",
                        { vm.restartSession() }, Modifier.fillMaxWidth().testTag("linux-restart-session"),
                        icon = "terminal", enabled = !vm.restarting)
                }
                if (!vm.installed && vm.bundled) {
                    AksaraButton(if (vm.installing) "Memasang Alpine..." else "Pasang Alpine Linux",
                        { vm.installAlpine() }, Modifier.fillMaxWidth(),
                        enabled = !vm.installing, icon = "terminal")
                }

                // The PTY receives the remaining viewport height after IME reflow.
                // No expensive backdrop blur is applied to live terminal glyphs.
                Column(
                    Modifier.fillMaxWidth().weight(1f)
                        .clip(RoundedCornerShape(19.dp))
                        .border(1.dp, Color(0x695C83A5), RoundedCornerShape(19.dp))
                        .background(Color(0xFC080C14))
                        .testTag("linux-terminal-pty")
                ) {
                    Row(
                        Modifier.fillMaxWidth()
                            .background(Brush.horizontalGradient(
                                listOf(Color(0x5534526D), Color(0x292B3548), Color(0x253D2A19))))
                            .padding(horizontal = 11.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        AksaraText("●", size = 7f, color = LinuxDeckMint)
                        AksaraText(if (vm.installed) "aksara · alpine · /workspace" else "aksara · android shell",
                            Modifier.weight(1f), size = 10f, color = AksaraColors.muted)
                        AksaraText("A−", Modifier.clickable { vm.resizeFont(-1) }.padding(horizontal = 5.dp),
                            size = 11f, color = AksaraColors.gold)
                        AksaraText("A+", Modifier.clickable { vm.resizeFont(1) }.padding(horizontal = 5.dp),
                            size = 11f, color = AksaraColors.gold)
                        AksaraText("${vm.fontSize}sp", size = 9f, color = AksaraColors.muted)
                    }
                    AndroidView(
                        factory = { context ->
                            TerminalView(context, null).apply {
                                isFocusable = true
                                isFocusableInTouchMode = true
                                setBackgroundColor(android.graphics.Color.rgb(8, 12, 20))
                                setTextSize(vm.fontSize)
                                vm.attach(this)
                            }
                        },
                        update = { terminal -> vm.attach(terminal) },
                        onRelease = { terminal -> vm.detach(terminal) },
                        modifier = Modifier.fillMaxSize()
                    )
                }

                AksaraGlassSurface(Modifier.fillMaxWidth(), radius = 16.dp, blur = 8.dp) {
                    Column(Modifier.fillMaxWidth().padding(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            verticalAlignment = Alignment.CenterVertically) {
                            LinuxDeckSwitch("KEYBOARD", deck == "keys", Modifier.weight(1f)) { deck = "keys" }
                            LinuxDeckSwitch("COMMANDS", deck == "commands", Modifier.weight(1f)) { deck = "commands" }
                            LinuxDeckSwitch("SYSTEM", deck == "system", Modifier.weight(1f)) { deck = "system" }
                            AksaraText("PASTE", Modifier.clickable { vm.paste() }
                                .padding(horizontal = 6.dp, vertical = 8.dp),
                                size = 10f, weight = 650, color = AksaraColors.gold)
                        }
                        when (deck) {
                            "keys" -> Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                                horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                                listOf("ESC", "CTRL", "ALT", "TAB", "ENTER", "←", "↓", "↑", "→",
                                    "HOME", "END", "PGUP", "PGDN", "DEL").forEach { key ->
                                    LinuxDeckKey(key, (key == "CTRL" && vm.ctrlDown) ||
                                        (key == "ALT" && vm.altDown)) { vm.extraKey(key) }
                                }
                            }
                            "commands" -> {
                                // Category picker and actions are only recomposed when this
                                // mode is visible. No shell reads, polling or automatic writes.
                                val categories = LinuxQuickCommands.categories(vm.installed)
                                val selectedCategory = categories.firstOrNull {
                                    it.name == commandCategory
                                } ?: categories.first()
                                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    categories.forEach { category ->
                                        LinuxDeckCommandCategory(
                                            category.label, category.icon,
                                            category == selectedCategory
                                        ) { commandCategory = category.name }
                                    }
                                }
                                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    LinuxQuickCommands.forRuntime(vm.installed, selectedCategory)
                                        .forEach { action ->
                                            LinuxDeckCommandAction(action) {
                                                vm.runQuickCommand(action.id)
                                            }
                                        }
                                }
                            }
                            else -> {
                                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                                    horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                                    LinuxDeckStat("USERLAND", if (vm.installed) "ALPINE" else "NOT INSTALLED", LinuxDeckBlue)
                                    LinuxDeckStat("ISOLATION", "PROOT · NO ROOT", AksaraColors.gold)
                                    LinuxDeckStat("STORAGE", "APP PRIVATE", LinuxDeckMint)
                                }
                                AksaraText("Fail /workspace disimpan dalam storan aplikasi. Proses PTY tidak dijamin selepas app dimatikan.",
                                    size = 9.2f, color = AksaraColors.muted)
                            }
                        }
                    }
                }
                vm.problem?.let { AksaraText(it, size = 11f, color = LinuxDeckRose) }
            }
        }
    }
}

private val LinuxDeckMint = Color(0xFF8CE2CC)
private val LinuxDeckBlue = Color(0xFFA7D2FF)
private val LinuxDeckRose = Color(0xFFFFA9A9)

@Composable private fun LinuxRuntimePulse(running: Boolean) {
    val alpha by rememberInfiniteTransition(label = "linux-pty-live").animateFloat(
        initialValue = .42f, targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(1300), RepeatMode.Reverse),
        label = "live-alpha"
    )
    Box(Modifier.size(8.dp).clip(CircleShape)
        .background((if (running) LinuxDeckMint else LinuxDeckRose)
            .copy(alpha = if (running) alpha else 1f)))
}

@Composable private fun LinuxDeckStat(
    name: String, value: String, accent: Color, modifier: Modifier = Modifier
) {
    Column(modifier.clip(RoundedCornerShape(10.dp))
        .background(Color(0x3C1B2D40))
        .border(1.dp, Color(0x456D87A2), RoundedCornerShape(10.dp))
        .padding(horizontal = 10.dp, vertical = 7.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp)) {
        AksaraText(name, size = 9.4f, line = 12f, weight = 600, color = AksaraColors.muted)
        AksaraText(value, size = 12f, line = 16f, weight = 700,
            family = AksaraTypography.heading, color = accent)
    }
}

@Composable private fun LinuxDeckCommandCategory(
    label: String, icon: String, active: Boolean, onClick: () -> Unit
) {
    Row(Modifier.clip(RoundedCornerShape(10.dp))
        .background(if (active) Color(0x63597893) else Color(0x25304053))
        .border(1.dp, if (active) Color(0x82E6C58B) else Color(0x385E7388),
            RoundedCornerShape(10.dp))
        .clickable(onClick = onClick)
        .padding(horizontal = 10.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically) {
        AksaraIcon(icon, Modifier.size(14.dp),
            if (active) AksaraColors.gold else AksaraColors.muted)
        AksaraText(label, size = 9.5f, weight = if (active) 700 else 500,
            color = if (active) AksaraColors.gold else AksaraColors.text)
    }
}

@Composable private fun LinuxDeckCommandAction(
    action: LinuxQuickCommands.Action, onClick: () -> Unit
) {
    Row(Modifier.clip(RoundedCornerShape(10.dp))
        .background(Color(0x3830455C))
        .border(1.dp, Color(0x466C88A2), RoundedCornerShape(10.dp))
        .clickable(onClick = onClick)
        .padding(horizontal = 11.dp, vertical = 9.dp),
        horizontalArrangement = Arrangement.spacedBy(7.dp),
        verticalAlignment = Alignment.CenterVertically) {
        AksaraIcon(action.icon, Modifier.size(16.dp), AksaraColors.gold)
        AksaraText(action.label, size = 10f, weight = 600)
    }
}

@Composable private fun LinuxDeckSwitch(label: String, active: Boolean, modifier: Modifier, onClick: () -> Unit) {
    Box(modifier.clip(RoundedCornerShape(9.dp))
        .background(if (active) Color(0x665A728B) else Color(0x1E293748))
        .border(1.dp, if (active) Color(0x6CE6C58B) else Color(0x163F596F),
            RoundedCornerShape(9.dp))
        .clickable(onClick = onClick).padding(vertical = 7.dp), contentAlignment = Alignment.Center) {
        AksaraText(label, size = 9f, weight = if (active) 700 else 500,
            color = if (active) AksaraColors.gold else AksaraColors.muted)
    }
}

@Composable private fun LinuxDeckKey(label: String, active: Boolean, onClick: () -> Unit) {
    Box(Modifier.clip(RoundedCornerShape(10.dp))
        .background(if (active) Color(0x775A482B) else Color(0x33354C60))
        .border(1.dp, if (active) Color(0x93E6C58B) else Color(0x315C7794),
            RoundedCornerShape(10.dp))
        .clickable(onClick = onClick)
        .padding(horizontal = 12.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center) {
        AksaraText(label, size = 10f, weight = 600,
            color = if (active) AksaraColors.gold else AksaraColors.text)
    }
}
