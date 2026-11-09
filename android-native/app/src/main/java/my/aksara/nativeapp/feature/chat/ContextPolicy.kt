package my.aksara.nativeapp.feature.chat

import my.aksara.nativeapp.core.storage.Message
import my.aksara.nativeapp.core.storage.ThoughtEntry
import java.util.Locale

/**
 * Request-local adapter of the web Context Manager 3.0 selection contract.
 * The server remains authoritative for reasoning, retrieval and provider routing.
 */
object ContextPolicy {
    fun mergeThoughtLedger(existing:List<ThoughtEntry>, incoming:List<ThoughtEntry>):List<ThoughtEntry> {
        val result=existing.toMutableList()
        incoming.take(6).forEach { item ->
            val idea=item.idea.trim().take(170)
            if(idea.isNotEmpty() && result.none { it.idea.equals(idea,ignoreCase=true) })
                result.add(ThoughtEntry(idea,item.status.take(35)))
        }
        return result.takeLast(12)
    }
    private val stop=setOf("yang","dan","atau","untuk","dalam","adalah","dengan","saya",
        "aku","kau","kamu","awak","pada","dari","tentang","apa","bagaimana","kenapa","itu","ini")
    private val correction=Regex("maksud aku|bukan begitu|bukan macam tu|sebenarnya|pembetulan|jangan ubah|jangan usik|aku pilih|keputusan akhir|kekalkan|yang aku nak",RegexOption.IGNORE_CASE)
    private val universal=Regex("bahasa|gaya|format|panggil|sentiasa|kekalkan|jangan|elakkan|pilihan|aku suka|aku tak suka|aku nak",RegexOption.IGNORE_CASE)
    private val ordinalWords=listOf("pertama","kedua","ketiga","keempat","kelima","keenam")
    private fun requestedOrdinal(question:String):Int {
        val choice=Regex("""\b(?:yang|pilihan|opsyen|cadangan|nombor|no\.?|item)\s*(pertama|kedua|ketiga|keempat|kelima|keenam|[1-6])\b""",
            RegexOption.IGNORE_CASE).find(question)?.groupValues?.get(1)?.lowercase(Locale.forLanguageTag("ms-MY")) ?: return 0
        return choice.toIntOrNull() ?: (ordinalWords.indexOf(choice)+1).coerceAtLeast(0)
    }
    private fun ordinalMention(text:String,index:Int):Boolean {
        if(index !in 1..6)return false
        val word=ordinalWords[index-1]
        return Regex("""(?:\b$word\b|(?:^|\n)\s*$index\s*[).:]|\b(?:pilihan|opsyen|cadangan|nombor)\s*$index\b)""",
            RegexOption.IGNORE_CASE).containsMatchIn(text)
    }
    private fun tokens(text:String):Set<String> = Regex("[\\p{L}\\p{N}]{3,}").findAll(text.lowercase(Locale.forLanguageTag("ms-MY")))
        .map { it.value }.filter { it !in stop }.take(72).toSet()
    fun selectHistory(messages:List<Message>,question:String,maxChars:Int=28_000):List<Message> {
        val rows=messages.filter { !it.incomplete && it.text.isNotBlank() && it.role in setOf("user","assistant") }.takeLast(70)
        if(rows.isEmpty())return emptyList()
        val chosen=mutableSetOf<Int>()
        var remaining=maxChars.coerceIn(1000,60_000)
        fun include(i:Int):Boolean {
            if(rows[i].text.length > remaining || chosen.contains(i) || chosen.size>=24)return false
            chosen.add(i);remaining -= rows[i].text.length
            return true
        }
        val recentStart=(rows.size-7).coerceAtLeast(0)
        for(i in rows.lastIndex downTo recentStart)include(i)
        // The backend resolves URL follow-ups from recent user turns. Preserve the
        // referenced turn when relevance scoring would otherwise drop it.
        val followUpUrl=Regex("(?:\\b(?:buka|baca|lawat|layari|melayari|masuk|tengok|lihat|review|semak|audit|periksa|analisis|check)\\b.{0,55}\\b(?:web|website|laman|link|pautan|url)\\b|\\b(?:web|website|laman|link|pautan|url)\\b.{0,35}\\b(?:tadi|itu|tu|tersebut)\\b|^(?:review|audit|buka|baca|masuk|semak|tengok|lihat)\\s+(?:yang\\s+)?(?:tadi|tu|itu)\\b)",RegexOption.IGNORE_CASE)
        val denied=Regex("\\b(?:jangan|tak\\s+(?:nak|perlu)|tidak\\s+(?:mahu|perlu)|don't|never)\\b",RegexOption.IGNORE_CASE)
        val url=Regex("https?://[^\\s<>\"']+",RegexOption.IGNORE_CASE)
        val q=question.trim()
        if(q.length in 3..180 && !denied.containsMatchIn(q) && !url.containsMatchIn(q) && followUpUrl.containsMatchIn(q)) {
            val index=(rows.lastIndex downTo (rows.size-18).coerceAtLeast(0))
                .firstOrNull { rows[it].role=="user" && url.containsMatchIn(rows[it].text) }
            if(index!=null) include(index)
        }
        val query=tokens(question)
        val ordinal=requestedOrdinal(question)
        val followUp=Regex("^(lagi|teruskan|sambung|yang tadi|yang tu|itu|dia|kenapa|bukan tu|pastu|lepas tu|jadi|macam mana|okay|ya)\\b",RegexOption.IGNORE_CASE)
            .containsMatchIn(question.trim())
        val candidates=(0 until recentStart).mapNotNull { i ->
            val row=rows[i]
            val overlap=tokens(row.text).count { it in query }
            val correctionHit=row.role=="user"&&correction.containsMatchIn(row.text)
            val ordinalHit=ordinalMention(row.text,ordinal)
            if(overlap==0&&!correctionHit&&!ordinalHit)null else
                i to (overlap*6+(if(ordinalHit)19 else 0)+
                    (if(correctionHit)if(followUp)12 else 5 else 0)+i.toDouble()/rows.size)
        }.sortedWith(compareByDescending<Pair<Int,Double>> { it.second }.thenByDescending { it.first })
        for((i,_) in candidates.take(9)) {
            // Preserve the adjacent turn that introduced an older retrieved answer.
            // A disconnected assistant response can otherwise imply the wrong subject.
            if(rows[i].role=="assistant" && i>0 && rows[i-1].role=="user" && i-1<recentStart)
                include(i-1)
            include(i)
            if(rows[i].role=="user" && i+1<recentStart && rows[i+1].role=="assistant")
                include(i+1)
        }
        // Backend boundedHistory allows 24 messages at most.
        return rows.filterIndexed { i,_ -> i in chosen }
    }
    fun summaryWindow(size:Int,summarizedThrough:Int):IntRange? {
        val start=summarizedThrough.coerceIn(0,size)
        if(size<20 || size-start<12)return null
        val end=minOf(size-12,start+18)
        if(end-start<4)return null
        return start until end
    }
    fun selectMemory(notes:String,question:String):String {
        val raw=notes.trim().take(8000)
        if(raw.length<=1400)return raw
        val target=tokens(question)
        val pieces=raw.split(Regex("\\n+")).map { it.trim() }.filter { it.isNotEmpty() }.take(80)
        val ranked=pieces.mapIndexed { i,item ->
            val overlap=tokens(item).count { it in target }
            val global=universal.containsMatchIn(item)
            Triple(i,item,overlap*8+(if(global)4 else 0))
        }.filter { it.third>0 }.sortedWith(compareByDescending<Triple<Int,String,Int>> { it.third }.thenBy { it.first })
        var left=2800
        val selection=mutableListOf<Pair<Int,String>>()
        for((i,item,_) in ranked) {
            if(item.length>left)continue
            selection.add(i to item)
            left -= item.length+2
            if(selection.size>=8||left<80)break
        }
        return selection.sortedBy { it.first }.joinToString("\n\n") { it.second }
    }
}
