package my.aksara.nativeapp.feature.chat

import android.content.Intent
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.*
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.interaction.DragInteraction
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.*
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.*
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.*
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.chrisbanes.haze.*
import io.noties.markwon.Markwon
import io.noties.markwon.ext.tables.TablePlugin
import my.aksara.nativeapp.R
import my.aksara.nativeapp.core.design.*
import my.aksara.nativeapp.core.storage.Message
import my.aksara.nativeapp.core.platform.Attachment
import my.aksara.nativeapp.core.platform.AttachmentReader
import my.aksara.nativeapp.core.network.LargeUploadClient
import org.json.JSONArray
import kotlinx.coroutines.launch
import kotlinx.coroutines.Job
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.collect
import java.time.*
import java.time.format.DateTimeFormatter

const val WelcomeText = "Antara aksara dan code, GAYA yang bebas, BEBAS dalam bentuk, LUAS dalam pemikiran."
@Composable fun AksaraApp(vm: ChatViewModel = viewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var attachments by remember { mutableStateOf<List<Attachment>>(emptyList()) }
    var attachmentError by remember { mutableStateOf<String?>(null) }
    var attachmentLoading by remember { mutableStateOf(false) }
    var uploadStatus by remember { mutableStateOf<String?>(null) }
    var uploadJob by remember { mutableStateOf<Job?>(null) }
    val scope = rememberCoroutineScope()
    val uploader = remember(context) { LargeUploadClient() }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
        if(uris.isNotEmpty()&&!attachmentLoading) {
            uploadJob=scope.launch {
                attachmentLoading=true
                attachmentError=null
                try {
                    require(uris.size<=4 && attachments.size+uris.size<=4) {
                        "Maksimum 4 lampiran bagi satu mesej."
                    }
                    val fresh=mutableListOf<Attachment>()
                    for(uri in uris){
                        val details=AttachmentReader.inspect(context,uri)
                        val file=if(AttachmentReader.needsLargeUpload(details)){
                            uploadStatus="Menyediakan upload: ${details.name}"
                            uploader.upload(context,uri,details){ percent ->
                                scope.launch { uploadStatus="Muat naik ${details.name}: ${percent}%" }
                            }.also { uploadStatus="Gemini siap memproses: ${details.name}" }
                        } else {
                            uploadStatus="Membaca: ${details.name}"
                            AttachmentReader.read(context,uri)
                        }
                        fresh+=file
                    }
                    val selected=attachments+fresh
                    val encoded=selected.sumOf{it.media?.optString("data")?.length?:0}
                    val textSize=selected.sumOf{it.text.length}
                    require(encoded<=5_000_000 && textSize<=250_000) {
                        "Gabungan lampiran terlalu besar. Had payload backend mesti dipatuhi."
                    }
                    attachments=selected
                    attachmentError=null
                }catch(_:CancellationException){
                    attachmentError="Muat naik dibatalkan."
                }catch(e:Exception){
                    attachmentError=e.message?:"Lampiran gagal dimuat naik."
                }finally{
                    attachmentLoading=false
                    uploadStatus=null
                    uploadJob=null
                }
            }
        }
    }
    AksaraScreen(state.copy(error = attachmentError ?: state.error), onSend = { q ->
        val textDocs = attachments.filter { it.text.isNotBlank() }
        val text = textDocs.joinToString("\n\n") { "[DOKUMEN: " + it.name + "]\n" + it.text + "\n[TAMAT DOKUMEN]" }
        val name = textDocs.joinToString(", ") { it.name }.take(100)
        val media = JSONArray().apply { attachments.mapNotNull { it.media }.forEach { put(it) } }
        val uploadedFiles = JSONArray().apply { attachments.mapNotNull { it.receipt }.forEach { put(it) } }
        val accepted=vm.send(q, text, name, media, uploadedFiles,attachments.map { it.name })
        if (accepted) {
            // The ViewModel has accepted the pending turn and will persist it before inference.
            // Do not carry sent media into the next message or discard it on a rejected turn.
            attachments = emptyList()
            attachmentError = null
        } else {
            attachmentError = vm.state.value.error ?: "Mesej belum dihantar. Cuba lagi selepas sambungan sedia."
        }
        accepted
    }, onJourney=vm::journey, onStop = vm::stop, onRefresh = { vm.refreshProviders() }, onMode = vm::setMode,
        onEditAndSend = vm::forkAndSendFrom, onBranch = vm::forkFrom, onRegenerate = vm::regenerateFrom,
        onMemory = vm::setMemory, onVoiceTurns = vm::acceptVoiceTurns, onClearAttachment = {
            val selected=attachments
            attachments=emptyList()
            selected.mapNotNull { it.receipt }.forEach { receipt ->
                scope.launch { uploader.delete(receipt) }
            }
        },
        onRestore = vm::restore, onRestoreSession = vm::restoreSession, onClear = vm::clearScreen,
        attachmentName = attachments.takeIf { it.isNotEmpty() }?.joinToString(", ") { it.name }?.take(150),
        attachmentLoading = attachmentLoading,
        uploadStatus = uploadStatus,
        onCancelUpload = { uploadJob?.cancel() },
        onPickAttachment = { category -> picker.launch(AttachmentSendPolicy.mimeTypes(category)) },
        onDismissError = { attachmentError = null; vm.dismissError() })
}

@Composable fun AksaraScreen(state: ChatState, onSend: (String)->Boolean = {true}, onStop: ()->Unit = {}, onRefresh: ()->Unit = {},
    onJourney: (String)->Unit = { onSend(it); Unit }, onMode: (String)->Unit = {}, onRestore: ()->Unit = {}, onRestoreSession: (String)->Unit = {}, onClear: ()->Unit = {}, attachmentName: String? = null,
    onPickAttachment: (String)->Unit = {}, onDismissError: ()->Unit = {}, onMemory: (Boolean,String)->Unit = {_,_->}, onClearAttachment: ()->Unit = {}, initialOverlay: String? = null,
    attachmentLoading: Boolean = false,
    uploadStatus: String? = null, onCancelUpload: ()->Unit = {},
    onEditAndSend: (String,String)->Boolean = {_,_->false},
    onBranch: (String)->Boolean = {false}, onRegenerate: (String)->Boolean = {false},
    fixedTimestamp: Long? = null, onVoiceTurns:(List<my.aksara.engine.voice.VoiceContextTurn>)->Unit = {}) {
    val backdrop = remember { HazeState() }; val scene = remember { HazeState() }
    var overlay by rememberSaveable { mutableStateOf(initialOverlay) }
    var draft by rememberSaveable { mutableStateOf("") }
    var editingId by rememberSaveable { mutableStateOf<String?>(null) }
    var searchOpen by rememberSaveable { mutableStateOf(false) }
    var searchQuery by rememberSaveable { mutableStateOf("") }
    var searchIndex by rememberSaveable { mutableIntStateOf(0) }
    val uiScope = rememberCoroutineScope()
    val context = LocalContext.current
    val margins = aksaraDeviceMargins()
    val focus = LocalFocusManager.current
    val list = rememberLazyListState()
    var autoFollow by remember { mutableStateOf(true) }
    val imeBottom = WindowInsets.ime.getBottom(LocalDensity.current)
    // A single collector owns programmatic scrolling. Dragging suspends following,
    // while composer focus or returning to the bottom explicitly resumes it.
    LaunchedEffect(list) {
        launch {
            list.interactionSource.interactions.collect { interaction ->
                when (interaction) {
                    is DragInteraction.Start -> autoFollow = false
                    is DragInteraction.Stop, is DragInteraction.Cancel -> {
                        if (!list.canScrollForward) autoFollow = true
                    }
                }
            }
        }
        launch {
            snapshotFlow { !list.canScrollForward }.collect { atBottom ->
                if (atBottom) autoFollow = true
            }
        }
    }
    LaunchedEffect(state.messages.size, state.messages.lastOrNull()?.text?.length,
        state.busy, imeBottom, autoFollow) {
        if (autoFollow && state.messages.isNotEmpty()) {
            withFrameNanos { }
            val last = list.layoutInfo.totalItemsCount - 1
            if (last >= 0) {
                if (state.messages.size > 1 && list.firstVisibleItemIndex < last - 3) {
                    list.scrollToItem(last)
                }
                list.scrollBy(100_000f)
            }
        }
    }
    val keyboard = LocalSoftwareKeyboardController.current
    fun open(value: String) { focus.clearFocus(); keyboard?.hide(); overlay = value }
    BackHandler(overlay != null) { overlay = null }
    CompositionLocalProvider(LocalBackdrop provides backdrop) {
        BoxWithConstraints(Modifier.fillMaxSize().imePadding().testTagCompat("app")) {
            val viewportHeight = maxHeight
            Box(Modifier.fillMaxSize().hazeSource(scene)) {
            AksaraBackground(Modifier.fillMaxSize().hazeSource(backdrop))
            Column(Modifier.fillMaxSize().safeDrawingPadding().padding(start=margins.horizontal,end=margins.horizontal,top=margins.top,bottom=margins.bottom)) {
                Spacer(Modifier.height(5.dp))
                AksaraGlassSurface(Modifier.fillMaxWidth().height(58.dp).testTagCompat("topbar"), radius=20.dp, blur=12.dp,
                    brush=cssGradient(115f,listOf(Color(8,14,24,102),Color(17,26,40,51))),saturation=1.15f, border=Color.Transparent) {
                    Row(Modifier.fillMaxSize().padding(horizontal=10.dp), verticalAlignment=Alignment.CenterVertically) {
                        AksaraGlassSurface(Modifier.height(31.dp), radius=13.dp) {
                            Row(Modifier.align(Alignment.Center).padding(horizontal=7.dp), verticalAlignment=Alignment.CenterVertically, horizontalArrangement=Arrangement.spacedBy(3.dp)) {
                                AksaraText("AKSARA A.I", size=10f,line=12f,weight=650)
                                AksaraText("oleh Shaiful Ridhwan",size=7f,line=8.4f,weight=450,color=Color(233,198,141,212))
                            }
                        }
                        Spacer(Modifier.weight(1f))
                        AksaraButton("Laman utama", { context.startActivity(Intent(Intent.ACTION_VIEW,Uri.parse("https://shaifulridhwan-penulispuisigayabebas.netlify.app/"))) }, size=9f,height=31.dp,radius=999.dp)
                        Spacer(Modifier.width(4.dp))
                        AksaraGlassSurface(Modifier.width(64.dp).height(31.dp).clickable { open("portal") },radius=999.dp,blur=5.dp) {
                            Row(Modifier.align(Alignment.Center), verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(4.dp)) {
                                AksaraText("PORTAL",size=9f,line=10.8f,weight=500);AksaraIcon("grid",Modifier.size(14.dp),Color(0xffa2c8e5))
                            }
                        }
                    }
                }
                Box(Modifier.weight(1f).padding(top=viewportHeight*.011f)) {
                    AksaraGlassSurface(Modifier.fillMaxSize().testTagCompat("conversation"),radius=22.dp,blur=3.dp,saturation=1.06f,
                        brush=Brush.linearGradient(listOf(Color(15,17,25,51),Color(10,14,25,33),Color(7,10,18,56))),border=Color.Transparent) {
                        Column(Modifier.fillMaxSize().padding(1.dp)) {
                            BoxWithConstraints(Modifier.fillMaxWidth().height(58.dp).testTagCompat("conversation-head")) {
                                val compact=maxWidth<390.dp
                                val headerPaint=remember{HazeState()}
                                Box(Modifier.matchParentSize().hazeSource(headerPaint).background(Brush.horizontalGradient(listOf(Color(20,18,21,64),Color(5,8,17,56)))))
                                CompositionLocalProvider(LocalBackdropPaints provides listOf(headerPaint)) {
                                Row(Modifier.fillMaxSize().padding(horizontal=if(compact)5.dp else 8.dp,vertical=8.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(if(compact)3.dp else 4.dp)) {
                                    AksaraButton("Voice Chat",{open("voice-permission")},Modifier.width(if(compact)82.328.dp else 93.484.dp),icon="voice",size=if(compact)9f else 10f,height=AksaraGlassTokens.capsuleHeight,radius=AksaraGlassTokens.capsuleRadius)
                                    AksaraButton("",{searchOpen=!searchOpen;autoFollow=!searchOpen},Modifier.width(40.dp).semantics{contentDescription="Cari mesej dan kongsi perbualan"},icon="search",size=9f,height=AksaraGlassTokens.capsuleHeight,radius=AksaraGlassTokens.capsuleRadius)
                                    Spacer(Modifier.weight(1f))
                                    AksaraGlassSurface(Modifier.width(if(compact)151.dp else 167.dp).height(AksaraGlassTokens.capsuleHeight).clickable {open("connection")}.semantics {contentDescription="Connection"},radius=999.dp,blur=9.dp) {
                                        val connectionStatus = ProviderConnectionStatus.label(state.providers)
                                        val compactStatus = when(connectionStatus) {
                                            "Backend unreachable" -> "Unreachable"
                                            "Status unavailable" -> "Unavailable"
                                            else -> connectionStatus
                                        }
                                        Row(Modifier.align(Alignment.Center),
                                            horizontalArrangement=Arrangement.spacedBy(5.dp),
                                            verticalAlignment=Alignment.CenterVertically) {
                                            AksaraIcon("network",Modifier.size(15.dp),Color(0xffc1b393))
                                            AksaraText("Multi A.I",size=9.5f,line=12f,weight=600)
                                            AksaraText(compactStatus,size=if(compactStatus.length>10)8.5f else 9.5f,line=12f,weight=600)
                                        }
                                    }
                                }
                                }
                                Box(Modifier.align(Alignment.BottomCenter).fillMaxWidth().height(1.dp).background(Color(235,215,185,35)))
                            }
                            if(searchOpen) {
                                val matches=state.messages.mapIndexedNotNull { index,message ->
                                    if(searchQuery.isNotBlank() && message.text.contains(searchQuery,ignoreCase=true)) index else null
                                }
                                Row(Modifier.fillMaxWidth().height(54.dp).padding(horizontal=9.dp,vertical=6.dp),
                                    verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(5.dp)) {
                                    AksaraGlassSurface(Modifier.weight(1f).height(AksaraGlassTokens.capsuleHeight),radius=AksaraGlassTokens.controlRadius,blur=12.dp) {
                                        if(searchQuery.isBlank()) AksaraText("Cari mesej...",Modifier.align(Alignment.CenterStart).padding(horizontal=10.dp),size=11f,color=AksaraColors.muted)
                                        BasicTextField(searchQuery,{searchQuery=it;searchIndex=0},Modifier.align(Alignment.CenterStart).fillMaxWidth().padding(horizontal=10.dp),
                                            singleLine=true,textStyle=AksaraTypography.style(12f,18f),cursorBrush=SolidColor(AksaraColors.gold))
                                    }
                                    AksaraButton(if(matches.isEmpty())"0" else "${searchIndex.coerceIn(0,matches.lastIndex)+1}/${matches.size}",{
                                        if(matches.isNotEmpty()){
                                            searchIndex=searchIndex.coerceIn(0,matches.lastIndex)
                                            val target=matches[searchIndex]
                                            autoFollow=false
                                            uiScope.launch{list.animateScrollToItem(target+1)}
                                            searchIndex=(searchIndex+1)%matches.size
                                        }
                                    },Modifier.width(47.dp),size=9f,height=AksaraGlassTokens.capsuleHeight,radius=AksaraGlassTokens.capsuleRadius)
                                    AksaraButton("Kongsi",{
                                        if(state.messages.isNotEmpty()) {
                                            val body=state.messages.joinToString("\\n\\n") { (if(it.role=="user")"Kau" else "Aksara")+": "+it.text }
                                            val share=Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT,body)
                                            context.startActivity(Intent.createChooser(share,"Kongsi perbualan Aksara"))
                                        }
                                    },Modifier.width(53.dp),size=9f,height=AksaraGlassTokens.capsuleHeight,radius=AksaraGlassTokens.capsuleRadius)
                                }
                            }
                            if(state.busy) Box(Modifier.fillMaxWidth().height(42.1875.dp).background(Color(15,18,26,40)).padding(horizontal=21.dp,vertical=11.dp)){AksaraText("Generating Response",size=12f,line=19.2f,color=Color(0xffd9c8b0))}
                            LazyColumn(Modifier.weight(1f).fillMaxWidth().testTagCompat("messages"),state=list,contentPadding=PaddingValues(start=if(state.messages.isEmpty())17.dp else 12.dp,end=if(state.messages.isEmpty())17.dp else 12.dp,top=if(state.messages.isEmpty())14.dp else 13.dp,bottom=13.dp),verticalArrangement=Arrangement.spacedBy(14.dp)) {
                                if(state.messages.isEmpty()) item { AksaraChatBubble(Message("welcome","assistant",WelcomeText,fixedTimestamp?:System.currentTimeMillis()),fixedTimestamp=fixedTimestamp,initial=true) }
                                if(state.messages.isNotEmpty()) item { AksaraChatBubble(Message("welcome-expanded","assistant","Antara aksara dan code,\nGAYA yang bebas,\nBEBAS dalam bentuk,\nLUAS dalam pemikiran.",fixedTimestamp?:state.messages.first().at),fixedTimestamp=fixedTimestamp) }
                                items(state.messages,key={it.id}) { message ->
                                    AksaraChatBubble(message,fixedTimestamp=fixedTimestamp,
                                        onCopy={
                                            val clipboard=context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                            clipboard.setPrimaryClip(ClipData.newPlainText("Aksara A.I.",message.text))
                                        },
                                        onReuse={draft=it;editingId=null;autoFollow=true},
                                        onEdit=if(message.role=="user" && !message.incomplete &&
                                            !message.text.contains("[Lampiran: ") && !state.busy) ({
                                            editingId=message.id;draft=message.text;autoFollow=true
                                        }) else null,
                                        onBranch=if(!state.busy && !message.incomplete) ({
                                            if(onBranch(message.id)) { editingId=null;draft="";autoFollow=true;searchOpen=false }
                                        }) else null,
                                        onRetry=if(message.role=="assistant" && message.id==state.messages.lastOrNull()?.id && !state.busy)
                                            ({if(onRegenerate(message.id)){editingId=null;draft="";autoFollow=true;searchOpen=false};Unit}) else null)
                                }
                            }
                            if(state.messages.isEmpty()) Row(Modifier.fillMaxWidth().height(49.dp).padding(start=12.dp,end=12.dp,top=4.dp,bottom=8.dp),horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                                AksaraButton("Siapa Aku",{onJourney("Siapa Aku")},Modifier.width(91.969.dp),size=11.5f,height=37.dp,radius=999.dp,leadingText="↗")
                            }
                            if(state.nextJourney!=null) AksaraButton(state.nextJourney,{onJourney(state.nextJourney)},Modifier.padding(horizontal=12.dp,vertical=4.dp),size=11.5f,height=37.dp,radius=999.dp,leadingText="↗")
                            if(state.error!=null) Row(Modifier.fillMaxWidth().clickable(onClick=onDismissError).padding(8.dp)) { AksaraText(state.error,size=11f,color=Color(0xffe7a08e)) }
                        }
                    }
                }
                Spacer(Modifier.height(10.dp))
                if(attachmentLoading) Row(Modifier.fillMaxWidth().padding(horizontal=10.dp,vertical=3.dp),
                    verticalAlignment=Alignment.CenterVertically) {
                    AksaraText(uploadStatus?:"Membaca lampiran...",Modifier.weight(1f),size=10.5f,color=AksaraColors.gold)
                    AksaraButton("Batal",onCancelUpload,size=10f,height=31.dp,radius=12.dp)
                }
                if(attachmentName!=null) Row(Modifier.fillMaxWidth().padding(horizontal=10.dp,vertical=2.dp),
                    verticalAlignment=Alignment.CenterVertically) {
                    AksaraText("📎 "+attachmentName,Modifier.weight(1f),size=10.5f)
                    AksaraButton("Buang",onClearAttachment,size=9f,height=30.dp,radius=12.dp)
                }
                val hasAttachments = !attachmentName.isNullOrBlank()
                if(editingId!=null) Row(Modifier.fillMaxWidth().padding(horizontal=9.dp,vertical=4.dp),
                    verticalAlignment=Alignment.CenterVertically) {
                    AksaraText("Edit mesej · simpan sebagai cabang baharu",
                        Modifier.weight(1f),size=10.5f,color=AksaraColors.gold)
                    AksaraButton("Batal",{editingId=null;draft=""},height=29.dp,size=10f)
                }
                val canSubmit = state.loaded && !state.busy && !attachmentLoading &&
                    (draft.isNotBlank() || hasAttachments) && (editingId==null || !hasAttachments)
                AksaraGlassSurface(
                    Modifier.fillMaxWidth().heightIn(min=58.dp,max=164.dp).testTagCompat("composer-form"),
                    radius=20.dp,blur=12.dp,saturation=1.15f,
                    brush=cssGradient(115f,listOf(Color(8,14,24,102),Color(17,26,40,51))),
                    border=Color.Transparent) {
                    Row(Modifier.fillMaxWidth().padding(horizontal=8.dp,vertical=7.dp),
                        verticalAlignment=Alignment.CenterVertically,
                        horizontalArrangement=Arrangement.spacedBy(5.dp)) {
                        Box(Modifier.size(42.dp).clip(RoundedCornerShape(13.dp))
                            .clickable {open("attachments")}
                            .semantics {contentDescription="Lampir fail"},
                            contentAlignment=Alignment.Center) {AksaraIcon("attach",Modifier.size(21.dp))}
                        BasicTextField(draft,{draft=it},Modifier.weight(1f)
                            .heightIn(min=42.dp,max=140.dp).padding(horizontal=3.dp,vertical=9.dp)
                            .onFocusChanged { if(it.isFocused) autoFollow=true }
                            .semantics {contentDescription="Tulis mesej untuk Aksara A.I."}
                            .testTagCompat("input"),
                            textStyle=AksaraTypography.style(16f,24f),
                            cursorBrush=SolidColor(AksaraColors.gold))
                        if(state.busy) AksaraButton("Henti",onStop,Modifier.width(56.dp)
                            .semantics {contentDescription="Hentikan respons"},size=12f,height=40.dp,radius=12.dp)
                        AksaraButton("",{open("thinking")},Modifier.width(40.dp)
                            .semantics {
                                contentDescription="Thinking Mode"
                                stateDescription=if(state.mode=="gelap")"Gelap" else "Cahaya"
                            },icon=if(state.mode=="gelap")"moon" else "sun",height=42.dp,
                            radius=13.dp,iconSize=23.dp,
                            contentColor=if(state.mode=="gelap")Color(0xffb6d3ff) else AksaraColors.gold)
                        AksaraButton("",{
                            if(canSubmit) {
                                val text=AttachmentSendPolicy.submissionText(draft,hasAttachments)
                                val accepted = editingId?.let { onEditAndSend(it,text) } ?: onSend(text)
                                if(accepted) { draft="";editingId=null;autoFollow=true;searchOpen=false }
                            }
                        },Modifier.width(42.dp).semantics {contentDescription="Hantar soalan"},
                            icon="send",height=42.dp,radius=13.dp,enabled=canSubmit)
                    }
                }
            }
            }
            if(overlay!=null) CompositionLocalProvider(LocalBackdrop provides scene) {
                AksaraOverlay(overlay!!, state, onClose={overlay=null}, onNavigate={open(it)},onRefresh=onRefresh,onMode=onMode,onRestore=onRestore,onRestoreSession=onRestoreSession,onClear=onClear,onPickAttachment=onPickAttachment,onMemory=onMemory,onAsk={question->overlay=null;onSend(question);Unit},onVoiceTurns=onVoiceTurns)
            }
        }
    }
}
private fun Modifier.testTagCompat(tag:String) = semantics { testTag=tag }
@Composable fun AksaraChatBubble(message:Message,fixedTimestamp:Long?=null,initial:Boolean=false,
    onCopy:(()->Unit)?=null,onReuse:((String)->Unit)?=null,
    onEdit:(()->Unit)?=null,onBranch:(()->Unit)?=null,onRetry:(()->Unit)?=null) {
    val ai=message.role!="user"
    val measure=rememberTextMeasurer();val density=LocalDensity.current
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val contentWidth=if(ai)maxWidth-37.dp else maxWidth
        val padding=if(ai)26.dp else 24.dp
        val style=AksaraTypography.style(15f,23.85f).copy(letterSpacing=(-.12).sp)
        val textSize=measure.measure(AnnotatedString(message.text),style,constraints=Constraints(maxWidth=with(density){(contentWidth-padding).roundToPx()})).size
        val bubbleWidth=when {message.text.isEmpty()->53.dp;!ai||message.id=="welcome-expanded"->minOf(contentWidth,with(density){textSize.width.toDp()}+padding);else->contentWidth}
        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
            if(ai) Image(painterResource(R.drawable.aksara_portrait),"Aksara A.I.",Modifier.padding(top=1.dp).size(29.dp).clip(RoundedCornerShape(999.dp)).border(1.dp,Color(244,205,137,135),RoundedCornerShape(999.dp)),contentScale=ContentScale.Crop)
            Column(Modifier.weight(1f),horizontalAlignment=if(ai)Alignment.Start else Alignment.End) {
                if(ai) Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(5.dp)) {
                    AksaraIcon("aksara",Modifier.size(14.dp),AksaraColors.gold)
                    AksaraText("Aksara A.I.",size=11f,line=15f,weight=650,color=Color(0xfff2c979))
                    if(!initial && message.id!="welcome-expanded") {
                        AksaraText("·",size=11f,color=AksaraColors.muted)
                        val provider=ProviderIdentity.of(message.provider)
                        if(provider!=null) {
                            AksaraIcon(provider.icon,Modifier.size(13.dp).semantics {
                                contentDescription = provider.name + " AI provider"
                            },Color(0xffb5cce2))
                            AksaraText(provider.name,size=10f,line=14f,color=AksaraColors.muted)
                        } else AksaraText("Belum disahkan",size=9f,line=13f,color=AksaraColors.muted)
                    }
                }
                else Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(9.dp)){Box(Modifier.width(18.dp).height(1.dp).background(AksaraColors.gold));AksaraText("KAU",size=10f,line=13f,weight=700,color=Color(0xfff2c979),tracking=1.4f)}
                Spacer(Modifier.height(if(initial)6.dp else 8.dp))
                AksaraGlassSurface(Modifier.width(bubbleWidth).testTagCompat("bubble"),radius=13.dp,
                    shape=if(ai)RoundedCornerShape(13.dp,13.dp,13.dp,4.dp) else RoundedCornerShape(17.dp,17.dp,5.dp,17.dp),
                    brush=cssGradient(145f,listOf(Color(243,226,198,12),Color(125,165,203,6))),border=Color(240,211,164,87),saturation=1.07f) {
                    val pad=Modifier.padding(horizontal=if(ai)13.dp else 12.dp,vertical=if(initial)12.dp else if(ai)11.dp else 10.dp)
                    if(message.text.isEmpty()) AksaraText("•••",pad,size=15f,line=23f,color=AksaraColors.gold)
                    else if(message.id.startsWith("welcome")||message.text.none {it in "*#`|["}) AksaraText(message.text,pad,size=15f,line=23.85f,tracking=-.12f)
                    else NativeMarkdown(message.text,pad)
                }
                if(message.text.isNotEmpty()) {
                    Spacer(Modifier.height(if(initial)6.dp else 8.dp))
                    val time=Instant.ofEpochMilli(fixedTimestamp?:message.at).atZone(ZoneId.of("Asia/Kuala_Lumpur")).format(DateTimeFormatter.ofPattern("d MMM HH:mm",java.util.Locale.ENGLISH))
                    Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(10.dp)) {
                        AksaraText((if(ai)"Diterima" else "Dihantar")+" · "+time+(if(message.incomplete) " · belum lengkap" else ""),
                            Modifier.padding(horizontal=4.dp),size=10f,line=14f,color=Color(232,215,189,201),tracking=.15f)
                        if(!initial && !message.id.startsWith("welcome") && !message.incomplete) {
                            if(onCopy!=null) AksaraText("Salin",Modifier.clickable{onCopy()},size=10f,line=14f,color=AksaraColors.gold)
                            if(!ai && onReuse!=null) AksaraText("Guna semula",Modifier.clickable{onReuse(message.text)},size=10f,line=14f,color=AksaraColors.gold)
                            if(onEdit!=null) AksaraText("Edit",Modifier.clickable{onEdit()},size=10f,line=14f,color=AksaraColors.gold)
                            if(onBranch!=null) AksaraText("Cabang",Modifier.clickable{onBranch()},size=10f,line=14f,color=AksaraColors.gold)
                            if(ai && onRetry!=null) AksaraText("Jana semula",Modifier.clickable{onRetry()},size=10f,line=14f,color=AksaraColors.gold)
                        }
                    }
                }
            }
        }
    }
}
@Composable private fun NativeMarkdown(value:String,modifier:Modifier) {
    val context=LocalContext.current
    val renderer=remember {Markwon.builder(context).usePlugin(TablePlugin.create(context)).build()}
    AndroidView(modifier=modifier,factory={ ctx -> android.widget.TextView(ctx).apply {
        setTextColor(android.graphics.Color.rgb(255,244,228));textSize=15f
        typeface=ctx.resources.getFont(R.font.dm_sans);fontVariationSettings="'opsz' 14, 'wght' 400";includeFontPadding=false
        paint.isLinearText=true;paint.isSubpixelText=true
        setLineHeight((23.85f*resources.displayMetrics.scaledDensity).toInt());letterSpacing=-.008f;setPadding(0,0,0,0)
        setTextIsSelectable(true);setLinkTextColor(android.graphics.Color.rgb(230,197,139))
        movementMethod=android.text.method.LinkMovementMethod.getInstance()
    }},update={renderer.setMarkdown(it,value)})
}
