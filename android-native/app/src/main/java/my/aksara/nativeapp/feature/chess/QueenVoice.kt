package my.aksara.nativeapp.feature.chess

import android.content.Context
import android.media.*
import android.os.*
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import androidx.compose.runtime.*
import my.aksara.engine.chess.*
import java.util.Locale

/** Separate offline TTS owner; never borrows the application's Gemini Live session. */
class QueenVoice(context:Context):AutoCloseable {
    enum class Mode(val label:String) { FULL("Full Voice"), IMPORTANT("Peristiwa penting"), SUBTITLE("Sari kata sahaja"), SILENT("Senyap") }
    private val app=context.applicationContext
    private val prefs=app.getSharedPreferences("chess_voice",0)
    private val handler=Handler(Looper.getMainLooper())
    private val audio=app.getSystemService(AudioManager::class.java)
    private val planner=QueenDialogue()
    private var tts:TextToSpeech?=null
    private var available=false
    private var closed=false
    private var utterance=0L
    private var currentId=""
    private var lastLine:QueenDialogue.Line?=null
    private var revision=-1L
    private var pending:QueenDialogue.Line?=null
    private val effects=SoundPool.Builder().setMaxStreams(2).setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()).build()
    private val soundIds=mutableMapOf<String,Int>()
    private val loaded=java.util.concurrent.ConcurrentHashMap.newKeySet<Int>()
    var mode by mutableStateOf(runCatching{Mode.valueOf(prefs.getString("mode","FULL")!!)}.getOrDefault(Mode.FULL));private set
    var volume by mutableFloatStateOf(prefs.getFloat("volume",.8f));private set
    var subtitles by mutableStateOf(prefs.getBoolean("subtitles",true));private set
    var subtitle by mutableStateOf("");private set
    var status by mutableStateOf("Menyemak suara Melayu peranti…");private set
    var speaking by mutableStateOf(false);private set
    val visibleSubtitle get()=if(subtitles && mode!=Mode.SILENT)subtitle else ""
    private val focus=AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
        .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
        .setOnAudioFocusChangeListener { change -> if(change<0)handler.post{stop()} }.build()
    init {
        effects.setOnLoadCompleteListener{_,id,result->if(result==0)loaded.add(id)}
        for(name in listOf("light_step","shadow_step","capture"))runCatching{app.assets.openFd("chess/$name.wav").use{soundIds[name]=effects.load(it,1)}}
        tts=TextToSpeech(app){code -> handler.post {
            if(closed)return@post
            val synth=tts?:return@post
            if(code!=TextToSpeech.SUCCESS) {status="TTS tidak tersedia. Sari kata digunakan.";return@post}
            runCatching {
                val voices=synth.voices.orEmpty().filter{it.locale.language=="ms" && !it.isNetworkConnectionRequired}
                val choice=voices.sortedWith(compareByDescending<android.speech.tts.Voice>{it.name.contains("female",true)}.thenByDescending{it.quality}).firstOrNull()
                if(choice==null) {status="Tiada suara Melayu offline dipasang. Sari kata digunakan.";return@runCatching}
                if(synth.setVoice(choice)!=TextToSpeech.SUCCESS) {status="Suara Melayu gagal dimuatkan. Sari kata digunakan.";return@runCatching}
                available=true;synth.setSpeechRate(.9f);synth.setPitch(.96f)
                synth.setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
                status="Suara Melayu peranti · ${choice.name}"
                synth.setOnUtteranceProgressListener(object:UtteranceProgressListener(){
                    override fun onStart(id:String?) {handler.post{if(id==currentId)speaking=true}}
                    override fun onDone(id:String?) {handler.post{if(id==currentId){speaking=false;currentId="";audio.abandonAudioFocusRequest(focus)}}}
                    @Deprecated("Platform callback") override fun onError(id:String?) {handler.post{if(id==currentId){speaking=false;status="Ucapan gagal. Sari kata kekal tersedia.";audio.abandonAudioFocusRequest(focus)}}}
                })
                val waiting=pending;pending=null
                if(waiting!=null)say(waiting,revision)
            }.onFailure{status="TTS tidak dapat digunakan. Sari kata digunakan."}
        }}
    }
    fun event(game:ChessSession,event:String,analysis:UciEngine.Analysis?) {
        if(closed)return
        if(event=="stop") {stop();return}
        if(lastLine?.positionSpecific()==true && revision!=game.revision()) {stop();subtitle=""}
        if(event=="opening")planner.reset()
        if(event in listOf("quiet","capture","check","double_check","promotion","mate"))effect(if(event=="capture" || event=="mate")"capture" else if(game.turn()==com.github.bhlangonijr.chesslib.Side.WHITE)"shadow_step" else "light_step")
        val line=planner.plan(game,event,analysis,SystemClock.elapsedRealtime())?:return
        say(line,game.revision())
    }
    fun explain(game:ChessSession,analysis:UciEngine.Analysis,side:com.github.bhlangonijr.chesslib.Side,bestMove:String) {
        val advantage=analysis.centipawns()?.let { score ->
            val white=if(side==com.github.bhlangonijr.chesslib.Side.WHITE)score else -score
            when {white>25 -> "Carian memihak kepada Cahaya.";white< -25 -> "Carian memihak kepada Gelap.";else -> "Carian menilai kedudukan ini hampir seimbang."}
        }.orEmpty()
        val mate=analysis.mate()?.let{" Skor mate daripada pihak yang sedang bergerak: $it."}.orEmpty()
        val text="Pada depth ${analysis.depth()}, calon langkah enjin ialah $bestMove. $advantage$mate Ini analisis mod latihan, bukan jaminan hasil."
        say(QueenDialogue.Line(text,3,true),game.revision())
    }
    private fun say(line:QueenDialogue.Line,currentRevision:Long) {
        lastLine=line;revision=currentRevision;subtitle=line.text()
        if(mode==Mode.SILENT || mode==Mode.SUBTITLE || (mode==Mode.IMPORTANT && line.priority()<4))return
        if(volume<=0f)return
        if(!available){pending=line;return}
        pending=null;currentId="";tts?.stop();speaking=false
        if(audio.mode!=AudioManager.MODE_NORMAL){status="Audio sedang digunakan. Sari kata digunakan.";return}
        if(audio.requestAudioFocus(focus)!=AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {status="Audio sedang digunakan. Sari kata digunakan.";return}
        currentId="aksara_queen_${++utterance}"
        val params=Bundle().apply{putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME,volume.coerceIn(0f,1f))}
        if(tts?.speak(line.text(),TextToSpeech.QUEUE_FLUSH,params,currentId)!=TextToSpeech.SUCCESS) {
            audio.abandonAudioFocusRequest(focus);status="Ucapan gagal. Sari kata digunakan."
        }
    }
    fun notice(text:String) {say(QueenDialogue.Line(text,3,false),-1)}
    fun explainLast(game:ChessSession,analysis:UciEngine.Analysis,move:String) {
        val score=analysis.centipawns()?.let{" Skor carian ketika itu ialah $it centipawn untuk Gelap."}.orEmpty()
        say(QueenDialogue.Line("Untuk kedudukan sebelum langkah terakhir, Stockfish memilih $move pada depth ${analysis.depth()}.$score Aku mengikuti langkah terbaik enjin dalam carian itu.",3,true),game.revision())
    }
    fun replay(game:ChessSession) {
        val line=lastLine?:return
        if(line.positionSpecific() && revision!=game.revision()) {status="Dialog itu merujuk kedudukan terdahulu.";return}
        say(line,game.revision())
    }
    fun chooseMode(value:Mode) {stop();mode=value;prefs.edit().putString("mode",value.name).apply()}
    fun changeVolume(value:Float) {volume=value.coerceIn(0f,1f);prefs.edit().putFloat("volume",volume).apply()}
    fun toggleSubtitles() {subtitles=!subtitles;prefs.edit().putBoolean("subtitles",subtitles).apply()}
    private fun effect(name:String) {
        if(mode==Mode.SILENT || closed || audio.mode!=AudioManager.MODE_NORMAL)return
        val id=soundIds[name]?:return
        if(id !in loaded)return
        if(!speaking && audio.requestAudioFocus(focus)!=AudioManager.AUDIOFOCUS_REQUEST_GRANTED)return
        effects.autoResume();effects.play(id,.35f,.35f,1,0,1f)
        handler.postDelayed({if(!speaking && currentId.isEmpty())audio.abandonAudioFocusRequest(focus)},500)
    }
    fun stop() {pending=null;currentId="";tts?.stop();effects.autoPause();speaking=false;currentId="";audio.abandonAudioFocusRequest(focus)}
    override fun close() {if(closed)return;closed=true;stop();tts?.shutdown();tts=null;effects.release();handler.removeCallbacksAndMessages(null)}
}
