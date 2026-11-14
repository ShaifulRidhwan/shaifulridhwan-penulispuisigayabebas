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
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.interaction.DragInteraction
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.*
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.platform.*
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.*
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.chrisbanes.haze.*
import io.noties.markwon.Markwon
import io.noties.markwon.ext.tables.TablePlugin
import my.aksara.nativeapp.R
import my.aksara.nativeapp.feature.today.TodayScreen
import my.aksara.nativeapp.core.linux.AksaraLinuxScreen
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
import kotlinx.coroutines.flow.distinctUntilChanged
import java.time.*
import java.time.format.DateTimeFormatter

/** Only move the chat by the actual overflow, never an arbitrary huge distance. */
internal fun visibleMessageOverflow(
    itemOffset:Int,itemHeight:Int,viewportEnd:Int,afterPadding:Int
):Int=(itemOffset+itemHeight-(viewportEnd-afterPadding)).coerceAtLeast(0)

// Keep the last visible message in step with the animated IME viewport.
// Positive deltas scroll up while the keyboard opens; negative deltas
// scroll down as it closes. Avoid extra scrolling during ordinary relayouts.
internal fun imeViewportFollowDelta(
    previousViewportEnd:Int?, viewportEnd:Int,
    previousImeBottom:Int, imeBottom:Int, following:Boolean
):Int = if (following && previousViewportEnd!=null &&
    (previousImeBottom>0 || imeBottom>0)) previousViewportEnd-viewportEnd else 0

// A passive popup must not ride the keyboard's dismissal animation.
// Editable overlays still use imePadding so search/prompt fields remain visible.
internal fun overlayNeedsImeSpace(kind:String):Boolean = kind in setOf(
    "search-hub","settings","studio","library","novel","knowledge","security","code","terminal"
)

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
    var exportSelectedSessionId by rememberSaveable { mutableStateOf<String?>(null) }
    val exportPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument(SessionTransferCodec.MIME)) { uri ->
        if(uri!=null) scope.launch {
            try {
                val plain=vm.exportSessions(exportSelectedSessionId)
                kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                    context.contentResolver.openOutputStream(uri,"wt")?.use {
                        it.write(plain.toByteArray(Charsets.UTF_8))
                    } ?: error("Fail eksport tidak boleh dibuka.")
                }
                android.widget.Toast.makeText(context,"Arkib JSON dieksport. Simpan fail ini secara peribadi.",android.widget.Toast.LENGTH_LONG).show()
            } catch(e:Exception) { attachmentError="Eksport gagal: "+(e.message?:"cuba lagi") }
        }
    }
    val importPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()) { uri ->
        if(uri!=null) scope.launch {
            try {
                val data=kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                    context.contentResolver.openInputStream(uri)?.use { stream ->
                        val output=java.io.ByteArrayOutputStream()
                        val buffer=ByteArray(8192)
                        while(true) {
                            val count=stream.read(buffer)
                            if(count<0)break
                            require(output.size()+count<=SessionTransferCodec.MAX_BYTES) {
                                "Fail import melebihi 12 MB."
                            }
                            if(count>0)output.write(buffer,0,count)
                        }
                        output.toString("UTF-8")
                    } ?: error("Fail import tidak boleh dibuka.")
                }
                val count=vm.importSessions(data)
                android.widget.Toast.makeText(context,"$count sesi berjaya diimport. Buka Arkib Sesi.",android.widget.Toast.LENGTH_LONG).show()
            } catch(e:Exception) { attachmentError="Import gagal: "+(e.message?:"format tidak sah") }
        }
    }
    var pendingRemoteSelection by remember { mutableStateOf<List<Uri>>(emptyList()) }
    fun beginAttachmentRead(uris:List<Uri>) {
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
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
        if(uris.isNotEmpty() && !attachmentLoading) {
            val requiresApproval=uris.any { uri ->
                runCatching {
                    AttachmentReader.needsLargeUpload(AttachmentReader.inspect(context,uri))
                }.getOrDefault(true) // Fail closed when a provider cannot be inspected.
            }
            if(requiresApproval) pendingRemoteSelection=uris
            else beginAttachmentRead(uris)
        }
    }
    val pagerState = rememberPagerState(initialPage=1,pageCount={3})
    var overlayVisible by remember { mutableStateOf(false) }
    var todayDialogVisible by remember { mutableStateOf(false) }
    var linuxDialogVisible by remember { mutableStateOf(false) }
    // Do not recompose the whole pager for each IME animation pixel.
    val imeDensity=LocalDensity.current
    // WindowInsets.ime is composable: resolve it before entering derivedStateOf.
    val pagerImeInsets=WindowInsets.ime
    val keyboardOpen by remember(imeDensity,pagerImeInsets) {
        derivedStateOf { pagerImeInsets.getBottom(imeDensity)>0 }
    }
    HorizontalPager(
        state=pagerState,
        modifier=Modifier.fillMaxSize(),
        beyondViewportPageCount=1,
        userScrollEnabled=!overlayVisible && !todayDialogVisible && !linuxDialogVisible && !keyboardOpen
    ) { page ->
      if(page==0) {
        TodayScreen(active=pagerState.currentPage==0,onBack={
            scope.launch {
                pagerState.animateScrollToPage(
                    1,animationSpec=androidx.compose.animation.core.spring(
                        dampingRatio=.85f,
                        stiffness=androidx.compose.animation.core.Spring.StiffnessMedium
                    )
                )
            }
        },onDialogVisibilityChange={todayDialogVisible=it})
      } else if (page == 2) {
        // HorizontalPager precomposes adjacent pages. Never start a native Linux
        // PTY (or run Linux first-setup checks) during the initial Chat launch.
        // Mount Linux as soon as a swipe towards it begins, or it is targeted.
        // The activity-scoped ViewModel retains live PTYs when this page unmounts.
        val linuxEntering = pagerState.currentPage == 2 ||
            pagerState.targetPage == 2 ||
            (pagerState.currentPage == 1 && pagerState.currentPageOffsetFraction > 0f)
        if (linuxEntering) {
            AksaraLinuxScreen(onBack={ scope.launch { pagerState.animateScrollToPage(1) } },
                onDialogVisibilityChange={ linuxDialogVisible=it })
        }
      } else {
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
        onExportSessions = {
            exportSelectedSessionId = null
            exportPicker.launch("aksara-sesi.json")
        },
        onExportSession = { startId ->
            exportSelectedSessionId = startId
            exportPicker.launch(if (startId == null) "aksara-sesi.json" else "aksara-sesi-pilihan.json")
        },
        onDeleteSession = vm::deleteSession,
        onImportSessions = { importPicker.launch(arrayOf("application/json","text/plain")) },
        onEditAndSend = vm::forkAndSendFrom, onBranch = vm::forkFrom, onRegenerate = vm::regenerateFrom,
        onSaveDraft = vm::saveOfflineDraft, onRemoveDraft = vm::removeOfflineDraft,
        onEraseLocal = vm::eraseLocalData,
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
        onDismissError = { attachmentError = null; vm.dismissError() },
        onOverlayVisibilityChange = { overlayVisible=it })
      }
    }

    // A document-picker selection is not consent for uploading multi-megabyte
    // files to a remote provider. Obtain a second explicit approval first.
    if(pendingRemoteSelection.isNotEmpty()) {
        Dialog(onDismissRequest={pendingRemoteSelection=emptyList()}) {
            val localBackdrop=remember{HazeState()}
            CompositionLocalProvider(LocalBackdrop provides localBackdrop) {
                AksaraGlassSurface(Modifier.fillMaxWidth(),radius=22.dp,blur=18.dp) {
                    Column(Modifier.fillMaxWidth().padding(16.dp)) {
                        AksaraText("Muat naik fail besar",size=17f,weight=650)
                        Spacer(Modifier.height(8.dp))
                        AksaraText("Fail yang dipilih mungkin dihantar ke Gemini Files untuk dianalisis. Ia tidak akan dimuat naik sehingga kau benarkan. Jangan pilih dokumen sensitif tanpa keperluan.",
                            size=12f,line=19f,color=AksaraColors.muted)
                        Spacer(Modifier.height(13.dp))
                        Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                            AksaraButton("Batal",{pendingRemoteSelection=emptyList()},
                                Modifier.weight(1f),height=38.dp,size=11f)
                            AksaraButton("Benarkan upload",{
                                val selected=pendingRemoteSelection
                                pendingRemoteSelection=emptyList()
                                beginAttachmentRead(selected)
                            },Modifier.weight(1f),height=38.dp,size=10.5f)
                        }
                    }
                }
            }
        }
    }
}

@Composable fun AksaraScreen(state: ChatState, onSend: (String)->Boolean = {true}, onStop: ()->Unit = {}, onRefresh: ()->Unit = {},
    onJourney: (String)->Unit = { onSend(it); Unit }, onMode: (String)->Unit = {}, onRestore: ()->Unit = {}, onRestoreSession: (String)->Unit = {}, onClear: ()->Unit = {}, attachmentName: String? = null,
    onPickAttachment: (String)->Unit = {}, onDismissError: ()->Unit = {}, onMemory: (Boolean,String)->Unit = {_,_->}, onClearAttachment: ()->Unit = {}, initialOverlay: String? = null,
    attachmentLoading: Boolean = false,
    uploadStatus: String? = null, onCancelUpload: ()->Unit = {},
    onEditAndSend: (String,String)->Boolean = {_,_->false},
    onBranch: (String)->Boolean = {false}, onRegenerate: (String)->Boolean = {false},
    onExportSessions: ()->Unit = {}, onImportSessions: ()->Unit = {},
    onExportSession: (String?)->Unit = {}, onDeleteSession: suspend (String)->Boolean = { false },
    onSaveDraft: suspend(String)->Boolean = { false },
    onRemoveDraft: suspend(String)->Boolean = { false },
    onEraseLocal: suspend()->Boolean = { false },
    fixedTimestamp: Long? = null, onVoiceTurns:(List<my.aksara.engine.voice.VoiceContextTurn>)->Unit = {},
    onOverlayVisibilityChange:(Boolean)->Unit = {}) {
    val backdrop = remember { HazeState() }; val scene = remember { HazeState() }
    var overlay by rememberSaveable { mutableStateOf(initialOverlay) }
    var agenticMissionVisible by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(overlay) { onOverlayVisibilityChange(overlay!=null) }
    var voiceIndicator by remember { mutableStateOf(VoiceLinkState.IDLE) }
    var draft by rememberSaveable { mutableStateOf("") }
    var editingId by rememberSaveable { mutableStateOf<String?>(null) }
    var selectedResponseId by remember { mutableStateOf<String?>(null) }
    val jumpScope = rememberCoroutineScope()
    var pendingJumpId by remember { mutableStateOf<String?>(null) }
    var highlightedMessageId by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    val margins = aksaraDeviceMargins()
    val focus = LocalFocusManager.current
    val list = rememberLazyListState()
    var autoFollow by remember { mutableStateOf(true) }
    // Track only visibility transitions; the keyboard animates its insets every frame.
    // Pixel-by-pixel effect restarts caused expensive repeated LazyColumn scrolling.
    val imeDensity=LocalDensity.current
    val chatImeInsets=WindowInsets.ime
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
    // Avoid per-pixel scrollBy during IME animation. Each call forces LazyColumn
    // measurement while the keyboard is resizing the viewport. Compose's
    // imePadding already follows the keyboard; settle only after visibility flips.
    LaunchedEffect(list, chatImeInsets, imeDensity) {
        snapshotFlow { chatImeInsets.getBottom(imeDensity) > 0 }
            .distinctUntilChanged()
            .collect { opening ->
                if (opening && autoFollow && state.messages.isNotEmpty()) {
                    withFrameNanos { }
                    val last = list.layoutInfo.totalItemsCount - 1
                    if (last >= 0 && list.layoutInfo.visibleItemsInfo.none { it.index == last }) {
                        list.scrollToItem(last)
                    }
                }
            }
    }
    LaunchedEffect(state.messages.size, state.messages.lastOrNull()?.text?.length,
        state.busy, autoFollow) {
        if (autoFollow && state.messages.isNotEmpty()) {
            withFrameNanos { }
            val last = list.layoutInfo.totalItemsCount - 1
            if (last >= 0) {
                // A 100,000px scroll on every streamed token/IME transition can
                // force excessive lazy-list measuring. Scroll only the visible delta.
                if (list.layoutInfo.visibleItemsInfo.none { it.index == last }) {
                    list.scrollToItem(last)
                }
                val visibleLast = list.layoutInfo.visibleItemsInfo.lastOrNull { it.index == last }
                if (visibleLast != null) {
                    val overflow = visibleMessageOverflow(
                        visibleLast.offset,visibleLast.size,
                        list.layoutInfo.viewportEndOffset,list.layoutInfo.afterContentPadding
                    )
                    if (overflow > 0) list.scrollBy(overflow.toFloat())
                }
            }
        }
    }
    LaunchedEffect(pendingJumpId, if(pendingJumpId==null) null else state.messages.map { it.id }) {
        val id = pendingJumpId ?: return@LaunchedEffect
        val target = state.messages.indexOfFirst { it.id == id }
        if (target >= 0) {
            autoFollow = false
            withFrameNanos { }
            list.scrollToItem(target + 1)
            highlightedMessageId = id
            pendingJumpId = null
        }
    }
    LaunchedEffect(highlightedMessageId) {
        if (highlightedMessageId != null) {
            kotlinx.coroutines.delay(2000)
            highlightedMessageId = null
        }
    }
    val keyboard = LocalSoftwareKeyboardController.current
    fun open(value: String) {
        focus.clearFocus(); keyboard?.hide()
        if(value=="voice") voiceIndicator=VoiceLinkState.CONNECTING
        overlay = value
    }
    BackHandler(overlay != null) {
        if(overlay=="voice") voiceIndicator=VoiceLinkState.IDLE
        overlay = null
    }
    CompositionLocalProvider(LocalBackdrop provides backdrop) {
        // Keep the cinematic wallpaper and backdrop at a stable viewport size.
        // Only the actual content (and open overlays) follows the keyboard inset.
        BoxWithConstraints(Modifier.fillMaxSize().testTagCompat("app")) {
            val viewportHeight = maxHeight
            Box(Modifier.fillMaxSize().hazeSource(scene)) {
            ChatWallpaper(Modifier.fillMaxSize().hazeSource(backdrop))
            Column(Modifier.fillMaxSize().imePadding().safeDrawingPadding()
                .padding(start=margins.horizontal,end=margins.horizontal,
                    top=margins.top,bottom=margins.bottom)) {
                Spacer(Modifier.height(5.dp))
                AksaraGlassSurface(Modifier.fillMaxWidth().height(58.dp).testTagCompat("topbar"), radius=20.dp, blur=12.dp,
                    brush=cssGradient(115f,listOf(Color(8,14,24,102),Color(17,26,40,51))),saturation=1.15f, border=Color.Transparent) {
                    Row(Modifier.fillMaxSize().padding(horizontal=10.dp), verticalAlignment=Alignment.CenterVertically) {
                        AksaraGlassSurface(Modifier.height(31.dp)
                            .clickable { open("context-status") }
                            .semantics { contentDescription="Lihat konteks sesi Aksara" },
                            radius=13.dp) {
                            Row(
                                Modifier.align(Alignment.Center).padding(horizontal=7.dp),
                                verticalAlignment=Alignment.CenterVertically,
                                horizontalArrangement=Arrangement.spacedBy(5.dp)
                            ) {
                                Row(
                                    verticalAlignment=Alignment.CenterVertically,
                                    horizontalArrangement=Arrangement.spacedBy(1.dp)
                                ) {
                                    AksaraText("AKSARA A.",size=10f,line=12f,weight=650)
                                    AksaraIcon("info",Modifier.size(11.dp).offset(y=.5.dp),AksaraColors.gold)
                                }
                                AksaraText("oleh Shaiful Ridhwan",size=8.5f,line=12f,
                                    weight=450,color=Color(233,198,141,212))
                            }
                        }
                        Spacer(Modifier.weight(1f))
                        Row(horizontalArrangement=Arrangement.spacedBy(6.dp),verticalAlignment=Alignment.CenterVertically) {
                            AksaraButton("",{open("search-hub")},Modifier.width(44.dp)
                                .semantics {contentDescription="Carian, sesi dan memori"},
                                icon="search",height=44.dp,radius=13.dp,iconSize=19.dp,contentColor=AksaraColors.gold)
                            AksaraButton("",{open("portal")},Modifier.width(44.dp)
                                .semantics {contentDescription="Explore"},
                                icon="grid",height=44.dp,radius=13.dp,iconSize=19.dp,contentColor=AksaraColors.gold)
                            AksaraButton("",{open("settings")},Modifier.width(44.dp)
                                .semantics {contentDescription="Settings"},
                                icon="settings",height=44.dp,radius=13.dp,iconSize=19.dp,contentColor=AksaraColors.gold)
                        }
                    }
                }
                Box(Modifier.weight(1f).padding(top=viewportHeight*.011f)) {
                    AksaraGlassSurface(Modifier.fillMaxSize().testTagCompat("conversation"),radius=22.dp,blur=.5.dp,saturation=1.06f,
                        brush=Brush.linearGradient(listOf(Color(15,17,25,51),Color(10,14,25,33),Color(7,10,18,56))),border=Color.Transparent) {
                        Column(Modifier.fillMaxSize().padding(1.dp)) {
                            BoxWithConstraints(Modifier.fillMaxWidth().height(58.dp).testTagCompat("conversation-head")) {
                                val headerWidth=maxWidth
                                val compact=headerWidth<390.dp
                                val headerPaint=remember{HazeState()}
                                Box(Modifier.matchParentSize().hazeSource(headerPaint).background(Brush.horizontalGradient(listOf(Color(20,18,21,64),Color(5,8,17,56)))))
                                CompositionLocalProvider(LocalBackdropPaints provides listOf(headerPaint)) {
                                Row(Modifier.fillMaxSize().padding(horizontal=if(compact)5.dp else 8.dp,vertical=8.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(if(compact)3.dp else 4.dp)) {
                                    ReactiveVoiceChip(voiceIndicator,compact) {open("voice-permission")}
                                    Spacer(Modifier.weight(1f))
                                    // Dedicated delegated-flow icon and shared capsule glass tokens.
                                    // Keep Agent immediately adjacent to Multi A.I; Voice remains on the left.
                                    AksaraGlassSurface(
                                        Modifier.width(if(headerWidth<350.dp)75.dp else if(compact)85.dp else 100.dp)
                                            .height(AksaraGlassTokens.capsuleHeight)
                                            .aksaraBouncyClick(onClick={agenticMissionVisible=true})
                                            .semantics {
                                                contentDescription="Buka Agentic Runtime"
                                                testTag="agent-status-chip"
                                            },
                                        radius=AksaraGlassTokens.capsuleRadius,
                                        blur=AksaraGlassTokens.capsuleBlur
                                    ) {
                                        Row(Modifier.align(Alignment.Center),
                                            horizontalArrangement=Arrangement.spacedBy(5.dp),
                                            verticalAlignment=Alignment.CenterVertically) {
                                            AksaraIcon("compass-core",Modifier.size(17.dp),AksaraColors.gold)
                                            AksaraText("Agent",size=if(compact)9.5f else 10f,
                                                line=13f,weight=600)
                                        }
                                    }
                                    AksaraGlassSurface(
                                        Modifier.width(if(headerWidth<350.dp)137.dp else if(compact)151.dp else 167.dp)
                                            .height(AksaraGlassTokens.capsuleHeight)
                                            .clickable {open("connection")}
                                            .semantics {contentDescription="Connection"},
                                        radius=AksaraGlassTokens.capsuleRadius,
                                        blur=AksaraGlassTokens.capsuleBlur
                                    ) {
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
                                            AksaraText(compactStatus,size=if(compactStatus.length>10)8.5f else 9.5f,line=12f,weight=600,
                                                color=ProviderStatusPalette.color(connectionStatus))
                                        }
                                    }
                                }
                                }
                                Box(Modifier.align(Alignment.BottomCenter).fillMaxWidth().height(1.dp).background(Color(235,215,185,35)))
                            }
                            if(state.busy) Row(Modifier.fillMaxWidth().height(42.dp)
                                .background(Color(15,18,26,40))
                                .padding(horizontal=15.dp,vertical=10.dp),
                                verticalAlignment=Alignment.CenterVertically,
                                horizontalArrangement=Arrangement.spacedBy(7.dp)) {
                                AksaraIcon("activity",Modifier.size(15.dp),AksaraColors.gold)
                                AksaraText(ChatResponseLifecycle.label(state.responsePhase)
                                    .ifBlank { "Memproses permintaan" },
                                    Modifier.weight(1f),size=11f,line=16f,color=Color(0xffd9c8b0))
                                AksaraText("Status sebenar",size=9f,line=13f,color=AksaraColors.muted)
                            }
                            Box(Modifier.weight(1f).fillMaxWidth()) {
                            LazyColumn(Modifier.fillMaxSize().testTagCompat("messages"),state=list,contentPadding=PaddingValues(start=if(state.messages.isEmpty())17.dp else 12.dp,end=if(state.messages.isEmpty())17.dp else 12.dp,top=if(state.messages.isEmpty())14.dp else 13.dp,bottom=13.dp),verticalArrangement=Arrangement.spacedBy(14.dp)) {
                                if(state.messages.isEmpty()) item { AksaraChatBubble(Message("welcome","assistant",WelcomeText,fixedTimestamp?:System.currentTimeMillis()),fixedTimestamp=fixedTimestamp,initial=true) }
                                if(state.messages.isNotEmpty()) item { AksaraChatBubble(Message("welcome-expanded","assistant","Antara aksara dan code,\nGAYA yang bebas,\nBEBAS dalam bentuk,\nLUAS dalam pemikiran.",fixedTimestamp?:state.messages.first().at),fixedTimestamp=fixedTimestamp) }
                                items(state.messages,key={it.id},contentType={it.role}) { message ->
                                    AksaraChatBubble(message,fixedTimestamp=fixedTimestamp,
                                        highlighted=highlightedMessageId==message.id,
                                        onCopy={
                                            val clipboard=context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                            clipboard.setPrimaryClip(ClipData.newPlainText("Aksara A.I.",message.text))
                                        },
                                        onReuse={draft=it.substringBefore("\n\n[Lampiran: ");editingId=null;autoFollow=true},
                                        onEdit=if(message.role=="user" && !message.incomplete &&
                                            !message.text.contains("[Lampiran: ") && !state.busy) ({
                                            editingId=message.id;draft=message.text;autoFollow=true
                                        }) else null,
                                        onDetails=if(message.role=="assistant" && !message.incomplete &&
                                            !state.busy && message.provider != null) ({
                                            selectedResponseId=message.id
                                            open("response-details")
                                        }) else null,
                                        onBranch=if(!state.busy && !message.incomplete) ({
                                            if(onBranch(message.id)) { editingId=null;draft="";autoFollow=true }
                                        }) else null,
                                        onRetry=if(message.role=="assistant" && message.id==state.messages.lastOrNull()?.id && !state.busy)
                                            ({if(onRegenerate(message.id)){editingId=null;draft="";autoFollow=true};Unit}) else null)
                                }
                            }
                            if(!autoFollow && list.canScrollForward && state.messages.isNotEmpty()) {
                                AksaraButton("Ke mesej terkini",{
                                    autoFollow=true
                                    jumpScope.launch {
                                        val last=(list.layoutInfo.totalItemsCount-1).coerceAtLeast(0)
                                        list.scrollToItem(last)
                                    }
                                },Modifier.align(Alignment.BottomEnd)
                                    .padding(end=12.dp,bottom=8.dp)
                                    .testTagCompat("chat-jump-latest"),
                                    size=10f,height=35.dp,radius=999.dp)
                            }
                            }
                            if(state.messages.isEmpty()) Row(
                                Modifier.fillMaxWidth().height(60.dp).padding(horizontal=12.dp,vertical=4.dp),
                                horizontalArrangement=Arrangement.spacedBy(9.dp),
                                verticalAlignment=Alignment.CenterVertically) {
                                AksaraGlassSurface(
                                    Modifier.width(103.dp).height(44.dp).clickable { onJourney("Siapa Aku") },
                                    radius=999.dp,blur=9.dp,
                                    brush=cssGradient(145f,listOf(Color(244,216,171,9),Color(12,20,35,16))),
                                    border=AksaraColors.border
                                ) {
                                    Row(Modifier.align(Alignment.Center),verticalAlignment=Alignment.CenterVertically,
                                        horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                                        AksaraText("↗",size=12f,color=AksaraColors.gold)
                                        AksaraText("Siapa Aku",size=11.5f)
                                    }
                                }
                            }
                            if(state.nextJourney!=null) AksaraButton(state.nextJourney,{onJourney(state.nextJourney)},Modifier.padding(horizontal=12.dp,vertical=4.dp),size=11.5f,height=37.dp,radius=999.dp,leadingText="↗")
                            if(state.error!=null) Row(Modifier.fillMaxWidth().padding(8.dp),
                                verticalAlignment=Alignment.CenterVertically,
                                horizontalArrangement=Arrangement.spacedBy(7.dp)) {
                                AksaraText(state.error,Modifier.weight(1f),size=10.5f,color=Color(0xffe7a08e))
                                val incomplete=state.messages.lastOrNull()
                                if(!state.busy && incomplete?.role=="assistant" && incomplete.incomplete) {
                                    AksaraButton("Cuba semula",{
                                        if(onRegenerate(incomplete.id)) {
                                            editingId=null; draft=""; autoFollow=true
                                        }
                                    },height=31.dp,size=10f,radius=12.dp)
                                }
                                AksaraText("×",Modifier.clickable(onClick=onDismissError)
                                    .padding(3.dp),size=17f,color=AksaraColors.gold)
                            }
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
                            .semantics {contentDescription="Tulis mesej untuk Aksara A.I."}
                            .testTagCompat("input"),
                            textStyle=AksaraTypography.style(16f,24f),
                            cursorBrush=SolidColor(AksaraColors.gold))
                        if(state.busy) AksaraButton("Henti",onStop,Modifier.width(56.dp)
                            .semantics {contentDescription="Hentikan respons"},size=12f,height=40.dp,radius=12.dp)
                        ReactiveThinkingButton(
                            processing=ThinkingActivity.awaitingFirstReply(state),
                            mode=state.mode,onClick={open("thinking")})
                        ReactiveSendButton(enabled=canSubmit) {
                            val text=AttachmentSendPolicy.submissionText(draft,hasAttachments)
                            val accepted=editingId?.let {onEditAndSend(it,text)} ?: onSend(text)
                            if(accepted) {draft="";editingId=null;autoFollow=true}
                        }
                    }
                }
            }
            }
            if(overlay!=null) CompositionLocalProvider(LocalBackdrop provides scene) {
                Box(Modifier.fillMaxSize().then(
                    if(overlayNeedsImeSpace(overlay!!)) Modifier.imePadding() else Modifier
                )) {
                AksaraOverlay(overlay!!, state, onClose={
                    if(overlay=="voice") voiceIndicator=VoiceLinkState.IDLE
                    overlay=null
                }, onNavigate={open(it)},onRefresh=onRefresh,onMode=onMode,onRestore=onRestore,onRestoreSession=onRestoreSession,onClear=onClear,onPickAttachment=onPickAttachment,onMemory=onMemory,onAsk={question->overlay=null;onSend(question);Unit},onVoiceTurns=onVoiceTurns,
                    onExportSessions=onExportSessions,onImportSessions=onImportSessions,
                    onExportSession=onExportSession,onDeleteSession=onDeleteSession,
                    composerDraft=draft,onSaveDraft=onSaveDraft,onRemoveDraft=onRemoveDraft,
                    onUseDraft={pending->draft=pending;editingId=null;overlay=null;autoFollow=true},
                    onEraseLocal=onEraseLocal,
                    onJumpToMessage={id->pendingJumpId=id},
                    onVoiceState={phase,ready->voiceIndicator=VoiceLinkState.from(phase,ready)},
                    selectedAnswer=state.messages.firstOrNull { it.id==selectedResponseId },
                    selectedAttachmentNames=attachmentName)
                }
            }
        }
    }
    if(agenticMissionVisible) AgenticMissionDialog(onClose={agenticMissionVisible=false})
}
private fun Modifier.testTagCompat(tag:String) = semantics { testTag=tag }
private val ChatTimestampFormatter = DateTimeFormatter.ofPattern("d MMM HH:mm",java.util.Locale.ENGLISH)
    .withZone(ZoneId.of("Asia/Kuala_Lumpur"))
@Composable fun AksaraChatBubble(message:Message,fixedTimestamp:Long?=null,initial:Boolean=false,highlighted:Boolean=false,
    onCopy:(()->Unit)?=null,onReuse:((String)->Unit)?=null,
    onEdit:(()->Unit)?=null,onBranch:(()->Unit)?=null,
    onDetails:(()->Unit)?=null,onRetry:(()->Unit)?=null) {
    val ai=message.role!="user"
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val contentWidth=maxWidth
        val bubbleWidth=when {
            message.text.isEmpty()->53.dp
            !ai||message.id=="welcome-expanded"->{
                // Only content-sized bubbles need this additional width measurement.
                // Ordinary assistant bubbles already occupy the available width.
                val measure=rememberTextMeasurer();val density=LocalDensity.current
                val padding=if(ai)26.dp else 24.dp
                val style=AksaraTypography.style(15f,23.85f).copy(letterSpacing=(-.12).sp)
                val textSize=remember(message.text,contentWidth,density,style) {
                    measure.measure(AnnotatedString(message.text),style,
                        constraints=Constraints(maxWidth=with(density){(contentWidth-padding).roundToPx()})).size
                }
                minOf(contentWidth,with(density){textSize.width.toDp()}+padding)
            }
            else->contentWidth
        }
        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
            Column(Modifier.weight(1f),horizontalAlignment=if(ai)Alignment.Start else Alignment.End) {
                if(ai) Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(5.dp)) {
                    AksaraBrandAvatar()
                    AksaraText("Aksara A.I.",size=11f,line=15f,weight=650,color=Color(0xfff2c979))
                    if(!initial && message.id!="welcome-expanded") {
                        AksaraText("→",size=12f,color=AksaraColors.gold)
                        val provider=ProviderIdentity.of(message.provider)
                        if(provider!=null) {
                            val providerColor=when(provider.id) {
                                "gemini"->Color(0xff96baff)
                                "groq"->Color(0xfff5b97e)
                                "workers_ai"->Color(0xffffb57c)
                                "openrouter"->Color(0xffc3acf4)
                                else->Color(0xffd5d9e3)
                            }
                            AksaraIcon(provider.icon,Modifier.size(15.dp).semantics {
                                contentDescription = "Melalui "+provider.name+" AI provider"
                            },providerColor)
                            AksaraText(provider.name,size=10f,line=14f,color=AksaraColors.muted)
                        } else AksaraText("Belum disahkan",size=9f,line=13f,color=AksaraColors.muted)
                    }
                }
                else Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(9.dp)){Box(Modifier.width(18.dp).height(1.dp).background(AksaraColors.gold));AksaraText("KAU",size=10f,line=13f,weight=700,color=Color(0xfff2c979),tracking=1.4f)}
                Spacer(Modifier.height(if(initial)6.dp else 8.dp))
                AksaraGlassSurface(Modifier.width(bubbleWidth).testTagCompat("bubble"),radius=13.dp,
                    shape=if(ai)RoundedCornerShape(13.dp,13.dp,13.dp,4.dp) else RoundedCornerShape(17.dp,17.dp,5.dp,17.dp),
                    brush=cssGradient(145f,listOf(Color(243,226,198,12),Color(125,165,203,6))),border=if(highlighted)Color(255,216,140,235) else Color(240,211,164,87),saturation=1.07f) {
                    val pad=Modifier.padding(horizontal=if(ai)13.dp else 12.dp,vertical=if(initial)12.dp else if(ai)11.dp else 10.dp)
                    if(message.text.isEmpty()) AksaraText("•••",pad,size=15f,line=23f,color=AksaraColors.gold)
                    else if(message.id.startsWith("welcome")||message.text.none {it in "*#`|["}) AksaraText(message.text,pad,size=15f,line=23.85f,tracking=-.12f)
                    else NativeMarkdown(message.text,pad)
                }
                if(message.text.isNotEmpty()) {
                    Spacer(Modifier.height(if(initial)6.dp else 8.dp))
                    val time=remember(fixedTimestamp,message.at) {
                        ChatTimestampFormatter.format(Instant.ofEpochMilli(fixedTimestamp?:message.at))
                    }
                    FlowRow(horizontalArrangement=Arrangement.spacedBy(9.dp),
                        verticalArrangement=Arrangement.spacedBy(4.dp)) {
                        AksaraText((if(ai)"Diterima" else "Dihantar")+" · "+time+(if(message.incomplete) " · belum lengkap" else ""),
                            Modifier.padding(horizontal=4.dp),size=10f,line=14f,color=Color(232,215,189,201),tracking=.15f)
                        if(!initial && !message.id.startsWith("welcome") && !message.incomplete) {
                            if(onCopy!=null) AksaraText("Salin",Modifier.clickable{onCopy()},size=10f,line=14f,color=AksaraColors.gold)
                            if(!ai && onReuse!=null) AksaraText("Guna semula",Modifier.clickable{onReuse(message.text)},size=10f,line=14f,color=AksaraColors.gold)
                            if(onEdit!=null) AksaraText("Edit",Modifier.clickable{onEdit()},size=10f,line=14f,color=AksaraColors.gold)
                            if(onDetails!=null) AksaraText("Butiran",Modifier.clickable{onDetails()},size=10f,line=14f,color=AksaraColors.gold)
                            if(onBranch!=null) AksaraText("Cabang",Modifier.clickable{onBranch()},size=10f,line=14f,color=AksaraColors.gold)
                            if(ai && onRetry!=null) AksaraText("Jana semula",Modifier.clickable{onRetry()},size=10f,line=14f,color=AksaraColors.gold)
                        }
                    }
                }
            }
        }
    }
}
/** Restored Aksara identity: a small circular avatar, independent of provider provenance. */
@Composable private fun AksaraBrandAvatar() {
    val shape=CircleShape
    Box(Modifier.size(29.dp).clip(shape)) {
        Image(painter=painterResource(R.drawable.aksara_icon_transparent),
            contentDescription="Aksara A.I. circular avatar",modifier=Modifier.fillMaxSize(),
            contentScale=ContentScale.FillBounds)
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
    }},update={ view ->
        if (view.tag != value) {
            renderer.setMarkdown(view,value)
            view.tag=value
        }
    })
}
