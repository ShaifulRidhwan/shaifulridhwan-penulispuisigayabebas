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
    var gameId=prefs.getString("game_id",null)?:java.util.UUID.randomUUID().toString();private set
    var reviewing by mutableStateOf(false);private set
    var reviewNote by mutableStateOf("");private set
    val reviewLines=mutableStateListOf<String>()
    var openingAnnounced=false
    var replay by mutableStateOf<ChessSession?>(null); private set
    var replayIndex by mutableIntStateOf(-1); private set
    var analysisNote by mutableStateOf(""); private set
    var analyzing by mutableStateOf(false); private set
    var thinking by mutableStateOf(false); private set
    var paused by mutableStateOf(false); private set
    var error by mutableStateOf(""); private set
    var engineStatus by mutableStateOf("Stockfish 19 · belum dimulakan"); private set
    var selected by mutableStateOf(-1); private set
    var intendedClaim by mutableStateOf<String?>(null);private set
    var promotions by mutableStateOf<List<String>>(emptyList()); private set
    var lastMove by mutableStateOf(session.history().lastOrNull().orEmpty()); private set
    var lastAnalysis by mutableStateOf<UciEngine.Analysis?>(null); private set
    var previousPieces: Array<String>? = null; private set
    var animationStartedAt=0L;private set
    var animationId by mutableIntStateOf(0); private set
    var onEvent: ((String,UciEngine.Analysis?)->Unit)? = null
    private var active=false
    private var engine: UciEngine?=null
    private var starting=false
    private var epoch=0L
    val engineReady get()=engine!=null && error.isEmpty()
    val display get()=replay?:session
    val pieces: Array<String> get() { version; return display.pieces() }
    val legal: List<String> get() { version; return session.legalMoves() }
    fun enter() { active=true; ensureEngine() }
    fun leave() { active=false; analyzing=false;reviewing=false; epoch++; engine?.cancel(); thinking=false; save(); onEvent?.invoke("stop",null) }
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
        if(square !in 0..63)return
        if(replayIndex>=0 || !active || paused || thinking || session.turn()!=Side.WHITE || session.end()!=ChessSession.End.PLAYING) return
        val from=selected
        val options=if(from>=0) legal.filter { it.startsWith(uci(from)+uci(square)) } else emptyList()
        if(options.isNotEmpty()) {
            if(options.size>1) promotions=options else play(options.first())
        } else selected=if(pieces[square].firstOrNull()?.isUpperCase()==true) square else -1
    }
    fun drop(from:Int,to:Int) {
        if(from !in 0..63 || to !in 0..63 || !active || paused || thinking || session.turn()!=Side.WHITE || session.end()!=ChessSession.End.PLAYING || pieces[from].firstOrNull()?.isUpperCase()!=true)return
        selected=from;select(to)
    }
    fun dismissPromotion() { promotions=emptyList() }
    fun promote(move: String) { if(move in promotions) { promotions=emptyList(); play(move) } }
    private fun play(move:String,allowClaim:Boolean=true) {
        if(allowClaim && session.canClaimWith(move)){intendedClaim=move;return}
        intendedClaim=null
        analysisNote=""
        val before=pieces
        runCatching { session.play(move) }.onSuccess {
            previousPieces=before; lastMove=move;animationStartedAt=android.os.SystemClock.uptimeMillis(); animationId++; selected=-1; update();
            emitEvent(move,before,null); maybeThink()
        }.onFailure { error=it.message.orEmpty() }
    }
    private fun emitEvent(move: String,before: Array<String>,analysis: UciEngine.Analysis?) {
        val event=when {
            session.end()!=ChessSession.End.PLAYING -> if(session.end()==ChessSession.End.CHECKMATE) "mate" else "draw"
            session.checkerCount()>1 -> "double_check"
            session.inCheck() -> "check"
            move.length==5 -> "promotion"
            (before[index(move.substring(2,4))].isNotBlank() || (before[index(move.take(2))].uppercase()=="P" && move[0]!=move[2])) -> "capture"
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
                    analysisNote="";lastAnalysis=answer.analysis(); engineStatus="Stockfish 19 · depth ${answer.analysis().depth()} · NNUE"
                    previousPieces=before; lastMove=answer.move();animationStartedAt=android.os.SystemClock.uptimeMillis(); animationId++; update(); emitEvent(answer.move(),before,answer.analysis())
                }
            }.onFailure { error="Hasil enjin ditolak: ${it.message}" }
        } }
    }
    fun pause() { analyzing=false; paused=!paused; epoch++; engine?.cancel(); thinking=false; onEvent?.invoke("stop",null); if(!paused) maybeThink(); save() }
    fun undo() {
        epoch++; engine?.cancel(); thinking=false;analyzing=false;reviewing=false;reviewNote="";reviewLines.clear();analysisNote="";replay=null;replayIndex=-1;animationId++
        if(session.undo() && session.turn()==Side.BLACK) session.undo()
        selected=-1; intendedClaim=null; promotions=emptyList(); previousPieces=null; lastMove=session.history().lastOrNull().orEmpty(); lastAnalysis=null; update(); onEvent?.invoke("stop",null)
    }
    fun restart() {
        epoch++; engine?.cancel(); thinking=false;analyzing=false;reviewing=false;reviewNote="";reviewLines.clear();analysisNote="";replay=null;replayIndex=-1;animationId++; openingAnnounced=true;gameId=java.util.UUID.randomUUID().toString(); session=ChessSession(); paused=false; selected=-1; intendedClaim=null; promotions=emptyList(); previousPieces=null; lastMove=""; lastAnalysis=null; update(); onEvent?.invoke("opening",null)
    }
    fun resign() { if(session.end()==ChessSession.End.PLAYING) { epoch++; engine?.cancel(); thinking=false; session.resign(Side.WHITE); update(); onEvent?.invoke("mate",null) } }
    fun claimDraw() { if(session.turn()==Side.WHITE && session.canClaimDraw()) { epoch++; engine?.cancel(); thinking=false; session.claimDraw(null); update(); onEvent?.invoke("draw",null) } }
    fun confirmIntendedClaim() {
        val move=intendedClaim?:return
        if(session.turn()==Side.WHITE && session.canClaimWith(move)) {
            epoch++;engine?.cancel();thinking=false;session.claimDraw(move);intendedClaim=null;update();onEvent?.invoke("draw",null)
        }
    }
    fun continueIntendedMove() {val move=intendedClaim?:return;intendedClaim=null;play(move,false)}
    fun cancelIntendedClaim(){intendedClaim=null}
    fun offerDraw():Boolean {
        val a=lastAnalysis
        val halfMoves=session.fen().split(" ")[4].toInt()
        val accepts=session.turn()==Side.WHITE && !thinking && a!=null && a.depth()>=16 && a.centipawns()!=null && kotlin.math.abs(a.centipawns())<=10 && halfMoves>=80
        if(accepts) {
            epoch++;engine?.cancel();thinking=false;session.offerDraw();session.acceptDraw(Side.BLACK);update();onEvent?.invoke("draw",null)
        } else onEvent?.invoke("declineDraw",null)
        return accepts
    }
    fun analyze(onResult:(UciEngine.Analysis,Side,String)->Unit) {
        val current=engine?:return
        if(!active || thinking || analyzing || replayIndex>=0 || session.end()!=ChessSession.End.PLAYING)return
        analyzing=true;analysisNote="Menganalisis kedudukan semasa…"
        val fen=session.fen();val rev=session.revision();val side=session.turn()
        current.search(session,1500).whenComplete {answer,failure -> main.post {
            analyzing=false
            if(session.revision()!=rev || session.fen()!=fen || !active)return@post
            if(failure!=null) {analysisNote="Analisis dibatalkan atau tidak tersedia.";return@post}
            val suggested=runCatching {ChessSession(fen).apply{play(answer.move())}.sanHistory().last()}.getOrDefault(answer.move())
            val a=answer.analysis()
            analysisNote="Depth ${a.depth()} · calon $suggested · "+(a.mate()?.let{"mate $it"}?:a.centipawns()?.let{"${it} cp untuk ${if(side==Side.WHITE)"Putih" else "Hitam"}"}?:"skor tidak tersedia")
            onResult(a,side,suggested)
        }}
    }
    fun reviewGame() {
        val current=engine?:return
        if(!active || reviewing || session.end()==ChessSession.End.PLAYING)return
        val history=session.history();val san=session.sanHistory();val position=ChessSession(session.initialFen())
        val token=++epoch;reviewing=true;reviewLines.clear();reviewNote="Menganalisis setiap kedudukan. Boleh dibatalkan."
        viewModelScope.launch {
            var priorWhite:UciEngine.Answer?=null;var suggestion="";var maxLoss=0;var critical="";var total=0;var samples=0
            try {
                for((ply,move) in history.withIndex()) {
                    ensureActive()
                    if(!active || epoch!=token)throw CancellationException()
                    val power=getApplication<Application>().getSystemService(android.os.PowerManager::class.java)
                    if(power.currentThermalStatus>=android.os.PowerManager.THERMAL_STATUS_SEVERE) {
                        reviewNote="Analisis dijeda kerana suhu peranti. Sambung apabila peranti sejuk.";break
                    }
                    val rootSide=position.turn()
                    val answer=withContext(Dispatchers.IO){current.search(position,700).get(30,java.util.concurrent.TimeUnit.SECONDS)}
                    if(epoch!=token)throw CancellationException()
                    if(rootSide==Side.BLACK && priorWhite!=null) {
                        val before=priorWhite!!.analysis();val after=answer.analysis()
                        if(before.depth()>=14 && after.depth()>=14 && before.centipawns()!=null && after.centipawns()!=null) {
                            val loss=maxOf(0,before.centipawns()+after.centipawns())
                            val line="${(ply+1)/2}. ${san[ply-1]} · kehilangan anggaran $loss cp · calon $suggestion · depth ${before.depth()}/${after.depth()}"
                            reviewLines.add(line);total+=loss;samples++
                            if(loss>maxLoss){maxLoss=loss;critical=line}
                        }
                        priorWhite=null
                    }
                    if(rootSide==Side.WHITE) {
                        priorWhite=answer
                        suggestion=ChessSession(position.fen()).apply{play(answer.move())}.sanHistory().last()
                    }
                    position.play(move)
                    reviewNote="Kedudukan ${ply+1}/${history.size} · $samples langkah Cahaya dengan bukti depth ≥14"
                    delay(80)
                }
                if(epoch==token && active && !reviewNote.contains("suhu")) {
                    val facts=san.mapIndexedNotNull{i,m->if(m.contains('#')||m.contains('+')||m.contains('='))"${i/2+1}${if(i%2==0)"." else "…"} $m" else null}
                    reviewNote=if(samples==0)"Carian belum cukup mendalam untuk menilai kesilapan. Tiada accuracy peratus direka." else "Purata kehilangan penilaian: ${total/samples} cp daripada $samples sampel. Kedalaman kedua-dua carian sekurang-kurangnya 14. Ini anggaran, bukan accuracy peratus."
                    if(critical.isNotEmpty())reviewNote+="\nTitik perubahan terbesar dalam sampel: $critical"
                    if(facts.isNotEmpty())reviewNote+="\nSorotan sah: ${facts.takeLast(12).joinToString(" · ")}"
                }
            } catch(_:CancellationException) { }
            catch(e:Exception) {if(epoch==token && active){reviewNote="Analisis tidak selesai: ${e.cause?.message?:e.message}";current.close();engine=null;error="Enjin analisis perlu dimulakan semula."}}
            finally {if(epoch==token)reviewing=false}
        }
    }
    fun cancelReview() {epoch++;engine?.cancel();reviewing=false;reviewNote="Analisis dibatalkan. Sampel yang telah disahkan dikekalkan."}
    fun replayStep(target:Int) {
        if(session.end()==ChessSession.End.PLAYING)return
        selected=-1
        val moves=session.history();val index=target.coerceIn(0,moves.size)
        val fen=session.initialFen();val rev=session.revision();val old=display.pieces();val previous=replayIndex
        viewModelScope.launch {
            val position=withContext(Dispatchers.Default) {ChessSession(fen).apply{moves.take(index).forEach{play(it)}}}
            if(session.revision()!=rev)return@launch
            replay=position;replayIndex=index
            previousPieces=if(previous>=0 && index==previous+1)old else null
            lastMove=if(index==0)"" else moves[index-1];animationStartedAt=android.os.SystemClock.uptimeMillis();animationId++;version++
        }
    }
    fun exitReplay() {replay=null;replayIndex=-1;previousPieces=null;lastMove=session.history().lastOrNull().orEmpty();animationId++;version++}
    private fun update() { version++; save() }
    fun save() { prefs.edit().putString("session",session.save()).putString("game_id",gameId).apply() }
    fun loadForTest(fen:String) {check(my.aksara.nativeapp.BuildConfig.DEBUG);epoch++;engine?.cancel();thinking=false;analyzing=false;reviewing=false;replay=null;replayIndex=-1;session=ChessSession(fen);selected=-1;intendedClaim=null;promotions=emptyList();previousPieces=null;lastMove="";lastAnalysis=null;animationId++;update();maybeThink()}
    override fun onCleared() { active=false; epoch++; engine?.close(); super.onCleared() }
    companion object {
        private val names=Array(64){"${('a'.code+it%8).toChar()}${it/8+1}"}
        fun uci(square:Int)=names[square]
        fun index(square:String)=(square[1]-'1')*8+(square[0]-'a')
    }
}
