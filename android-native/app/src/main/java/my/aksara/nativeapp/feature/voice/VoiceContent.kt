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

@Composable fun VoiceContent(onClose:()->Unit,mode:String="cahaya",onMode:(String)->Unit={}) {
    val context=LocalContext.current
    val client=remember(mode) {LiveVoiceClient(context,BuildConfig.API_ORIGIN,context.assets.open("voice-identity.txt").bufferedReader().use{it.readText()}+"\nMod aktif: $mode. "+if(mode=="gelap")"Kritikal, mendalam dan sinis secara beralasan." else "Santai, jelas dan responsif.")}
    val state by client.state.collectAsStateWithLifecycle()
    var permissionError by remember {mutableStateOf<String?>(null)}
    val permission=rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {granted -> if(granted)client.start() else permissionError="Izin mikrofon ditolak. Tiada audio dihantar."}
    val owner=LocalLifecycleOwner.current
    DisposableEffect(owner,client){
        val observer=LifecycleEventObserver{_,event->if(event==Lifecycle.Event.ON_STOP)client.close()}
        owner.lifecycle.addObserver(observer)
        onDispose{owner.lifecycle.removeObserver(observer);client.close()}
    }
    LaunchedEffect(client){if(context.checkSelfPermission(Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED)client.start() else permission.launch(Manifest.permission.RECORD_AUDIO)}
    VoiceScreen(state.copy(message=permissionError?:state.message),onClose={client.close();onClose()},onMic={client.setMic(!state.mic)},onSpeaker={client.setSpeaker(!state.speaker)},onVolume=client::setVolume,mode=mode,onMode=onMode)
}
