package my.aksara.nativeapp.feature.chess

import android.app.Application
import android.os.Handler
import android.os.Looper
import androidx.compose.runtime.*
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.github.bhlangonijr.chesslib.Side
import kotlinx.coroutines.*
import my.aksara.engine.chess.ChessSession
import my.aksara.engine.chess.UciEngine
import java.io.File

/** One authoritative session; animations/audio consume immutable committed snapshots. */
class ChessModel(app: Application) : AndroidViewModel(app) {
    private val prefs=app.getSharedPreferences("aksara_chess",0)
    private val main=Handler(Looper.getMainLooper())
    var session: ChessSession = runCatching { ChessSession.restore(prefs.getString("session",null)!!) }.getOrElse { ChessSession() }
        private set
    var version by mutableIntStateOf(0); private set
    var thinking by mutableStateOf(false); private set
    var paused by mutableStateOf(false); private set
    var error by mutableStateOf(""); private set
    var engineStatus by mutableStateOf("Stockfish 19 · belum dimulakan"); private set
    var selected by mutableStateOf(-1); private set
    var promotions by mutableStateOf<List<String>>(emptyList()); private set
    var lastMove by mutableStateOf(session.history().lastOrNull().orEmpty()); private set
    var lastAnalysis by mutableStateOf<UciEngine.Analysis?>(null); private set
    var previousPieces: Array<String>? = null; private set
    var animationId by mutableIntStateOf(0); private set
    var onEvent: ((String,UciEngine.Analysis?)->Unit)? = null
    private var active=false
    private var engine: UciEngine?=null
    private var starting=false
    private var epoch=0L
    val pieces: Array<String> get() { version; return session.pieces() }
    val legal: List<String> get() { version; return session.legalMoves() }
    fun enter() { active=true; ensureEngine() }
    fun leave() { active=false; epoch++; engine?.cancel(); thinking=false; save(); onEvent?.invoke("stop",null) }
    private fun ensureEngine() {
        if(!active || starting) return
        if(engine!=null) { maybeThink(); return }
        starting=true
        viewModelScope.launch {
            val created=withContext(Dispatchers.IO) {
                runCatching {
                    val binary=File(getApplication<Application>().applicationInfo.nativeLibraryDir,"libstockfish.so")
                    check(binary.isFile && binary.canExecute()) { "Stockfish native tidak tersedia untuk ABI peranti ini." }
                    val process=ProcessBuilder(binary.absolutePath).redirectErrorStream(true).start()
                    UciEngine(process,Runtime.getRuntime().availableProcessors(),Runtime.getRuntime().maxMemory()/1024/1024)
                }
            }
            starting=false
            created.onSuccess { engine=it; error=""; engineStatus="Stockfish 19 · sedia"; maybeThink() }
                .onFailure { error=it.message?:"Enjin gagal dimulakan"; engineStatus="Enjin tidak tersedia" }
        }
    }
    fun retry() { engine?.close(); engine=null; error=""; ensureEngine() }
    fun select(square: Int) {
        if(!active || paused || thinking || session.turn()!=Side.WHITE || session.end()!=ChessSession.End.PLAYING) return
        val from=selected
        val options=if(from>=0) legal.filter { it.startsWith(uci(from)+uci(square)) } else emptyList()
        if(options.isNotEmpty()) {
            if(options.size>1) promotions=options else play(options.first())
        } else selected=if(pieces[square].firstOrNull()?.isUpperCase()==true) square else -1
    }
    fun drop(from: Int,to: Int) { selected=from; select(to) }
    fun dismissPromotion() { promotions=emptyList() }
    fun promote(move: String) { if(move in promotions) { promotions=emptyList(); play(move) } }
    private fun play(move: String) {
        val before=pieces
        runCatching { session.play(move) }.onSuccess {
            previousPieces=before; lastMove=move; animationId++; selected=-1; update();
            emitEvent(move,before,null); maybeThink()
        }.onFailure { error=it.message.orEmpty() }
    }
    private fun emitEvent(move: String,before: Array<String>,analysis: UciEngine.Analysis?) {
        val event=when {
            session.end()!=ChessSession.End.PLAYING -> if(session.end()==ChessSession.End.CHECKMATE) "mate" else "draw"
            session.inCheck() -> "check"
            move.length==5 -> "promotion"
            before[index(move.substring(2,4))].isNotBlank() -> "capture"
            else -> "quiet"
        }
        onEvent?.invoke(event,analysis)
    }
    private fun maybeThink() {
        val current=engine?:return
        if(!active || paused || thinking || session.end()!=ChessSession.End.PLAYING || session.turn()!=Side.BLACK) return
        thinking=true; val token=++epoch
        // Untimed practice: full strength within a bounded resource/time budget.
        val budget=if(android.os.Build.VERSION.SDK_INT>=29 && getApplication<Application>().getSystemService(android.os.PowerManager::class.java).currentThermalStatus>=android.os.PowerManager.THERMAL_STATUS_SEVERE) 1000 else 2500
        current.search(session,budget).whenComplete { answer,failure -> main.post {
            if(token!=epoch || !active || paused) return@post
            thinking=false
            if(failure!=null) {
                error="Enjin terhenti: ${failure.cause?.message?:failure.message}"; current.close(); engine=null; engineStatus="Cuba semula enjin"; return@post
            }
            val before=pieces
            runCatching { session.applyEngine(answer.revision(),answer.fen(),answer.move()) }.onSuccess { applied ->
                if(applied) {
                    lastAnalysis=answer.analysis(); engineStatus="Stockfish 19 · depth ${answer.analysis().depth()} · NNUE"
                    previousPieces=before; lastMove=answer.move(); animationId++; update(); emitEvent(answer.move(),before,answer.analysis())
                }
            }.onFailure { error="Hasil enjin ditolak: ${it.message}" }
        } }
    }
    fun pause() { paused=!paused; epoch++; engine?.cancel(); thinking=false; onEvent?.invoke("stop",null); if(!paused) maybeThink(); save() }
    fun undo() {
        epoch++; engine?.cancel(); thinking=false
        if(session.undo() && session.turn()==Side.BLACK) session.undo()
        selected=-1; promotions=emptyList(); previousPieces=null; lastMove=session.history().lastOrNull().orEmpty(); lastAnalysis=null; update(); onEvent?.invoke("stop",null)
    }
    fun restart() {
        epoch++; engine?.cancel(); thinking=false; session=ChessSession(); paused=false; selected=-1; promotions=emptyList(); previousPieces=null; lastMove=""; lastAnalysis=null; update(); onEvent?.invoke("opening",null)
    }
    fun resign() { if(session.end()==ChessSession.End.PLAYING) { epoch++; engine?.cancel(); thinking=false; session.resign(Side.WHITE); update(); onEvent?.invoke("mate",null) } }
    fun claimDraw() { if(session.canClaimDraw()) { epoch++; engine?.cancel(); thinking=false; session.claimDraw(null); update(); onEvent?.invoke("draw",null) } }
    fun offerDraw(): Boolean {
        // Queen accepts only a claimable draw; no fabricated human opponent response.
        val accepted=session.canClaimDraw()
        if(accepted) claimDraw() else onEvent?.invoke("declineDraw",null)
        return accepted
    }
    private fun update() { version++; save() }
    fun save() { prefs.edit().putString("session",session.save()).apply() }
    fun loadForTest(fen:String) { check(my.aksara.nativeapp.BuildConfig.DEBUG); epoch++; engine?.cancel(); thinking=false; session=ChessSession(fen); selected=-1; update(); maybeThink() }
    override fun onCleared() { active=false; epoch++; engine?.close(); super.onCleared() }
    companion object {
        fun uci(square:Int)="${('a'.code+square%8).toChar()}${square/8+1}"
        fun index(square:String)=(square[1]-'1')*8+(square[0]-'a')
    }
}
