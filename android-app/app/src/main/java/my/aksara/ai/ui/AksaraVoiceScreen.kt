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
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.text.input.PasswordVisualTransformation
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
    val live = remember(context) { AksaraGeminiLive(context.applicationContext) }
    var liveDialog by remember { mutableStateOf(false) }
    var avatar3dEnabled by rememberSaveable { mutableStateOf(true) }
    var liveToken by remember { mutableStateOf("") } // Never saved, logged or put in APK.
    var pendingLiveSecret by remember { mutableStateOf("") }
    var liveActive by remember { mutableStateOf(false) }
    var liveMicEnabled by remember { mutableStateOf(true) }
    var liveStatus by remember { mutableStateOf("Gemini Live memerlukan backend Android yang diluluskan.") }
    var liveAnswer by remember { mutableStateOf("") }
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

    DisposableEffect(services, live, lifecycle) {
        services.initializeSpeaker { ready, message ->
            speakerReady = ready
            speakerInfo = message
        }
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_STOP) {
                services.cancelListening()
                services.stopSpeaking()
                live.stop()
                liveActive = false
                listening = false
                speaking = false
                caption = "Mikrofon dimatikan semasa aplikasi di latar."
            }
        }
        lifecycle.addObserver(observer)
        onDispose {
            lifecycle.removeObserver(observer)
            services.close()
            live.close()
            liveToken = ""
            pendingLiveSecret = ""
        }
    }

    LaunchedEffect(vm.activeId) {
        services.cancelListening()
        services.stopSpeaking()
        live.stop()
        liveActive = false
        listening = false
        speaking = false
        pendingUserId = null
        pendingSessionId = null
    }

    fun recordVoice() {
        if (vm.busy || listening || liveActive) return
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
    fun beginLive(secret: String) {
        if (secret.length < 32 || liveActive) return
        services.cancelListening()
        services.stopSpeaking()
        listening = false
        speaking = false
        liveAnswer = ""
        liveMicEnabled = true
        liveActive = true
        live.start(
            secret, vm.mode,
            onStatus = { message ->
                liveStatus = message
                if (listOf("belum", "gagal", "terganggu", "menamatkan", "ditarik").any {
                    message.contains(it, ignoreCase = true)
                }) {
                    liveActive = false
                }
            },
            onTranscript = { role, text ->
                if (role == "Kau") {
                    currentSpeech = text
                    partial = text
                } else {
                    liveAnswer = text
                }
            }
        )
    }
    val livePermissionRequest = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        val secret = pendingLiveSecret
        pendingLiveSecret = ""
        if (granted && secret.isNotBlank()) beginLive(secret)
        else liveStatus = "Kebenaran mikrofon ditolak."
    }
    fun authorizeLive() {
        val secret = liveToken
        liveToken = ""
        liveDialog = false
        if (ContextCompat.checkSelfPermission(
                context, Manifest.permission.RECORD_AUDIO
            ) == PackageManager.PERMISSION_GRANTED
        ) beginLive(secret)
        else {
            pendingLiveSecret = secret
            livePermissionRequest.launch(Manifest.permission.RECORD_AUDIO)
        }
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
            "Perbualan suara native · AKSARA Core",
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
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedButton(
                onClick = {
                    if (liveActive) {
                        live.stop()
                        liveActive = false
                        liveStatus = "Gemini Live dihentikan."
                    } else liveDialog = true
                },
                modifier = Modifier.weight(1f)
            ) {
                Text(if (liveActive) "■ Henti Gemini Live" else "◉ Gemini Live · Ujian pemilik",
                    fontSize = 11.sp)
            }
            if (liveActive) {
                TextButton(onClick = {
                    liveMicEnabled = !liveMicEnabled
                    live.setMic(liveMicEnabled)
                }) {
                    Text(if (liveMicEnabled) "Mik ON" else "Mik OFF", fontSize = 11.sp)
                }
            }
        }
        if (liveActive || liveStatus.startsWith("Gemini Live")) {
            Text(liveStatus, color = VoiceMuted, fontSize = 11.sp,
                textAlign = TextAlign.Center, maxLines = 2)
        }
        Spacer(Modifier.height(2.dp))
        if (avatar3dEnabled && my.aksara.ai.BuildConfig.DEBUG) {
            AksaraAvatar3D(modifier = Modifier.size(width = 172.dp, height = 172.dp))
            Text(
                "Model contoh TalkingHead · Ready Player Me · CC BY-NC 4.0 · Ujian bukan komersial",
                color = VoiceMuted, fontSize = 9.sp, textAlign = TextAlign.Center
            )
        } else {
        Box(
            modifier = Modifier.size(112.dp)
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
        }
        if (my.aksara.ai.BuildConfig.DEBUG) {
            TextButton(onClick = { avatar3dEnabled = !avatar3dEnabled }) {
                Text(
                    if (avatar3dEnabled) "Avatar 3D: ON" else "Avatar 3D: OFF",
                    color = VoiceIce, fontSize = 11.sp
                )
            }
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
                if (liveActive && liveAnswer.isNotBlank()) liveAnswer.take(720)
                else latestAssistant?.content?.let {
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
                enabled = (!vm.busy || listening) && !liveActive,
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
                enabled = !liveActive && (speaking || (speakerReady &&
                    !latestAssistant?.content.isNullOrBlank())),
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
                    if (liveActive) live.setSpeaker(speakerEnabled)
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
                live.stop()
                liveActive = false
                openChat()
            }) { Text("Buka Chat", color = VoiceIce, fontSize = 12.sp) }
        }
        Text(speakerInfo, color = VoiceMuted, fontSize = 10.sp,
            textAlign = TextAlign.Center)
        Text(
            "Pengecaman suara mungkin menggunakan perkhidmatan Android/penyedia peranti. " +
                "Audio tidak disimpan oleh AKSARA. Live memerlukan backend pemilik.",
            color = VoiceMuted, fontSize = 10.sp, lineHeight = 14.sp,
            textAlign = TextAlign.Center
        )
    }
    if (liveDialog) {
        AlertDialog(
            onDismissRequest = { liveDialog = false; liveToken = "" },
            title = { Text("Gemini Live · Ujian pemilik") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                    Text(
                        "Gunakan token QA peribadi selepas backend mobile Live " +
                            "diaktifkan. Token tidak disimpan pada telefon. " +
                            "Jangan kongsi token ini atau letak dalam kod aplikasi.",
                        fontSize = 12.sp
                    )
                    OutlinedTextField(
                        value = liveToken,
                        onValueChange = { liveToken = it.take(128) },
                        visualTransformation = PasswordVisualTransformation(),
                        label = { Text("Token pemilik sementara") },
                        singleLine = true
                    )
                    Text(
                        "Audio disambungkan terus ke Google menggunakan token sekali " +
                            "guna, bukan melalui pengesahan Origin laman web.",
                        fontSize = 11.sp
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = { authorizeLive() }, enabled = liveToken.length >= 32) {
                    Text("Sambung Live")
                }
            },
            dismissButton = {
                TextButton(onClick = { liveDialog = false; liveToken = "" }) {
                    Text("Batal")
                }
            }
        )
    }

}
