package my.aksara.nativeapp.core.linux

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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
 * Aksara Linux shell V1: native PTY, persistent session processes, ANSI/VT
 * emulator, multi-tab keyboard. Linux is labeled ready only after its
 * Alpine rootfs is installed; physical-device behavior still requires QA.
 *
 * The dark opaque terminal viewport is intentional for legible ANSI output.
 */
@Composable
fun AksaraLinuxScreen(
    onBack: () -> Unit,
    onDialogVisibilityChange: (Boolean) -> Unit,
    vm: AksaraLinuxViewModel = viewModel()
) {
    val backdrop = remember { HazeState() }
    val margins = aksaraDeviceMargins()
    val keys = listOf("ESC", "CTRL", "ALT", "TAB", "←", "↓", "↑", "→", "HOME", "END")
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
                AksaraGlassSurface(Modifier.fillMaxWidth(), radius = 18.dp, blur = 8.dp) {
                    Row(Modifier.fillMaxWidth().padding(horizontal = 13.dp, vertical = 11.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        AksaraIcon("terminal", Modifier.size(31.dp))
                        Column(Modifier.weight(1f)) {
                            AksaraText("Aksara Linux", size = 16f, weight = 650,
                                family = AksaraTypography.heading)
                            AksaraText(
                                if (vm.installed) "ALPINE " + AksaraLinuxRuntime.alpineVersion + " · PROOT · PTY"
                                else if (vm.bundled) "PTY · ALPINE BOOTSTRAP AVAILABLE"
                                else "PTY · ANDROID SHELL",
                                size = 10f, color = AksaraColors.muted
                            )
                        }
                        AksaraText("A−", Modifier.clickable { vm.resizeFont(-1) },
                            size = 13f, color = AksaraColors.gold)
                        AksaraText("A+", Modifier.clickable { vm.resizeFont(1) },
                            size = 13f, color = AksaraColors.gold)
                        AksaraText("‹", Modifier.clickable { onBack() },
                            size = 24f, color = AksaraColors.gold)
                    }
                }
                AksaraGlassSurface(Modifier.fillMaxWidth(), radius = 14.dp, blur = 8.dp) {
                    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())
                        .padding(horizontal = 9.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(9.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        vm.slots.forEachIndexed { index, slot ->
                            Row(
                                Modifier
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (vm.selected == index)
                                        Color(0x493E5A73) else Color(0x191C2938))
                                    .clickable { vm.selectSession(index) }
                                    .padding(horizontal = 10.dp, vertical = 8.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                AksaraText(slot.name, size = 11f,
                                    color = if (vm.selected == index) AksaraColors.gold
                                        else AksaraColors.muted)
                                if (slot.ended) AksaraText("●", size = 9f, color = Color(0xFFE7A69C))
                                AksaraText("×", Modifier.clickable { vm.closeSession(index) },
                                    size = 13f, color = AksaraColors.muted)
                            }
                        }
                        if (vm.slots.size < 6) {
                            AksaraText("+", Modifier.testTag("linux-add-session")
                                .clickable { vm.addSession() }
                                .padding(horizontal = 8.dp), size = 20f,
                                color = AksaraColors.gold)
                        }
                    }
                }
                if (!vm.installed && vm.bundled) {
                    AksaraButton(
                        if (vm.installing) "Memasang Alpine..." else "Pasang Alpine Linux",
                        { vm.installAlpine() },
                        Modifier.fillMaxWidth(),
                        enabled = !vm.installing
                    )
                }
                Box(
                    Modifier.fillMaxWidth().weight(1f)
                        .clip(RoundedCornerShape(15.dp))
                        .background(Color(0xF5080B12))
                        .testTag("linux-terminal-pty")
                ) {
                    AndroidView(
                        factory = { context ->
                            TerminalView(context, null).apply {
                                isFocusable = true
                                isFocusableInTouchMode = true
                                setBackgroundColor(android.graphics.Color.rgb(8, 11, 18))
                                setTextSize(vm.fontSize)
                                vm.attach(this)
                            }
                        },
                        update = { terminal -> vm.attach(terminal) },
                        onRelease = { terminal -> vm.detach(terminal) },
                        modifier = Modifier.fillMaxSize()
                    )
                }
                AksaraGlassSurface(Modifier.fillMaxWidth(), radius = 13.dp, blur = 8.dp) {
                    Row(
                        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())
                            .padding(7.dp),
                        horizontalArrangement = Arrangement.spacedBy(5.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        keys.forEach { key ->
                            val engaged = (key == "CTRL" && vm.ctrlDown) ||
                                (key == "ALT" && vm.altDown)
                            Box(
                                Modifier.clip(RoundedCornerShape(8.dp))
                                    .background(if (engaged) Color(0x665D482B)
                                        else Color(0x27334454))
                                    .clickable { vm.extraKey(key) }
                                    .padding(horizontal = 12.dp, vertical = 9.dp)
                            ) {
                                AksaraText(key, size = 11f,
                                    color = if (engaged) AksaraColors.gold
                                        else Color(0xFFE1E8F0))
                            }
                        }
                    }
                }
                Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically) {
                    AksaraText(
                        (if (vm.installed) "ALPINE · " else "ANDROID · ") +
                            "PTY · USER · " + vm.slots.size + " SESSION",
                        size = 9.5f, color = AksaraColors.muted
                    )
                    AksaraText("PASTE", Modifier.clickable { vm.paste() },
                        size = 10f, color = AksaraColors.gold)
                }
                vm.installStatus?.let {
                    AksaraText(it, size = 10f, color = AksaraColors.muted)
                }
                vm.problem?.let {
                    AksaraText(it, size = 11f, color = Color(0xFFFFABAB))
                }
            }
        }
    }
}
