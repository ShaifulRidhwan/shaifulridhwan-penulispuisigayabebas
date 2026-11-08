package my.aksara.nativeapp.feature.voice

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
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

internal val VoiceLanguageStyles=listOf(
    "Bahasa Santai","Loghat Utara","Loghat Kelantan","Loghat Terengganu",
    "Loghat Negeri Sembilan","Loghat Perak","Loghat Johor","Loghat Sabah","Loghat Sarawak"
)
private fun voiceStyleInstruction(style:String):String=when(style){
    "Loghat Utara"->"Bercakap dalam loghat Utara Malaysia yang semula jadi, dengan kosa kata dan rentak Kedah, Perlis atau Pulau Pinang apabila sesuai."
    "Loghat Kelantan"->"Bercakap menggunakan loghat Kelantan yang semula jadi, bukan sekadar menukar satu dua perkataan."
    "Loghat Terengganu"->"Bercakap menggunakan loghat Terengganu yang semula jadi dan mudah difahami."
    "Loghat Negeri Sembilan"->"Bercakap menggunakan loghat Negeri Sembilan yang semula jadi dan tidak dibuat-buat."
    "Loghat Perak"->"Bercakap menggunakan loghat Perak yang semula jadi dan mudah difahami."
    "Loghat Johor"->"Bercakap menggunakan gaya pertuturan Johor yang santai dan tidak dipaksa."
    "Loghat Sabah"->"Bercakap menggunakan loghat Sabah yang santai, semula jadi dan hormat kepada kepelbagaian setempat."
    "Loghat Sarawak"->"Bercakap menggunakan loghat Melayu Sarawak yang santai dan semula jadi."
    else->"Gunakan Bahasa Melayu Malaysia santai, tidak perlu loghat negeri tertentu."
}
@Composable fun VoiceContent(onClose:()->Unit,mode:String="cahaya",onMode:(String)->Unit={}) {
    val context=LocalContext.current
    val preferences=remember(context){context.getSharedPreferences("aksara_voice",android.content.Context.MODE_PRIVATE)}
    var style by rememberSaveable {mutableStateOf(preferences.getString("language_style","Bahasa Santai")?.takeIf{it in VoiceLanguageStyles}?:"Bahasa Santai")}
    // A Gemini Live system instruction is fixed for the socket lifetime.
    // Reconnect cleanly after a style / Thinking Mode change.
    val identity=remember(context){context.assets.open("voice-identity.txt").bufferedReader().use{it.readText()}}
    val modePrompt=if(mode=="gelap")"Kritikal, mendalam dan sinis secara beralasan." else "Santai, jelas dan responsif."
    val lock="UTAMAKAN Bahasa Melayu Malaysia (ms-MY) sepanjang perbualan. " +
        "Jangan tiba-tiba bertukar ke bahasa Sepanyol, Inggeris atau bahasa lain. " +
        "Permintaan terjemahan atau petikan asing hanya untuk giliran yang diminta; " +
        "kembali ke bahasa pilihan selepas itu. Jangan tukar loghat tanpa arahan pengguna. " +
        "Jika tidak pasti sebutan negeri, gunakan Bahasa Melayu santai, jangan reka loghat."
    val policy=identity+"\n"+lock+"\nMod aktif: "+mode+". "+modePrompt+
        "\nGaya bahasa suara yang dipilih: "+style+". "+voiceStyleInstruction(style)
    // Keep one client (and its timer/preferences) while an intentional mode/style
    // change causes a fresh Gemini setup. Automatic reconnect uses this same policy.
    val client=remember(context){LiveVoiceClient(context,BuildConfig.API_ORIGIN,policy)}
    LaunchedEffect(client,policy){client.updateIdentity(policy)}
    val state by client.state.collectAsStateWithLifecycle()
    var permissionError by remember {mutableStateOf<String?>(null)}
    val permission=rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {granted -> if(granted)client.start() else permissionError="Izin mikrofon ditolak. Tiada audio dihantar."}
    val owner=LocalLifecycleOwner.current
    DisposableEffect(owner,client){
        val observer=LifecycleEventObserver{_,event->
            when(event){
                Lifecycle.Event.ON_STOP -> client.close()
                Lifecycle.Event.ON_START -> if(context.checkSelfPermission(Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED)client.start()
                else -> Unit
            }
        }
        owner.lifecycle.addObserver(observer)
        onDispose{owner.lifecycle.removeObserver(observer);client.close()}
    }
    LaunchedEffect(client){if(context.checkSelfPermission(Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED)client.start() else permission.launch(Manifest.permission.RECORD_AUDIO)}
    VoiceScreen(state.copy(message=permissionError?:state.message),onClose={client.close();onClose()},onMic={client.setMic(!state.mic)},onSpeaker={client.setSpeaker(!state.speaker)},onVolume=client::setVolume,mode=mode,onMode=onMode,style=style,onStyle={next->if(next in VoiceLanguageStyles){style=next;preferences.edit().putString("language_style",next).apply()}})
}
