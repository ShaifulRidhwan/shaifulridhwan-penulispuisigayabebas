package my.aksara.nativeapp.feature.voice

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import my.aksara.nativeapp.BuildConfig
import my.aksara.nativeapp.core.design.*
import my.aksara.engine.voice.LiveVoiceClient
import kotlinx.coroutines.delay

@Composable fun VoiceContent(onClose:()->Unit) {
    val context=LocalContext.current
    val client=remember {LiveVoiceClient(context,BuildConfig.API_ORIGIN,context.assets.open("voice-identity.txt").bufferedReader().use{it.readText()})}
    val state by client.state.collectAsStateWithLifecycle()
    var permissionError by remember {mutableStateOf<String?>(null)}
    val permission=rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {granted -> if(granted)client.start() else permissionError="Izin mikrofon ditolak. Tiada audio dihantar."}
    val owner=LocalLifecycleOwner.current
    DisposableEffect(owner,client){
        val observer=LifecycleEventObserver{_,event->if(event==Lifecycle.Event.ON_STOP)client.close()}
        owner.lifecycle.addObserver(observer)
        onDispose{owner.lifecycle.removeObserver(observer);client.close()}
    }
    LaunchedEffect(Unit){if(context.checkSelfPermission(Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED)client.start() else permission.launch(Manifest.permission.RECORD_AUDIO)}
    var seconds by remember{mutableIntStateOf(0)}
    LaunchedEffect(state.startedAt){while(state.startedAt!=null){seconds=((System.currentTimeMillis()-state.startedAt!!)/1000).toInt();delay(1000)}}
    Spacer(Modifier.height(12.dp))
    Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){AksaraText("AKSARA VOICE CHAT",size=12f,weight=600);AksaraText("%02d:%02d".format(seconds/60,seconds%60),size=12f,color=AksaraColors.muted)}
    Spacer(Modifier.height(16.dp))
    AksaraGlassSurface(Modifier.fillMaxWidth().height(230.dp),radius=24.dp,blur=8.dp){
        Column(Modifier.align(Alignment.Center).padding(20.dp),horizontalAlignment=Alignment.CenterHorizontally){
            AksaraIcon("voice",Modifier.size(46.dp));Spacer(Modifier.height(18.dp));AksaraText(permissionError?:state.message,size=13f)
            Spacer(Modifier.height(12.dp));AksaraText("Avatar 3D native belum diintegrasi.",size=10f,color=AksaraColors.muted)
        }
    }
    Spacer(Modifier.height(14.dp));AksaraText("Bahasa Santai · Aoede",size=12f,weight=600)
    Spacer(Modifier.height(12.dp));AksaraText("Volume ${(state.volume*100).toInt()}%",size=11f)
    Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {AksaraButton("−",{client.setVolume(state.volume-.1f)},Modifier.weight(1f));AksaraButton("+",{client.setVolume(state.volume+.1f)},Modifier.weight(1f))}
    Spacer(Modifier.height(20.dp))
    Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
        AksaraButton(if(state.mic)"Mute" else "Buka mic",{client.setMic(!state.mic)},Modifier.weight(1f),icon="mic",size=10f)
        AksaraButton("Tamat",{client.close();onClose()},Modifier.weight(1f),size=10f)
        AksaraButton(if(state.speaker)"Speaker" else "Senyap",{client.setSpeaker(!state.speaker)},Modifier.weight(1f),icon="speaker",size=10f)
    }
    if(state.phase=="error") {Spacer(Modifier.height(14.dp));AksaraText("Sesi belum disahkan di peranti sebenar. Tutup dan buka semula untuk cuba lagi.",size=11f,color=AksaraColors.muted)}
}
