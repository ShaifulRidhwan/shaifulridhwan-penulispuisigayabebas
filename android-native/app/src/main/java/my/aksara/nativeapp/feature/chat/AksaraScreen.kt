package my.aksara.nativeapp.feature.chat

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.*
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
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.font.FontWeight
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
import kotlinx.coroutines.launch
import java.time.*
import java.time.format.DateTimeFormatter

const val WelcomeText = "Antara aksara dan code, GAYA yang bebas, BEBAS dalam bentuk, LUAS dalam pemikiran."
@Composable fun AksaraApp(vm: ChatViewModel = viewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var attachment by remember { mutableStateOf<Pair<String, String>?>(null) }
    var attachmentError by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if(uri != null) scope.launch {
            try {
                val bytes = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) { context.contentResolver.openInputStream(uri)!!.use { it.readNBytes(100_001) } }
                require(bytes.size<=100_000) { "Dokumen teks melebihi had 100 KB." }
                require(!bytes.contains(0)) { "Pembaca fail binari ini belum diintegrasi. Pilih TXT, MD, CSV, JSON atau kod teks." }
                attachment = (uri.lastPathSegment?.substringAfterLast('/') ?: "dokumen.txt") to bytes.toString(Charsets.UTF_8)
            } catch(e: Exception) { attachmentError = e.message }
        }
    }
    AksaraScreen(state.copy(error = attachmentError ?: state.error), onSend = { q -> vm.send(q, attachment?.second.orEmpty(), attachment?.first.orEmpty()); attachment = null },
        onStop = vm::stop, onRefresh = { vm.refreshProviders() }, onMode = vm::setMode,
        onRestore = vm::restore, onClear = vm::clearScreen, attachmentName = attachment?.first,
        onPickAttachment = { picker.launch(arrayOf("text/*", "application/json", "application/pdf", "image/*", "audio/*", "video/*")) },
        onDismissError = { attachmentError = null; vm.dismissError() })
}

@Composable fun AksaraScreen(state: ChatState, onSend: (String)->Unit = {}, onStop: ()->Unit = {}, onRefresh: ()->Unit = {},
    onMode: (String)->Unit = {}, onRestore: ()->Unit = {}, onClear: ()->Unit = {}, attachmentName: String? = null,
    onPickAttachment: ()->Unit = {}, onDismissError: ()->Unit = {}, initialOverlay: String? = null,
    fixedTimestamp: Long? = null) {
    val backdrop = remember { HazeState() }; val scene = remember { HazeState() }
    var overlay by rememberSaveable { mutableStateOf(initialOverlay) }
    var draft by rememberSaveable { mutableStateOf("") }
    val context = LocalContext.current
    val focus = LocalFocusManager.current
    val list = rememberLazyListState()
    val keyboard = LocalSoftwareKeyboardController.current
    fun open(value: String) { focus.clearFocus(); keyboard?.hide(); overlay = value }
    BackHandler(overlay != null) { overlay = null }
    CompositionLocalProvider(LocalBackdrop provides backdrop) {
        BoxWithConstraints(Modifier.fillMaxSize().imePadding().testTagCompat("app")) {
            val viewportHeight = maxHeight
            AksaraBackground(Modifier.fillMaxSize().hazeSource(backdrop))
            Column(Modifier.fillMaxSize().hazeSource(scene)) {
                Spacer(Modifier.height(10.dp))
                AksaraGlassSurface(Modifier.fillMaxWidth().height(50.dp), radius=17.dp, blur=12.dp,
                    brush=Brush.linearGradient(listOf(Color(8,14,24,102),Color(17,26,40,51))), border=Color(247,226,196,64)) {
                    Row(Modifier.fillMaxSize().padding(horizontal=10.dp), verticalAlignment=Alignment.CenterVertically) {
                        AksaraGlassSurface(Modifier.height(31.dp), radius=13.dp) {
                            Row(Modifier.align(Alignment.Center).padding(horizontal=7.dp), verticalAlignment=Alignment.Bottom, horizontalArrangement=Arrangement.spacedBy(3.dp)) {
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
                Box(Modifier.weight(1f).padding(start=7.dp,end=7.dp,top=viewportHeight*.011f,bottom=7.dp)) {
                    AksaraGlassSurface(Modifier.fillMaxSize(),radius=18.dp,blur=3.dp,
                        brush=Brush.linearGradient(listOf(Color(15,17,25,51),Color(10,14,25,33),Color(7,10,18,56))),border=Color(253,214,150,145)) {
                        Column(Modifier.fillMaxSize().padding(1.dp)) {
                            BoxWithConstraints(Modifier.fillMaxWidth().height(54.dp).background(Brush.horizontalGradient(listOf(Color(20,18,21,64),Color(5,8,17,56))))) {
                                val compact=maxWidth<390.dp
                                Row(Modifier.fillMaxSize().padding(horizontal=if(compact)5.dp else 8.dp,vertical=8.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(if(compact)3.dp else 4.dp)) {
                                    AksaraButton("Voice Chat",{open("voice-permission")},Modifier.width(if(compact)82.328.dp else 93.484.dp),icon="voice",size=if(compact)9f else 10f,height=37.dp,radius=999.dp)
                                    AksaraButton("",{open("code")},Modifier.width(38.dp).semantics {contentDescription="Code Engine"},icon="code",height=37.dp,radius=999.dp)
                                    AksaraButton("",{open("terminal")},Modifier.width(38.dp).semantics {contentDescription="Terminal"},icon="terminal",height=37.dp,radius=999.dp)
                                    AksaraGlassSurface(Modifier.weight(1f).height(37.dp).clickable {open("connection")}.semantics {contentDescription="Connection"},radius=999.dp,blur=9.dp) {
                                        Row(Modifier.fillMaxSize().padding(horizontal=4.dp),verticalAlignment=Alignment.CenterVertically) {
                                            AksaraIcon("network",Modifier.size(15.dp),Color(0xffc1b393))
                                            val online=state.providers.count { it.second=="online" }
                                            val text=if(state.providers.isEmpty()) "Unverified" else if(online==4) "Connected" else if(online>0) "Degraded" else "Unverified"
                                            Box(Modifier.weight(1f),contentAlignment=Alignment.Center) {AksaraText(text,size=9f,line=11.25f,weight=600)}
                                        }
                                    }
                                }
                            }
                            Box(Modifier.fillMaxWidth().height(1.dp).background(Color(235,215,185,35)))
                            LaunchedEffect(state.messages.lastOrNull()?.text) { if(state.messages.isNotEmpty() && (list.layoutInfo.totalItemsCount<3 || list.canScrollForward.not())) list.animateScrollToItem(state.messages.lastIndex) }
                            LazyColumn(Modifier.weight(1f).fillMaxWidth().testTagCompat("messages"),state=list,contentPadding=PaddingValues(start=17.dp,end=17.dp,top=13.dp,bottom=13.dp),verticalArrangement=Arrangement.spacedBy(14.dp)) {
                                if(state.messages.isEmpty()) item { AksaraChatBubble(Message("welcome","assistant",WelcomeText,fixedTimestamp?:System.currentTimeMillis()),fixedTimestamp=fixedTimestamp) }
                                items(state.messages,key={it.id}) { message -> AksaraChatBubble(message,fixedTimestamp=fixedTimestamp) }
                            }
                            if(state.messages.isEmpty()) Row(Modifier.fillMaxWidth().height(49.dp).padding(start=12.dp,end=12.dp,top=4.dp,bottom=8.dp),horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                                AksaraButton("↗  Siapa Aku",{onSend("Siapa Aku")},Modifier.width(91.969.dp),size=11.5f,height=37.dp,radius=999.dp)
                                AksaraButton("↗  The Coder Poet",{onSend("The Coder Poet")},Modifier.width(122.609.dp),size=11.5f,height=37.dp,radius=999.dp)
                            }
                            if(state.error!=null) Row(Modifier.fillMaxWidth().clickable(onClick=onDismissError).padding(8.dp)) { AksaraText(state.error,size=11f,color=Color(0xffe7a08e)) }
                            if(attachmentName!=null) AksaraText("📎 $attachmentName",Modifier.padding(horizontal=12.dp),size=11f)
                            Box(Modifier.fillMaxWidth().background(Brush.verticalGradient(listOf(Color(6,9,15,8),Color(6,8,14,71)))).padding(start=9.dp,end=9.dp,top=8.dp,bottom=10.dp)) {
                                AksaraGlassSurface(Modifier.fillMaxWidth().heightIn(min=58.dp),radius=16.dp,
                                    brush=Brush.linearGradient(listOf(Color(25,35,49,17),Color(8,15,28,11))),border=Color(245,217,176,82)) {
                                    Row(Modifier.fillMaxWidth().padding(horizontal=8.dp,vertical=7.dp),verticalAlignment=Alignment.Bottom,horizontalArrangement=Arrangement.spacedBy(5.dp)) {
                                        Box(Modifier.size(42.dp).clip(RoundedCornerShape(13.dp)).clickable {open("attachments")}.semantics {contentDescription="Lampir fail"},contentAlignment=Alignment.Center) {AksaraIcon("attach",Modifier.size(23.dp))}
                                        BasicTextField(draft,{draft=it},Modifier.weight(1f).heightIn(min=44.dp,max=140.dp).padding(horizontal=3.dp,vertical=10.dp).semantics {contentDescription="Tulis mesej untuk Aksara A.I."}.testTagCompat("composer"),
                                            textStyle=AksaraTypography.style(16f,24f),cursorBrush=SolidColor(AksaraColors.gold))
                                        AksaraButton("",{open("thinking")},Modifier.width(40.dp).semantics {contentDescription="Thinking Mode"},icon="brain",height=42.dp,radius=13.dp,contentColor=AksaraColors.gold)
                                        AksaraButton(if(state.busy)"■" else "",{if(state.busy)onStop() else if(draft.isNotBlank()){onSend(draft.trim());draft=""}},Modifier.width(42.dp).semantics {contentDescription=if(state.busy)"Hentikan respons" else "Hantar soalan"},icon=if(state.busy)null else "send",height=42.dp,radius=13.dp,enabled=state.busy||draft.isNotBlank())
                                    }
                                }
                            }
                        }
                    }
                }
            }
            if(overlay!=null) CompositionLocalProvider(LocalBackdrop provides scene) {
                AksaraOverlay(overlay!!, state, onClose={overlay=null}, onNavigate={open(it)},onRefresh=onRefresh,onMode=onMode,onRestore=onRestore,onClear=onClear,onPickAttachment=onPickAttachment)
            }
        }
    }
}
private fun Modifier.testTagCompat(tag:String) = semantics { testTag=tag }
@Composable fun AksaraChatBubble(message:Message,fixedTimestamp:Long?=null) {
    val ai=message.role!="user"
    Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
        if(ai) Image(painterResource(R.drawable.aksara_portrait),"Aksara A.I.",Modifier.padding(top=1.dp).size(29.dp).clip(RoundedCornerShape(999.dp)).border(1.dp,Color(244,205,137,135),RoundedCornerShape(999.dp)),contentScale=ContentScale.Crop)
        Column(Modifier.weight(1f),horizontalAlignment=if(ai)Alignment.Start else Alignment.End) {
            AksaraText(if(ai) "AKSARA A.I." else "KAU",size=12f,line=16.2f,weight=600,color=Color(0xfff2c979),tracking=1.68f)
            Spacer(Modifier.height(6.dp))
            AksaraGlassSurface(Modifier.fillMaxWidth(),radius=13.dp,brush=Brush.linearGradient(listOf(Color(243,226,198,12),Color(125,165,203,6))),border=Color(240,211,164,87)) {
                if(message.text.isEmpty()) AksaraText("•••",Modifier.padding(horizontal=12.dp,vertical=11.dp),size=15f)
                else NativeMarkdown(message.text,Modifier.padding(horizontal=12.dp,vertical=11.dp))
            }
            Spacer(Modifier.height(6.dp))
            val time=Instant.ofEpochMilli(fixedTimestamp?:message.at).atZone(ZoneId.of("Asia/Kuala_Lumpur")).format(DateTimeFormatter.ofPattern("d MMM HH:mm",java.util.Locale.ENGLISH))
            AksaraText((if(ai)"Diterima" else "Dihantar")+" · "+time+(if(message.incomplete) " · belum lengkap" else ""),Modifier.padding(start=4.dp),size=10f,line=14f,color=Color(232,215,189,201),tracking=.15f)
        }
    }
}
@Composable private fun NativeMarkdown(value:String,modifier:Modifier) {
    val context=LocalContext.current
    val renderer=remember {Markwon.builder(context).usePlugin(TablePlugin.create(context)).build()}
    AndroidView(modifier=modifier,factory={ ctx -> android.widget.TextView(ctx).apply {
        setTextColor(android.graphics.Color.rgb(255,244,228));textSize=15f
        typeface=ctx.resources.getFont(R.font.dm_sans);includeFontPadding=false
        setLineSpacing(0f,1.59f);letterSpacing=-.008f;setPadding(0,0,0,0)
        setTextIsSelectable(true);setLinkTextColor(android.graphics.Color.rgb(230,197,139))
        movementMethod=android.text.method.LinkMovementMethod.getInstance()
    }},update={renderer.setMarkdown(it,value)})
}
