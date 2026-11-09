package my.aksara.nativeapp.feature.chat

/**
 * P2 user-selected research mode. It requests sources from the existing Web
 * research engine, but never claims the engine actually searched until the
 * response's researchStatus/toolsUsed/evidence show it.
 */
internal object ResearchRequest {
    fun forBackend(question:String,enabled:Boolean):String =
        if(!enabled)question else
            "Kajian sumber Web terkini yang diminta pengguna. Cari dan bandingkan sumber awam " +
            "berkaitan soalan di bawah, sertakan pautan yang benar-benar ditemui. " +
            "Bezakan fakta disahkan, petikan carian, anggaran dan perkara tidak pasti. " +
            "Jangan dakwa telah melayari halaman jika hanya ada snippet.\n\n" +
            "[SOALAN ASAL]\n"+question.trim()+"\n[TAMAT SOALAN ASAL]"
}
