package my.aksara.nativeapp.core.neural

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Isolated preview surface. Navigation integration and actual inference are pending.
 * Never present placeholder metrics as live measurements.
 */
@Composable
fun AksaraNeuralDashboard(
    snapshot: NeuralDeviceSnapshot?,
    modelLoaded: Boolean,
    onOpenDetails: (String) -> Unit = {}
) {
    var selectedTier by remember { mutableStateOf<NeuralTier?>(null) }
    val panels = listOf(
        "Neural Core" to (if (modelLoaded) "Model loaded" else "Runtime not connected"),
        "Device Intelligence" to (snapshot?.let { "RAM: ${it.totalRamBytes / 1_073_741_824L} GB • Available: ${it.availableRamBytes / 1_048_576L} MB" } ?: "Not measured"),
        "Live Inference" to "Not running",
        "Model Library" to "Verified local imports",
        "Neural Laboratory" to "Benchmark suite prepared",
        "Knowledge & Reasoning" to "Integration pending"
    )
    Column(
        modifier = Modifier.fillMaxSize().background(Color(0xFF080C17)).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("AKSARA NEURAL", color = Color(0xFFE9C67A), fontSize = 23.sp, fontWeight = FontWeight.Bold)
        Text("On-device intelligence • Experimental", color = Color(0xFFBBC5D8), fontSize = 12.sp)
        panels.chunked(2).forEach { pair ->
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.weight(1f)) {
                pair.forEach { (title, detail) ->
                    Column(
                        modifier = Modifier.weight(1f).fillMaxSize()
                            .background(Color(0x99202C42), RoundedCornerShape(20.dp))
                            .padding(14.dp),
                        verticalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(title, color = Color(0xFFF5F6FA), fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        Text(detail, color = Color(0xFFB7C7DC), fontSize = 12.sp)
                    }
                }
            }
        }
        TextButton(onClick = { selectedTier = NeuralTier.LIGHT }) {
            Text("Model Library • Pilih model", color = Color(0xFFE9C67A))
        }
        selectedTier?.let { tier ->
            androidx.compose.material3.AlertDialog(
                onDismissRequest = { selectedTier = null },
                title = { Text("Model Library") },
                text = {
                    Column {
                        NeuralModelCatalog.entries.forEach { entry ->
                            TextButton(onClick = { selectedTier = entry.tier }) {
                                Text(entry.tier.label + if (entry.tier == tier) " ✓" else "")
                            }
                        }
                        Text(tier.description)
                        Text("Panduan RAM: " + tier.ramGuidanceGb + "GB atau lebih")
                        Text("Muat turun belum tersedia: sumber model dan runtime perlu disahkan.")
                    }
                },
                confirmButton = { TextButton(onClick = { selectedTier = null }) { Text("Tutup") } }
            )
        }
    }
}

@Composable
fun AksaraNeuralDetails(title: String, lines: List<String>) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().background(Color(0xFF080C17)),
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item { Text(title, color = Color(0xFFE9C67A), fontSize = 22.sp) }
        items(lines) { line -> Text(line, color = Color.White, fontSize = 14.sp) }
    }
}
