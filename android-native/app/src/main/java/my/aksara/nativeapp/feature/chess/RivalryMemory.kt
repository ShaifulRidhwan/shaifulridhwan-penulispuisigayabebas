package my.aksara.nativeapp.feature.chess

import android.content.Context
import androidx.compose.runtime.*
import my.aksara.engine.chess.ChessSession
import org.json.JSONArray
import org.json.JSONObject

/** Opt-in, bounded, local-only game records. No API client and no invented history. */
class RivalryMemory(context:Context) {
    private val prefs=context.applicationContext.getSharedPreferences("chess_rivalry",0)
    var enabled by mutableStateOf(prefs.getBoolean("enabled",false));private set
    var summary by mutableStateOf("");private set
    private fun records()=runCatching{JSONArray(prefs.getString("records","[]"))}.getOrElse{JSONArray()}
    init{refresh()}
    fun toggle() {enabled=!enabled;prefs.edit().putBoolean("enabled",enabled).apply();refresh()}
    fun record(id:String,game:ChessSession) {
        if(!enabled || game.end()==ChessSession.End.PLAYING)return
        val old=records();val next=JSONArray()
        for(i in 0 until old.length())if(old.getJSONObject(i).optString("id")!=id)next.put(old.getJSONObject(i))
        next.put(JSONObject().put("id",id).put("result",game.result()).put("opening",game.history().take(6).joinToString(" ")).put("plies",game.history().size).put("pgn",game.pgn()))
        val bounded=JSONArray();for(i in maxOf(0,next.length()-50) until next.length())bounded.put(next.getJSONObject(i))
        prefs.edit().putString("records",bounded.toString()).apply();refresh()
    }
    fun remove(id:String) {
        val old=records();val next=JSONArray();for(i in 0 until old.length())if(old.getJSONObject(i).optString("id")!=id)next.put(old.getJSONObject(i))
        prefs.edit().putString("records",next.toString()).apply();refresh()
    }
    fun previousResultFact():String? {
        if(!enabled)return null
        val data=records();if(data.length()==0)return null
        return when(data.optJSONObject(data.length()-1)?.optString("result")) {
            "1-0"->"Dalam rekod sebelum permainan ini, pertemuan terakhir dimenangi Cahaya."
            "0-1"->"Dalam rekod sebelum permainan ini, pertemuan terakhir dimenangi Gelap."
            "1/2-1/2"->"Dalam rekod sebelum permainan ini, pertemuan terakhir berakhir seri."
            else->null
        }
    }
    fun clear(){prefs.edit().remove("records").apply();refresh()}
    private fun refresh() {
        if(!enabled){summary="Memori rivalry dimatikan · permainan tidak dihantar ke awan";return}
        val data=records();var wins=0;var losses=0;var draws=0
        for(i in 0 until data.length())when(data.getJSONObject(i).optString("result")){"1-0"->wins++;"0-1"->losses++;"1/2-1/2"->draws++}
        summary="${data.length()} pertemuan · Cahaya $wins · Gelap $losses · Seri $draws"
    }
}
