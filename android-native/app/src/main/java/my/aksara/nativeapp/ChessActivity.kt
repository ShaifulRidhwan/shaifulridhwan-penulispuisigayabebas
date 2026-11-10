package my.aksara.nativeapp

import android.os.Bundle
import android.app.AlertDialog
import android.content.Intent
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import my.aksara.nativeapp.core.design.*
import my.aksara.nativeapp.feature.chess.*
import my.aksara.engine.chess.ChessSession
import com.github.bhlangonijr.chesslib.Side

/** Native chess window inside AKSARA. Existing Chat and Live Voice keep their own owners. */
class ChessActivity:ComponentActivity() {
    private val premiumEnabled=true // Checkpoint A passed: CI 42734184090, commit 8f5f0b8.
    private lateinit var queen:QueenVoice
    private lateinit var memory:RivalryMemory
    private var recognizer:android.speech.SpeechRecognizer?=null
    private var listening by mutableStateOf(false)
    private var interactionStatus by mutableStateOf("")
    private val settings by lazy{getSharedPreferences("chess_presentation",0)}
    private var speed by mutableFloatStateOf(1f)
    private var coordinates by mutableStateOf(true)
    private val microphone=registerForActivityResult(androidx.activity.result.contract.ActivityResultContracts.RequestPermission()){granted ->
        interactionStatus=if(granted)"Tekan dan tahan butang untuk bercakap." else "Izin mikrofon tidak diberikan. Butang analisis kekal tersedia."
    }
    val chess:ChessModel by viewModels()
    lateinit var board:ChessBoardView; private set
    override fun onCreate(savedInstanceState:Bundle?) {
        super.onCreate(savedInstanceState)
        volumeControlStream=android.media.AudioManager.STREAM_MUSIC
        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WindowCompat.setDecorFitsSystemWindows(window,false)
        WindowInsetsControllerCompat(window,window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior=WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
        if(premiumEnabled) {
            speed=settings.getFloat("speed",1f);coordinates=settings.getBoolean("coordinates",true)
            queen=QueenVoice(this);memory=RivalryMemory(this)
            chess.onEvent={event,analysis ->
                if(chess.session.end()!=ChessSession.End.PLAYING)memory.record(chess.gameId,chess.session)
                else if(event=="stop")memory.remove(chess.gameId)
                if(event=="stop" && ::board.isInitialized)(board as? ArenaBoardView)?.skipAnimation()
                queen.event(chess.session,event,analysis)
            }
            setContent {PremiumContent();DrawClaimChooser()}
        } else setContent { Screen();DrawClaimChooser() }
    }
    override fun onStart() {
        super.onStart();chess.enter()
        if(premiumEnabled && !chess.openingAnnounced && chess.session.history().isEmpty()) {
            chess.openingAnnounced=true;queen.event(chess.session,"opening",null)
        }
    }
    override fun onStop() {recognizer?.cancel();listening=false;chess.leave();if(::queen.isInitialized)queen.stop();super.onStop()}
    override fun onDestroy() {recognizer?.destroy();recognizer=null;if(::queen.isInitialized){chess.onEvent=null;queen.close()};super.onDestroy()}
    @Composable private fun PremiumContent() {
        PremiumChessScreen(chess,queen,memory,{board=it},::premiumMenu,::microphoneDown,{recognizer?.stopListening()},listening,interactionStatus,speed,coordinates)
        if(chess.promotions.isNotEmpty())DisposableEffect(chess.promotions) {
            val moves=chess.promotions
            val dialog=AlertDialog.Builder(this@ChessActivity).setTitle("Pilih promotion").setItems(arrayOf("Queen","Rook","Bishop","Knight")){_,i ->
                moves.firstOrNull{it.endsWith(listOf("q","r","b","n")[i])}?.let(chess::promote)
            }.setOnCancelListener{chess.dismissPromotion()}.show()
            onDispose{dialog.dismiss()}
        }
    }
    @Composable private fun DrawClaimChooser() {
        val intended=chess.intendedClaim
        if(intended!=null)DisposableEffect(intended) {
            val dialog=AlertDialog.Builder(this@ChessActivity).setTitle("Tuntutan seri tersedia")
                .setMessage("Langkah $intended membolehkan tuntutan seri. Tuntut sebelum langkah itu dilaksanakan?")
                .setPositiveButton("Tuntut seri"){_,_->chess.confirmIntendedClaim()}
                .setNegativeButton("Teruskan langkah"){_,_->chess.continueIntendedMove()}
                .setOnCancelListener{chess.cancelIntendedClaim()}.show()
            onDispose{dialog.dismiss()}
        }
    }
    private fun microphoneDown() {
        if(chess.thinking || chess.paused){interactionStatus="Tunggu giliran Cahaya untuk meminta analisis.";return}
        if(!android.speech.SpeechRecognizer.isOnDeviceRecognitionAvailable(this)){interactionStatus="Pengecaman suara offline tidak tersedia. Gunakan butang Analisis.";return}
        if(checkSelfPermission(android.Manifest.permission.RECORD_AUDIO)!=android.content.pm.PackageManager.PERMISSION_GRANTED){microphone.launch(android.Manifest.permission.RECORD_AUDIO);return}
        if(recognizer==null) {
            recognizer=android.speech.SpeechRecognizer.createOnDeviceSpeechRecognizer(this).apply{setRecognitionListener(object:android.speech.RecognitionListener {
                override fun onReadyForSpeech(params:Bundle?){listening=true}
                override fun onBeginningOfSpeech(){}
                override fun onRmsChanged(rmsdB:Float){}
                override fun onBufferReceived(buffer:ByteArray?){}
                override fun onEndOfSpeech(){listening=false}
                override fun onError(error:Int){listening=false;interactionStatus="Ucapan Melayu tidak dapat dikenali (kod $error). Butang analisis boleh digunakan."}
                override fun onPartialResults(results:Bundle?){}
                override fun onEvent(eventType:Int,params:Bundle?){}
                override fun onResults(results:Bundle?) {
                    listening=false
                    val text=results?.getStringArrayList(android.speech.SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty()
                    interactionStatus=text
                    if(text.isBlank())return
                    val request=text.lowercase(java.util.Locale.forLanguageTag("ms-MY"))
                    if(request.contains("salah") || request.contains("kesilapan")) {
                        if(chess.session.end()!=ChessSession.End.PLAYING)chess.reviewGame()
                        else queen.notice("Penilaian kesilapan memerlukan carian sebelum dan selepas langkah. Laporan itu tersedia selepas permainan.")
                    } else if(request.contains("kenapa") || request.contains("terakhir"))explainLast()
                    else chess.analyze{a,side,move->queen.explain(chess.session,a,side,move)}
                }
            })}
        }
        queen.stop();listening=true;interactionStatus="Mendengar Bahasa Melayu · pemprosesan pada peranti"
        runCatching{recognizer?.startListening(Intent(android.speech.RecognizerIntent.ACTION_RECOGNIZE_SPEECH).putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE,"ms-MY").putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE_MODEL,android.speech.RecognizerIntent.LANGUAGE_MODEL_FREE_FORM).putExtra(android.speech.RecognizerIntent.EXTRA_PARTIAL_RESULTS,false))}.onFailure{listening=false;interactionStatus="Mikrofon tidak dapat dimulakan."}
    }
    fun voiceDebugState():String=if(::queen.isInitialized)"status=${queen.status}; speaking=${queen.speaking}; mode=${queen.mode}; subtitle=${queen.subtitle}" else "not_initialized"
    private fun explainLast() {
        val analysis=chess.lastAnalysis
        if(analysis==null || chess.session.turn()!=Side.WHITE){queen.notice("Tiada analisis langkah terakhir yang disahkan dalam sesi ini. Aku boleh menilai kedudukan semasa.");return}
        queen.explainLast(chess.session,analysis,chess.session.sanHistory().lastOrNull().orEmpty())
    }
    private fun premiumMenu() {
        val items=arrayOf("Mula semula","Resign","Tawar seri","Eksport PGN","Replay","Analisis kedudukan","Terangkan langkah terakhir","Suara Ratu Gelap","Kelajuan animasi","Koordinat: ${if(coordinates)"aktif" else "mati"}","Reset kamera","Memori rivalry: ${if(memory.enabled)"aktif" else "mati"}","Padam rekod rivalry","Lesen & source Stockfish","Kembali ke AKSARA")
        AlertDialog.Builder(this).setTitle("AKSARA Chess").setItems(items){_,i ->when(i) {
            0->confirm("Mulakan permainan baharu?",chess::restart)
            1->confirm("Menyerah kepada Gelap?",chess::resign)
            2->{val accepted=chess.offerDraw();AlertDialog.Builder(this).setMessage(if(accepted)"Seri disahkan." else "Ratu Gelap menolak tawaran seri. Permainan diteruskan.").setPositiveButton("Teruskan",null).show()}
            3->startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT,chess.session.pgn()),"Eksport PGN"))
            4->if(chess.session.end()!=ChessSession.End.PLAYING){queen.stop();chess.replayStep(0)}else queen.notice("Replay tersedia selepas permainan tamat.")
            5->chess.analyze{a,side,move->queen.explain(chess.session,a,side,move)}
            6->explainLast()
            7->voiceMenu()
            8->{val values=listOf(.5f,1f,1.5f,2f);AlertDialog.Builder(this).setTitle("Kelajuan animasi").setSingleChoiceItems(values.map{"${it}×"}.toTypedArray(),values.indexOf(speed)){d,n->speed=values[n];settings.edit().putFloat("speed",speed).apply();d.dismiss()}.show()}
            9->{coordinates=!coordinates;settings.edit().putBoolean("coordinates",coordinates).apply()}
            10->(board as? ArenaBoardView)?.skipAnimation()
            11->confirm(if(memory.enabled)"Matikan memori? Rekod lama kekal sehingga dipadam." else "Simpan sehingga 50 rekod permainan secara setempat? Tiada data dihantar ke awan."){memory.toggle()}
            12->confirm("Padam semua rekod rivalry setempat?",memory::clear)
            13->AlertDialog.Builder(this).setTitle("Lesen Stockfish 19").setMessage(assets.open("chess/NOTICE.txt").bufferedReader().use{it.readText()}).setPositiveButton("GPLv3"){_,_->AlertDialog.Builder(this).setTitle("GNU GPLv3").setMessage(assets.open("chess/Stockfish-GPL-3.0.txt").bufferedReader().use{it.readText()}).setPositiveButton("Tutup",null).show()}.setNeutralButton("Source bundle"){_,_->startActivity(Intent(Intent.ACTION_VIEW,android.net.Uri.parse("https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/actions")))}.setNegativeButton("Tutup",null).show()
            14->finish()
        }}.show()
    }
    private fun voiceMenu() {
        AlertDialog.Builder(this).setTitle("Suara Ratu Gelap").setItems(arrayOf("Mod suara","Volume suara","Sari kata: ${if(queen.subtitles)"aktif" else "mati"}","Ulang dialog","Urus suara Melayu peranti")){_,i->when(i) {
            0->AlertDialog.Builder(this).setTitle("Mod suara").setSingleChoiceItems(QueenVoice.Mode.entries.map{it.label}.toTypedArray(),queen.mode.ordinal){d,n->queen.chooseMode(QueenVoice.Mode.entries[n]);d.dismiss()}.show()
            1->AlertDialog.Builder(this).setTitle("Volume suara").setSingleChoiceItems(arrayOf("0%","25%","50%","75%","100%"),(queen.volume*4).toInt()){d,n->queen.changeVolume(n/4f);d.dismiss()}.show()
            2->queen.toggleSubtitles()
            3->queen.replay(chess.session)
            4->runCatching{startActivity(Intent(android.speech.tts.TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA))}.onFailure{interactionStatus="Pemasang suara tidak tersedia. Semak tetapan Text-to-speech Android."}
        }}.show()
    }
    @Composable private fun Action(text:String,onClick:()->Unit) {
        Box(Modifier.defaultMinSize(minHeight=48.dp).border(1.dp,Color(0x447c7397),RoundedCornerShape(14.dp)).background(Color(0x4026273e),RoundedCornerShape(14.dp)).clickable(onClick=onClick).padding(horizontal=14.dp,vertical=10.dp),contentAlignment=Alignment.Center) {
            AksaraText(text,size=12f,color=Color(0xffe7ddc8))
        }
    }
    @Composable private fun Screen() {
        val tick=chess.version
        val end=chess.session.end()
        val status=when {
            end!=ChessSession.End.PLAYING -> "${chess.session.result()} · ${end.name.replace('_',' ')}"
            chess.paused -> "Permainan dijeda"
            chess.thinking -> "Ratu Gelap sedang berfikir…"
            chess.session.inCheck() -> "Check · lindungi rajamu"
            else -> "Giliran Cahaya · putih"
        }
        BoxWithConstraints(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xff151329),Color(0xff070b14)))).safeDrawingPadding()) {
            val wide=maxWidth>maxHeight
            @Composable fun Board(modifier:Modifier) {
                AndroidView(factory={ChessBoardView(it).also { view -> board=view;view.onSquare=chess::select;view.onDrop=chess::drop }},
                    modifier=modifier.testTag("chess-board"),update={v ->
                        v.pieces=chess.pieces;v.selected=chess.selected;v.legal=chess.legal;v.lastMove=chess.lastMove;v.check=chess.session.inCheck()
                    })
            }
            @Composable fun Panel(modifier:Modifier) {
                Column(modifier.padding(12.dp).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                    AksaraText("CAHAYA / GELAP",size=12f,tracking=2f,color=Color(0xffcbb383),family=AksaraTypography.heading)
                    AksaraText("Ratu Gelap",size=25f,weight=600,family=AksaraTypography.heading)
                    AksaraText("AKSARA A.I. · ABSOLUTE DARKNESS",size=10f,color=Color(0xffc6a2dc))
                    AksaraText("Latihan tanpa jam · Stockfish kekuatan penuh",size=11f,color=Color(0xffaaa2b9))
                    AksaraText(status,Modifier.testTag("chess-status"),size=14f,color=Color(0xffeadcb7))
                    AksaraText(chess.engineStatus,Modifier.testTag("chess-engine"),size=10f,color=Color(0xffafa8bd))
                    if(chess.error.isNotEmpty()) {
                        AksaraText(chess.error,size=12f,color=Color(0xffff9fae)); Action("Cuba enjin semula",chess::retry)
                    }
                    Row(horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                        Action(if(chess.paused) "Sambung" else "Jeda",chess::pause)
                        Action("Undo",chess::undo)
                        Action("Menu"){menu()}
                    }
                    AksaraText("Cahaya · Putih",size=13f,weight=600)
                    AksaraText("Ketik buah dan petak sasaran, atau seret buah.",size=11f,color=Color(0xffaaa2b9))
                    val history=remember(tick){chess.session.sanHistory()}
                    AksaraText(history.chunked(2).mapIndexed { i,p -> "${i+1}. ${p.joinToString("   ")}" }.takeLast(12).joinToString("\n").ifEmpty{"Permulaan permainan"},Modifier.testTag("chess-history"),size=12f)
                    if(chess.session.canClaimDraw())Action("Tuntut seri",chess::claimDraw)
                }
            }
            if(wide) Row(Modifier.fillMaxSize()) { Board(Modifier.weight(1f).fillMaxHeight());Panel(Modifier.widthIn(max=310.dp).fillMaxHeight()) }
            else Column(Modifier.fillMaxSize()) { Board(Modifier.fillMaxWidth().weight(1f));Panel(Modifier.fillMaxWidth().heightIn(max=310.dp)) }
        }
        if(chess.promotions.isNotEmpty()) DisposableEffect(chess.promotions) {
            val moves=chess.promotions
            val dialog=AlertDialog.Builder(this@ChessActivity).setTitle("Pilih promotion")
                .setItems(arrayOf("Queen","Rook","Bishop","Knight")) { _,i ->
                    val suffix=listOf("q","r","b","n")[i];moves.firstOrNull{it.endsWith(suffix)}?.let(chess::promote)
                }.setOnCancelListener{chess.dismissPromotion()}.show()
            onDispose{dialog.dismiss()}
        }
    }
    private fun confirm(title:String,action:()->Unit) {AlertDialog.Builder(this).setTitle(title).setPositiveButton("Ya"){_,_->action()}.setNegativeButton("Batal",null).show()}
    private fun menu() {
        AlertDialog.Builder(this).setTitle("AKSARA Chess").setItems(arrayOf("Mula semula","Resign","Tawar seri","Eksport PGN","Kembali ke AKSARA")){_,i -> when(i) {
            0->confirm("Mulakan permainan baharu?",chess::restart)
            1->confirm("Menyerah kepada Gelap?",chess::resign)
            2-> {val accepted=chess.offerDraw();AlertDialog.Builder(this).setMessage(if(accepted)"Seri disahkan." else "Ratu Gelap menolak tawaran seri. Permainan diteruskan.").setPositiveButton("Teruskan",null).show()}
            3->startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT,chess.session.pgn()),"Eksport PGN"))
            4->finish()
        }}.show()
    }
}
