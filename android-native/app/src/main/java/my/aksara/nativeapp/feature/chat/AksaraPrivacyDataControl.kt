package my.aksara.nativeapp.feature.chat

import android.content.Intent
import android.provider.Settings
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import my.aksara.nativeapp.core.design.*

/**
 * Privacy transparency for the current account-free Android beta.
 * This screen deliberately makes no unverified claims about server retention,
 * provider training, or deletion at third-party services.
 */
@Composable
internal fun AksaraPrivacyDataControl(
    onBack: () -> Unit,
    onExport: () -> Unit,
    onErase: suspend () -> Boolean
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var confirmErase by remember { mutableStateOf(false) }
    var status by remember { mutableStateOf("") }

    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        AksaraButton("‹ Kembali ke Settings", onBack, Modifier.fillMaxWidth(), height = 38.dp)
        AksaraText("Privacy & Data Control", size = 16f, weight = 700)
        AksaraText(
            "Aksara belum memerlukan akaun pengguna. Tiada login diperlukan untuk menggunakan fungsi semasa. Data yang dihantar ke AI cloud tetap diproses di luar peranti.",
            size = 11f, line = 17f, color = AksaraColors.muted
        )
        AksaraText("Privacy Policy", size = 13f, weight = 650)
        AksaraText(
            "Dasar privasi awam masih dalam penyediaan. Pautan rasmi hanya akan dipaparkan selepas aliran data, tempoh simpanan dan hubungan penyedia disahkan.",
            size = 11f, line = 17f, color = AksaraColors.muted
        )
        AksaraText("Chat, History & Memory", size = 13f, weight = 650)
        AksaraText(
            "Sesi, draf dan nota memori setempat boleh dieksport atau dipadam. Memadam data setempat tidak memadam data yang pernah dihantar kepada penyedia AI.",
            size = 11f, line = 17f, color = AksaraColors.muted
        )
        AksaraButton("Eksport arkib sesi", onExport, Modifier.fillMaxWidth(), height = 38.dp)
        AksaraText("Voice & AI Data", size = 13f, weight = 650)
        AksaraText(
            "Apabila Voice digunakan, audio diproses melalui perkhidmatan AI yang disambungkan. Chat dan prompt imej juga boleh dihantar ke penyedia cloud. Jangan masukkan data sensitif yang tidak perlu.",
            size = 11f, line = 17f, color = AksaraColors.muted
        )
        AksaraText("Location & Permissions", size = 13f, weight = 650)
        AksaraText(
            "Kebenaran mikrofon, lokasi dan notifikasi diurus oleh Android. Semak atau batalkan kebenaran melalui tetapan sistem.",
            size = 11f, line = 17f, color = AksaraColors.muted
        )
        AksaraButton("Buka kebenaran Android", {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = android.net.Uri.parse("package:" + context.packageName)
            }
            context.startActivity(intent)
        }, Modifier.fillMaxWidth(), height = 38.dp)
        AksaraText("Third-Party Providers", size = 13f, weight = 650)
        AksaraText(
            "Integrasi yang digunakan boleh merangkumi Gemini, Groq, OpenRouter, Cloudflare Workers AI dan backend Netlify, mengikut routing serta fungsi aktif. Polisi penyimpanan dan pemadaman setiap penyedia masih perlu diaudit.",
            size = 11f, line = 17f, color = AksaraColors.muted
        )
        AksaraText("Delete My Data", size = 13f, weight = 650)
        AksaraText(
            "Tindakan ini memadam data Chat setempat melalui mekanisme aplikasi sedia ada. Data Studio, fail penyedia luar dan rekod server tidak termasuk. Eksport dahulu jika perlu.",
            size = 11f, line = 17f, color = AksaraColors.muted
        )
        if (!confirmErase) {
            AksaraButton("Semak pemadaman setempat", { confirmErase = true },
                Modifier.fillMaxWidth(), height = 38.dp)
        } else {
            AksaraText("Pengesahan: pemadaman data Chat setempat tidak boleh dibuat asal.",
                size = 11f, color = AksaraColors.muted)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                AksaraButton("Batal", { confirmErase = false },
                    Modifier.weight(1f), height = 38.dp)
                AksaraButton("Padam data", {
                    confirmErase = false
                    scope.launch {
                        status = if (onErase()) "Data Chat setempat dipadam."
                        else "Pemadaman tidak lengkap. Semak semula."
                    }
                }, Modifier.weight(1f), height = 38.dp)
            }
        }
        if (status.isNotBlank()) AksaraText(status, size = 11f, color = AksaraColors.gold)
        Spacer(Modifier.height(12.dp))
    }
}
