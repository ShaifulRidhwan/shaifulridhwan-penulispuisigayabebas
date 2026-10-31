package my.aksara.ai.ui

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner

private val VoiceIce = Color(0xFFEAC17C)
private val VoiceViolet = Color(0xFFFFDCA0)
private val VoiceWhite = Color(0xFFF1F4FF)
private val VoiceMuted = Color(0xFFDDD0B8)

@Composable
fun AksaraVoiceScreen(vm: AksaraViewModel, modifier: Modifier = Modifier, openChat: () -> Unit) {
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val services = remember(context) { AndroidVoiceServices(context.applicationContext) }
    var listening by remember { mutableStateOf(false) }
    var partial by remember { mutableStateOf("") }
    var caption by remember { mutableStateOf("Tekan mikrofon untuk bercakap dengan Aksara.") }
    var speakerReady by remember { mutableStateOf(false) }
    var speakerInfo by remember { mutableStateOf("Memeriksa suara bacaan Android…") }
    var speakerEnabled by rememberSaveable { mutableStateOf(true) }
    var pendingUserId by remember { mutableStateOf<String?>(null) }
    var pendingSessionId by remember { mutableStateOf<String?>(null) }
    var currentSpeech by remember { mutableStateOf("") }
    var speaking by remember { mutableStateOf(false) }

    DisposableEffect(services, lifecycle) {
        services.initializeSpeaker { ready, message ->
            speakerReady = ready
            speakerInfo = message
        }
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_STOP) {
                services.cancelListening()
                services.stopSpeaking()
                listening = false
                speaking = false
                caption = "Mikrofon dimatikan semasa aplikasi di latar."
            }
        }
        lifecycle.addObserver(observer)
        onDispose {
            lifecycle.removeObserver(observer)
            services.close()
        }
    }

    LaunchedEffect(vm.activeId) {
        services.cancelListening()
        services.stopSpeaking()
        listening = false
        speaking = false
        pendingUserId = null
        pendingSessionId = null
    }

    fun recordVoice() {
        if (vm.busy || listening) return
        partial = ""
        speaking = false
        services.listen(
            onStage = { status, active ->
                caption = status
                listening = active
            },
            onPartial = { partial = it },
            onFinal = { transcript ->
                currentSpeech = transcript
                partial = transcript
                val sent = vm.send(transcript)
                if (sent) {
                    pendingUserId = vm.messages.lastOrNull { it.role == "user" }?.id
                    pendingSessionId = vm.activeId
                    caption = "Soalan dihantar. Aksara sedang menjawab…"
                } else caption = "Aksara belum sedia menerima soalan."
            },
            onError = {
                caption = it
                listening = false
            }
        )
    }
    val permissionRequest = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) recordVoice()
        else caption = "Akses mikrofon ditolak. Buka Tetapan Android untuk membenarkannya."
    }

    LaunchedEffect(
        vm.busy, vm.messages.lastOrNull()?.id,
        vm.messages.lastOrNull()?.complete, vm.activeId
    ) {
        val waitingFor = pendingUserId
        if (waitingFor != null && !vm.busy) {
            val userPosition = vm.messages.indexOfLast { it.id == waitingFor }
            val finalAnswer = if (userPosition >= 0 && vm.activeId == pendingSessionId) {
                vm.messages.drop(userPosition + 1)
                    .lastOrNull { it.role == "assistant" && it.complete }
            } else null
            pendingUserId = null
            pendingSessionId = null
            if (finalAnswer != null) {
                caption = "Jawapan Aksara diterima."
                if (speakerEnabled && speakerReady) {
                    speaking = services.speak(finalAnswer.content) {
                        speaking = false
                        caption = "Selesai dibacakan. Tekan mikrofon untuk soalan seterusnya."
                    }
                    if (speaking) caption = "Aksara sedang membacakan jawapan…"
                }
            } else if (vm.error != null) {
                caption = vm.error ?: "Jawapan belum lengkap."
            }
        }
    }

    val latestAssistant = vm.messages.lastOrNull { it.role == "assistant" }
    val orb by rememberInfiniteTransition(label = "voice-orb").animateFloat(
        initialValue = 0.96f,
        targetValue = 1.055f,
        animationSpec = infiniteRepeatable(tween(1600), RepeatMode.Reverse),
        label = "voice-pulse"
    )

    Column(
        modifier = modifier.fillMaxSize().padding(horizontal = 20.dp, vertical = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("VOICE · AKSARA", color = VoiceWhite, fontSize = 20.sp,
            fontWeight = FontWeight.Bold, letterSpacing = 1.4.sp)
        Text(
            "Perbualan suara native, giliran demi giliran",
            color = VoiceMuted, style = MaterialTheme.typography.bodySmall
        )
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            FilterChip(
                selected = vm.mode == "cahaya",
                enabled = !vm.busy && !listening,
                onClick = { vm.selectMode("cahaya") },
                label = { Text("CAHAYA") }
            )
            FilterChip(
                selected = vm.mode == "gelap",
                enabled = !vm.busy && !listening,
                onClick = { vm.selectMode("gelap") },
                label = { Text("GELAP") }
            )
        }
        Spacer(Modifier.height(6.dp))
        Box(
            modifier = Modifier.size(125.dp)
                .graphicsLayer {
                    scaleX = if (listening || speaking) orb else 1f
                    scaleY = if (listening || speaking) orb else 1f
                }
                .clip(CircleShape)
                .background(
                    Brush.radialGradient(
                        if (listening) listOf(
                            Color(0xFFDAA3FF), Color(0xFF57468D), Color(0xFF161A3E)
                        ) else listOf(
                            Color(0xFF8DB3FF), Color(0xFF43589C), Color(0xFF151A35)
                        )
                    )
                )
                .border(1.dp, if (listening) VoiceViolet else VoiceIce, CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Text(if (listening) "◉" else if (speaking) "◖))" else "A",
                fontSize = 47.sp, color = VoiceWhite, fontWeight = FontWeight.Light)
        }
        Text(
            caption, color = if (listening) VoiceViolet else VoiceIce,
            textAlign = TextAlign.Center, style = MaterialTheme.typography.bodyMedium
        )
        if (vm.busy) Text(
            vm.status, color = VoiceMuted, fontSize = 12.sp, textAlign = TextAlign.Center
        )
        AksaraGlassPanel(
            modifier = Modifier.fillMaxWidth().weight(1f),
            shape = RoundedCornerShape(20.dp),
            blurRadius = 14.dp,
            tint = Color(0x54111620),
            border = Color(0x7CEAC17C)
        ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(15.dp),
            verticalArrangement = Arrangement.spacedBy(13.dp)
        ) {
            Text("SOALAN KAU", color = VoiceIce, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            Text(
                partial.ifBlank { currentSpeech.ifBlank { "Mikrofon belum diaktifkan." } },
                color = VoiceWhite,
                style = MaterialTheme.typography.bodyLarge, maxLines = 5
            )
            Spacer(Modifier.height(4.dp))
            Text("JAWAPAN AKSARA", color = VoiceViolet,
                fontSize = 11.sp, fontWeight = FontWeight.Bold)
            Text(
                latestAssistant?.content?.let {
                    VoiceSpokenText.clean(it).take(720)
                }?.ifBlank { "Belum ada jawapan." } ?: "Belum ada jawapan.",
                color = VoiceWhite, style = MaterialTheme.typography.bodyMedium,
                maxLines = 9
            )
        }
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Button(
                modifier = Modifier.weight(1f),
                enabled = !vm.busy || listening,
                onClick = {
                    when {
                        listening -> {
                            services.cancelListening()
                            listening = false
                            caption = "Mikrofon dimatikan."
                        }
                        vm.busy -> Unit
                        ContextCompat.checkSelfPermission(
                            context, Manifest.permission.RECORD_AUDIO
                        ) == PackageManager.PERMISSION_GRANTED -> recordVoice()
                        else -> permissionRequest.launch(Manifest.permission.RECORD_AUDIO)
                    }
                }
            ) { Text(if (listening) "Henti mikrofon" else "🎙 Bercakap") }
            OutlinedButton(
                enabled = speaking || (speakerReady &&
                    !latestAssistant?.content.isNullOrBlank()),
                onClick = {
                    if (speaking) {
                        services.stopSpeaking()
                        speaking = false
                        caption = "Bacaan suara dihentikan."
                    } else {
                        latestAssistant?.let {
                            speaking = services.speak(it.content) {
                                speaking = false
                                caption = "Bacaan selesai."
                            }
                            if (speaking) caption = "Aksara sedang membacakan jawapan…"
                        }
                    }
                }
            ) {
                Text(if (speaking) "Henti audio" else "Baca")
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            TextButton(
                onClick = {
                    speakerEnabled = !speakerEnabled
                    if (!speakerEnabled) {
                        services.stopSpeaking()
                        speaking = false
                    }
                }
            ) {
                Text(if (speakerEnabled) "Suara jawapan: ON" else "Suara jawapan: OFF",
                    color = VoiceIce, fontSize = 12.sp)
            }
            TextButton(onClick = {
                services.cancelListening()
                services.stopSpeaking()
                openChat()
            }) { Text("Buka Chat", color = VoiceIce, fontSize = 12.sp) }
        }
        Text(speakerInfo, color = VoiceMuted, fontSize = 10.sp,
            textAlign = TextAlign.Center)
        Text(
            "Pengecaman suara mungkin menggunakan perkhidmatan Android/penyedia peranti. " +
                "Audio tidak disimpan oleh AKSARA. Ini bukan Gemini Live.",
            color = VoiceMuted, fontSize = 10.sp, lineHeight = 14.sp,
            textAlign = TextAlign.Center
        )
    }
}
