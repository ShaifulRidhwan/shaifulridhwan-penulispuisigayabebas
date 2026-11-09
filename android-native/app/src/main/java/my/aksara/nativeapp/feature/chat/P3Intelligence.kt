package my.aksara.nativeapp.feature.chat

import my.aksara.nativeapp.core.storage.Message
import org.json.JSONObject
import java.util.Locale

/**
 * P3 local inspection/preview only. Netlify Web Brain is authoritative for model
 * inference, planning, tool execution, second-model review and answer verification.
 * Never present this deterministic preview as an executed agent plan.
 */
internal object P3Intelligence {
    data class PlanStep(val label:String,val executed:Boolean=false)
    data class TopicEdge(val first:String,val second:String,val mentions:Int)
    data class Capability(val provider:String,val name:String,val configured:Boolean)

    fun previewPlan(input:String):List<PlanStep> {
        val text=input.trim().take(3000)
        if(text.isBlank())return emptyList()
        val numbered=text.lines().map { it.trim() }.filter {
            Regex("""^(?:\d{1,2}[.)]|[-•])\s+\S""").containsMatchIn(it)
        }.map { it.replace(Regex("""^(?:\d{1,2}[.)]|[-•])\s+"""),"").take(180) }
        if(numbered.size>=2)return numbered.take(8).map(::PlanStep)
        val clauses=text.split(Regex("""(?i)\s*(?:;\s*|,\s*(?:kemudian|selepas itu|pastu)\s*|\b(?:dan kemudian|lepas itu|selepas itu|seterusnya)\b)\s*"""))
            .map{it.trim(' ','\n','.').take(180)}.filter{it.length>=5}.take(8)
        return if(clauses.size>=2)clauses.map(::PlanStep) else emptyList()
    }

    /** Only counts explicit co-mentions in locally saved user turns. */
    fun topicLinks(messages:List<Message>):List<TopicEdge> {
        val patterns=listOf(
            "Android" to Regex("""\bandroid\b|\bapk\b""",RegexOption.IGNORE_CASE),
            "Chatbox" to Regex("""\bchat\b|\bchatbox\b|\bmesej\b""",RegexOption.IGNORE_CASE),
            "Voice" to Regex("""\bvoice\b|\bmikrofon\b|\baudio\b""",RegexOption.IGNORE_CASE),
            "Studio" to Regex("""\bstudio\b|\bflux\b|\bimej\b""",RegexOption.IGNORE_CASE),
            "Netlify" to Regex("""\bnetlify\b|\bbackend\b""",RegexOption.IGNORE_CASE),
            "Memori" to Regex("""\bmemori\b|\bsesi\b|\bkonteks\b""",RegexOption.IGNORE_CASE),
            "Keselamatan" to Regex("""\bprivasi\b|\bsecurity\b|\bpermission\b""",RegexOption.IGNORE_CASE)
        )
        val counts=linkedMapOf<Pair<String,String>,Int>()
        messages.asSequence().filter{it.role=="user"&&!it.incomplete}.takeLast(300).forEach{turn->
            val detected=patterns.filter{it.second.containsMatchIn(turn.text.take(2200))}.map{it.first}
            for(i in 0 until detected.size)for(j in i+1 until detected.size){
                val key=detected[i] to detected[j]
                counts[key]=(counts[key]?:0)+1
            }
        }
        return counts.map{(key,count)->TopicEdge(key.first,key.second,count)}
            .sortedWith(compareByDescending<TopicEdge>{it.mentions}.thenBy{it.first}).take(8)
    }

    /**
     * Capability booleans are provider-advertised CONFIGURATION, never proof
     * of a successful tool invocation, accurate model or guaranteed free quota.
     */
    fun inventory(data:JSONObject):List<Capability> {
        val snapshot=data.optJSONObject("capabilities") ?: return emptyList()
        val rows=mutableListOf<Capability>()
        val providers=snapshot.keys()
        while(providers.hasNext()&&rows.size<40) {
            val provider=providers.next().take(30)
            val manifest=snapshot.optJSONObject(provider)?:continue
            val keys=manifest.keys()
            while(keys.hasNext()&&rows.size<40) {
                val key=keys.next()
                if(manifest.opt(key) is Boolean)
                    rows+=Capability(provider,key.take(60),manifest.optBoolean(key))
            }
        }
        return rows.sortedWith(compareBy<Capability>{it.provider}.thenBy{it.name})
    }

    fun reviewLabel(reviewApplied:Boolean?,evidence:String):String {
        val review=when(reviewApplied) {
            true->"Semakan model dilaporkan berlaku"
            false->"Semakan model tidak digunakan"
            null->"Status semakan model tidak dilaporkan"
        }
        return review+" · "+when(evidence){
            "page_text"->"Teks halaman dirujuk, bukan jaminan kebenaran"
            "grounded_search","search_excerpt"->"Bukti petikan/carían, bukan pembacaan penuh"
            "links_only"->"Pautan sahaja"
            else->"Tiada pengesahan luaran"
        }
    }
}
