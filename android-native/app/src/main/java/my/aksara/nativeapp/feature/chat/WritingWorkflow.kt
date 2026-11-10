package my.aksara.nativeapp.feature.chat

/**
 * Opt-in writing guidance layered on the EXISTING Chat request. No second model, backend
 * router, storage, hidden file modification or automatic token-consuming review loop.
 * Only a leading explicit stage command activates the workflow.
 */
internal object WritingWorkflow {
    enum class Stage { RESEARCH, RAW, POLISH, BEDAH, TAJAM, LOCK }

    private val command = Regex("""^\\s*\\[?(RESEARCH|RAW|POLISH|BEDAH|TAJAM|LOCK)\\]?(?:\\s*[:：\\-—]\\s*|\\s*\\n|\\s*$)""",RegexOption.IGNORE_CASE)
    fun stage(question:String):Stage? {
        val match=command.find(question)?:return null
        return runCatching { Stage.valueOf(match.groupValues[1].uppercase(java.util.Locale.ROOT)) }.getOrNull()
    }

    fun forInference(question:String):String {
        val mode=stage(question)?:return question
        val guidance=when(mode) {
            Stage.RESEARCH -> "Teliti dakwaan fakta, rujukan budaya, falsafah dan sains dalam karya. Bezakan kebenaran bersumber, tafsiran dan lesen puitis. Gunakan hanya sumber yang benar-benar diperoleh melalui alat backend; jangan reka pautan atau mendakwa sudah menyemak jika tiada bukti."
            Stage.RAW -> "Bantu membina draf awal puisi gaya bebas atau prosa kreatif mengikut kehendak penulis. Jangan paksa bentuk, bilangan rangkap atau gaya tertentu; utamakan imejan asli dan maksud yang diminta."
            Stage.POLISH -> "Perhalusi karya dengan perubahan minimum yang bermakna. Kekalkan suara, maksud, imejan dan rentak asal. Jelaskan pembaikan utama tanpa memadam identiti penulis."
            Stage.BEDAH -> "Buat kritikan sastera yang tegas tetapi membina: imejan, metafora, rentak, struktur, klise, logik, falsafah dan ketulenan suara. Bezakan pemerhatian daripada tafsiran subjektif. Jangan memuji tanpa alasan atau menulis semula seluruh karya kecuali diminta."
            Stage.TAJAM -> "Edit hanya baris yang benar-benar lemah. Beri sebelum/selepas bagi perubahan terpilih dan alasan ringkas. Jangan menggantikan keseluruhan karya atau menukar makna asal tanpa izin."
            Stage.LOCK -> "Ini arahan memuktamadkan versi yang diluluskan dalam perbualan aktif. Jangan ubah satu pun aksara karya yang dibekalkan, dan jangan menyatakan bahawa fail, sandaran atau versi kekal sudah disimpan jika tiada tindakan sebenar. Nyatakan bahawa sebarang pengubahsuaian seterusnya memerlukan izin jelas penulis."
        }
        return "[AKSARA WRITING WORKFLOW · ${mode.name}; arahan eksplisit penulis]\\n"+
            guidance+"\\n[PERMINTAAN PENULIS ASAL]\\n"+question
    }
}
