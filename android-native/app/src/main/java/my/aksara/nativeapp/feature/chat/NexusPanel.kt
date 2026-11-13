package my.aksara.nativeapp.feature.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.chrisbanes.haze.HazeState
import my.aksara.nativeapp.core.design.*
import my.aksara.nativeapp.core.nexus.NexusEngine
import my.aksara.nativeapp.core.nexus.NexusTaskStatus

/**
 * ANK is an app-level kernel, not a fourth command terminal.
 * This overlay is entirely read-only. Chat owns goals and approval; Linux owns PTY.
 */
@Composable
internal fun NexusLauncher(onClick: () -> Unit) {
    val shape = RoundedCornerShape(topStart = 14.dp, bottomStart = 14.dp)
    Box(
        Modifier.width(37.dp).height(52.dp).clip(shape)
            .background(Brush.linearGradient(listOf(Color(0xCB14253B), Color(0xBB4B372B))))
            .border(1.dp, Color(0x77E9C989), shape)
            .clickable(onClick = onClick)
            .semantics { contentDescription = "Nexus Kernel: status Today, A.I. dan Linux" },
        contentAlignment = Alignment.Center
    ) {
        AksaraIcon("network", Modifier.size(21.dp), AksaraColors.gold)
    }
}

@Composable
internal fun NexusPanel(onClose: () -> Unit) {
    val current by NexusEngine.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { NexusEngine.refreshLinux() }

    Dialog(onDismissRequest = onClose,
        properties = DialogProperties(usePlatformDefaultWidth = false)) {
        val haze = remember { HazeState() }
        CompositionLocalProvider(LocalBackdrop provides haze) {
            BoxWithConstraints(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                AksaraGlassSurface(
                    Modifier.fillMaxWidth(.93f).heightIn(max = maxHeight * .78f),
                    radius = 21.dp, blur = 12.dp, border = Color(0x77EACB94)
                ) {
                    Column(
                        Modifier.fillMaxWidth().verticalScroll(rememberScrollState())
                            .padding(horizontal = 17.dp, vertical = 15.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Row(Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                AksaraText("AKSARA NEXUS KERNEL", size = 16f,
                                    weight = 700, family = AksaraTypography.heading,
                                    color = AksaraColors.gold)
                                AksaraText("Application kernel · Status sahaja",
                                    size = 9.5f, color = AksaraColors.muted)
                            }
                            AksaraButton("Tutup", onClose, height = 33.dp, size = 10f)
                        }
                        AksaraGlassSurface(Modifier.fillMaxWidth(), radius = 15.dp, blur = 5.dp) {
                            Column(Modifier.fillMaxWidth().padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                AksaraText("CONNECTED SYSTEMS", size = 11f,
                                    weight = 700, color = AksaraColors.gold)
                                AksaraText("TODAY · " +
                                    if (current.dashboard.isBlank()) "Belum ada snapshot"
                                    else "Connected · Snapshot tersedia", size = 10.5f)
                                AksaraText("AKSARA A.I. · " + current.aiStatus.take(220),
                                    size = 10f, line = 16f, color = AksaraColors.muted)
                                AksaraText("LINUX · " +
                                    if (current.linuxReady) "Alpine PRoot Ready"
                                    else "Alpine belum tersedia",
                                    size = 10.5f)
                            }
                        }
                        AksaraGlassSurface(Modifier.fillMaxWidth(), radius = 15.dp, blur = 5.dp) {
                            Column(Modifier.fillMaxWidth().padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                AksaraText("KERNEL RUNTIME", size = 11f,
                                    weight = 700, color = AksaraColors.gold)
                                val status = when {
                                    current.activeId != null -> "RUNNING"
                                    current.lastStatus != null -> current.lastStatus!!.name
                                    else -> "IDLE · READY"
                                }
                                AksaraText("Status · " + status, size = 11f,
                                    color = if (current.lastStatus == NexusTaskStatus.FAILED)
                                        Color(0xFFE7A08E) else AksaraColors.text)
                                AksaraText("Tugas · " + current.activeTitle.ifBlank { "Tiada tugas aktif" },
                                    size = 10f, line = 15f, color = AksaraColors.muted)
                                if (current.progress.isNotBlank()) {
                                    AksaraText("Kemajuan · " + current.progress.take(240),
                                        size = 10f, line = 15f, color = AksaraColors.muted)
                                }
                                val telemetry = NexusEngine.kernelTelemetry()
                                AksaraText(
                                    "Runs " + telemetry.executions +
                                        " · OK " + telemetry.success +
                                        " · Failed " + telemetry.failures +
                                        " · Cancelled " + telemetry.cancellations,
                                    size = 10f, line = 15f, color = AksaraColors.muted)
                                AksaraText("Parallelism · " + telemetry.lastParallelism +
                                    " · Available RAM " + telemetry.lastAvailableRamMb + " MB",
                                    size = 10f, line = 15f, color = AksaraColors.muted)
                            }
                        }
                        AksaraText("RECENT TASKS", size = 11f,
                            weight = 700, color = AksaraColors.gold)
                        if (current.events.isEmpty()) {
                            AksaraText("Belum ada tugas Nexus.",
                                size = 10f, color = AksaraColors.muted)
                        } else {
                            current.events.take(5).forEach { event ->
                                Row(Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween) {
                                    AksaraText(event.title.take(45),
                                        Modifier.weight(1f), size = 10.5f, line = 15f)
                                    AksaraText(event.status.name,
                                        size = 9f, color = AksaraColors.muted)
                                }
                            }
                        }
                        AksaraText(
                            "Kernel berjalan di belakang tabir. Arahan dan kelulusan " +
                                "melalui Bilik Antara Chat; perintah interaktif terus di Linux.",
                            size = 9f, line = 15f, color = AksaraColors.muted)
                    }
                }
            }
        }
    }
}
