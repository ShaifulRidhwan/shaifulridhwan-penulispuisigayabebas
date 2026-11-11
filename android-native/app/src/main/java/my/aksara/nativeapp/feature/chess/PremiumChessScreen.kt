package my.aksara.nativeapp.feature.chess

import androidx.compose.foundation.*
import androidx.compose.foundation.Image
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import my.aksara.nativeapp.R
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.graphics.*
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import my.aksara.nativeapp.core.design.*
import my.aksara.engine.chess.ChessSession
import com.github.bhlangonijr.chesslib.Side

/** Staged until the native gameplay acceptance gate passes. */
@Composable fun PremiumChessScreen(
    chess:ChessModel,voice:QueenVoice,memory:RivalryMemory,
    onBoard:(ChessBoardView)->Unit,onMenu:()->Unit,
    onMicrophoneDown:()->Unit,onMicrophoneUp:()->Unit,
    listening:Boolean,interactionStatus:String,
    speed:Float,coordinates:Boolean
) {
    var showDetails by remember { mutableStateOf(false) }
    var detailTab by remember { mutableStateOf(0) }
    val tick=chess.version
    var arena by remember {mutableStateOf<ArenaBoardView?>(null)}
    val game=chess.display
    val ended=chess.session.end()!=ChessSession.End.PLAYING
    val history=remember(tick){chess.session.sanHistory()}
    val captures=remember(tick){game.capturedPieces()}
    val status=when {
        chess.replayIndex>=0 -> "REPLAY · ${chess.replayIndex}/${history.size}"
        ended -> "${chess.session.result()} · ${chess.session.end().name.replace('_',' ')}"
        chess.paused -> "Permainan dijeda"
        chess.thinking -> "Gelap sedang berfikir…"
        game.inCheck() -> "CHECK · giliran ${if(game.turn()==Side.WHITE)"Cahaya" else "Gelap"}"
        else -> if(game.turn()==Side.WHITE) "Giliran Cahaya · pilih langkahmu" else "Giliran Gelap · Ratu Gelap berfikir"
    }
    fun analyze() {chess.analyze{a,side,move->voice.explain(chess.session,a,side,move)}}
    BoxWithConstraints(Modifier.fillMaxSize().background(Color(0xff080b13))) {
        val chessMaxWidth = maxWidth
        val chessMaxHeight = maxHeight
        Image(painter=painterResource(R.drawable.aksara_duality_v2),contentDescription=null,contentScale=ContentScale.Crop,modifier=Modifier.fillMaxSize())
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0x66060916),Color(0x99070b19),Color(0xCC080b13)))))
        Column(Modifier.fillMaxSize().safeDrawingPadding()) {
        val wide=chessMaxWidth>chessMaxHeight
        val panelWidth=minOf(310.dp,chessMaxWidth*.44f)
        @Composable fun Chip(text:String,action:()->Unit) {
            Box(Modifier.defaultMinSize(minHeight=48.dp).background(Brush.verticalGradient(listOf(Color(0x553e3651),Color(0x33202534))),RoundedCornerShape(14.dp)).border(1.dp,Color(0x446f6284),RoundedCornerShape(14.dp)).clickable(onClick=action).padding(horizontal=13.dp,vertical=10.dp),contentAlignment=Alignment.Center) {AksaraText(text,size=12f,color=Color(0xffeadfc8))}
        }
        @Composable fun Board(modifier:Modifier) {
            AndroidView(factory={ArenaBoardView(it).also{v->arena=v;onBoard(v);v.onSquare=chess::select;v.onDrop=chess::drop}},modifier=modifier.testTag("chess-board"),update={v->
                v.pieces=chess.pieces;v.selected=if(chess.replayIndex>=0)-1 else chess.selected
                v.legal=if(chess.replayIndex>=0)emptyList() else chess.legal
                v.check=game.inCheck();v.checkKing=if(game.turn()==Side.WHITE)"K" else "k"
                v.lastMove=chess.lastMove;v.animationSpeed=speed;v.coordinates=coordinates
                v.showCommittedMove(chess.previousPieces,chess.lastMove,chess.animationId,game.end()==ChessSession.End.CHECKMATE,chess.animationStartedAt)
            })
        }
        @Composable fun ActionChip(text:String,action:()->Unit,modifier:Modifier=Modifier) {
            Box(modifier.defaultMinSize(minHeight=44.dp)
                .background(Brush.verticalGradient(listOf(Color(0x66554b67),Color(0x44222b42))),RoundedCornerShape(14.dp))
                .border(1.dp,Color(0x887e718f),RoundedCornerShape(14.dp))
                .clickable(onClick=action).padding(horizontal=4.dp,vertical=9.dp),contentAlignment=Alignment.Center) {
                AksaraText(text,size=12f,weight=600,color=Color(0xfff1e7d7))
            }
        }
        @Composable fun Panel(modifier:Modifier) {
            Column(modifier.padding(6.dp).background(Brush.linearGradient(listOf(Color(0x773d3349),Color(0x99303a47),Color(0x77232c3e))),RoundedCornerShape(24.dp)).border(1.dp,Color(0x887c718f),RoundedCornerShape(24.dp)).padding(horizontal=12.dp,vertical=10.dp).then(if(showDetails)Modifier.verticalScroll(rememberScrollState()) else Modifier),verticalArrangement=Arrangement.spacedBy(6.dp)) {
                Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(12.dp)) {
                    AndroidView(factory={QueenPortraitView(it)},modifier=Modifier.size(50.dp),update={it.speaking=voice.speaking})
                    Column(Modifier.weight(1f)) {
                        AksaraText("AKSARA A.I.",size=10f,tracking=2f,color=Color(0xffbba2c9),family=AksaraTypography.heading)
                        AksaraText("Ratu Gelap",size=17f,weight=600,color=Color(0xffeee0cc),family=AksaraTypography.heading)
                        AksaraText("ABSOLUTE DARKNESS",size=9f,tracking=1.1f,color=Color(0xffceac73))
                    }
                }
                Box(Modifier.fillMaxWidth().background(Color(0x44302640),RoundedCornerShape(12.dp))
                    .border(1.dp,Color(0x446e6084),RoundedCornerShape(12.dp))
                    .padding(horizontal=10.dp,vertical=7.dp)) {
                    AksaraText(status,Modifier.testTag("chess-status"),size=12f,weight=600,color=Color(0xffe6d5b5))
                }
                Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                    ActionChip(if(chess.paused)"Resume" else "Pause",chess::pause,Modifier.weight(1f))
                    ActionChip("Undo",{voice.stop();chess.undo()},Modifier.weight(1f))
                    ActionChip("Menu",onMenu,Modifier.weight(1f))
                    ActionChip(if(showDetails)"Tutup" else "Butiran",{showDetails=!showDetails},Modifier.weight(1f))
                }
                if(showDetails) {
                Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                    Chip(if(detailTab==0)"● Langkah" else "Langkah"){detailTab=0}
                    Chip(if(detailTab==1)"● Analisis" else "Analisis"){detailTab=1}
                    Chip(if(detailTab==2)"● Ratu Gelap" else "Ratu Gelap"){detailTab=2}
                }
                if(detailTab==2) {
                if(voice.visibleSubtitle.isNotEmpty()) {
                    Column(Modifier.fillMaxWidth().background(Color(0x443e2d51),RoundedCornerShape(16.dp)).border(1.dp,Color(0x337e6e90),RoundedCornerShape(16.dp)).padding(12.dp)) {
                        AksaraText(if(voice.speaking)"RATU GELAP · BERSUARA" else "RATU GELAP",size=9f,tracking=1.2f,color=Color(0xffc6a3d2))
                        AksaraText(voice.visibleSubtitle,size=13f,color=Color(0xffe2d6df))
                    }
                }
                AksaraText(voice.status,size=10f,color=Color(0xff9d95ab))
                }
                if(detailTab==1) {
                Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                    if(!ended)Chip(if(chess.analyzing)"Menganalisis…" else "Analisis"){analyze()}
                    else Chip("Replay"){voice.stop();chess.replayStep(0)}
                    Chip("Langkau"){arena?.skipAnimation()}
                }
                AksaraText("Cahaya · Putih   /   Ratu Gelap · Hitam",size=11f,color=Color(0xffb5b1bd))
                AksaraText("Latihan tanpa jam · Stockfish kekuatan penuh",size=10f,color=Color(0xffa6a1b0))
                AksaraText(chess.engineStatus,Modifier.testTag("chess-engine"),size=10f,color=Color(0xffa8bdb8))
                if(chess.error.isNotBlank()) {AksaraText(chess.error,size=12f,color=Color(0xffffa1ab));Chip("Cuba enjin semula",chess::retry)}
                if(chess.session.canClaimDraw() && chess.session.turn()==Side.WHITE)Chip("Tuntut seri",chess::claimDraw)
                if(chess.replayIndex>=0)Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                    Chip("←"){chess.shiftReplay(-1)}
                    Chip("→"){chess.shiftReplay(1)}
                    Chip("Keluar replay",chess::exitReplay)
                }
                }
                if(detailTab==2) {
                Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                    Box(Modifier.defaultMinSize(minHeight=48.dp).background(Color(0x44382f4b),RoundedCornerShape(13.dp)).pointerInput(Unit){detectTapGestures(onPress={onMicrophoneDown();tryAwaitRelease();onMicrophoneUp()})}.padding(horizontal=12.dp,vertical=12.dp)) {
                        AksaraText(if(listening)"Mendengar…" else "Tahan untuk tanya",size=11f)
                    }
                    Chip("Ulang suara"){voice.replay(chess.session)}
                }
                if(interactionStatus.isNotBlank())AksaraText(interactionStatus,size=11f,color=Color(0xffb7a9c6))
                if(chess.analysisNote.isNotBlank())AksaraText(chess.analysisNote,Modifier.testTag("chess-analysis"),size=11f,color=Color(0xffc4d8d0))
                }
                if(detailTab==0) {
                AksaraText("LANGKAH",size=10f,tracking=1.4f,color=Color(0xffc3a775))
                val scroll=rememberScrollState()
                LaunchedEffect(history.size){scroll.animateScrollTo(scroll.maxValue)}
                Box(Modifier.fillMaxWidth().heightIn(max=130.dp).verticalScroll(scroll)) {
                    AksaraText(history.chunked(2).mapIndexed{i,p->"${i+1}.  ${p.joinToString("     ")}"}.joinToString("\n").ifEmpty{"Papan menanti langkah pertama."},Modifier.testTag("chess-history"),size=12f,color=Color(0xffbbb8c3))
                }
                fun fallen(white:Boolean)=captures.filter{it[0].isUpperCase()==white}.groupingBy{it.uppercase()}.eachCount().entries.joinToString(" · "){"${it.key} ×${it.value}"}.ifEmpty{"—"}
                AksaraText("Gugur · Cahaya: ${fallen(true)}\nGugur · Gelap: ${fallen(false)}",size=11f,color=Color(0xffaaa3b6))
                }
                }
                if(ended && showDetails && detailTab==1) {
                    Chip(if(chess.reviewing)"Batal analisis" else "Analisis selepas permainan"){if(chess.reviewing)chess.cancelReview() else chess.reviewGame()}
                    if(chess.reviewNote.isNotBlank())AksaraText(chess.reviewNote,size=11f,color=Color(0xffc2d1c9))
                    chess.reviewLines.forEach{AksaraText(it,size=10f,color=Color(0xffaaa5b4))}
                }
                if(showDetails && detailTab==2) AksaraText(memory.summary,size=10f,color=Color(0xff968da4))
            }
        }
        if(wide)Row(Modifier.fillMaxSize()){Board(Modifier.weight(1f).fillMaxHeight());Panel(Modifier.width(panelWidth).fillMaxHeight())}
        else Column(Modifier.fillMaxSize()){Board(Modifier.fillMaxWidth().weight(1f));Panel(Modifier.fillMaxWidth().heightIn(max=if(showDetails)350.dp else 190.dp))}
        }
    }
}
