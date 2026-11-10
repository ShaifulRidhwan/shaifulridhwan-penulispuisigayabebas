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
    val chess:ChessModel by viewModels()
    lateinit var board:ChessBoardView; private set
    override fun onCreate(savedInstanceState:Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WindowCompat.setDecorFitsSystemWindows(window,false)
        WindowInsetsControllerCompat(window,window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior=WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
        setContent { Screen() }
    }
    override fun onStart() {super.onStart();chess.enter()}
    override fun onStop() {chess.leave();super.onStop()}
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
