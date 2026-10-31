package my.aksara.ai.data

import org.json.JSONArray
import org.json.JSONObject

/**
 * Native Gemini Live protocol contract. Provider names and audio formats are
 * allowlisted. Messages are JSON text frames; audio is base64 16-bit PCM.
 */
object GeminiLiveProtocol {
    val supportedModels = setOf(
        "gemini-3.8-live", "gemini-3.8-live-extended-thinking",
        "gemini-3.1-flash-live-preview"
    )
    fun setup(model: String, mode: String): String {
        require(model in supportedModels) { "Model Voice tidak disokong." }
        require(mode in listOf("cahaya", "gelap")) { "Mod tidak sah." }
        val system = "Kau AKSARA A.I. di aplikasi Android native. " +
            "Shaiful Ridhwan ialah pencipta aplikasi AKSARA dan penulis puisi gaya bebas. " +
            "Gunakan Bahasa Melayu Malaysia santai, AKU dan KAU, bukan saya/anda. " +
            "Jangan mendakwa kau ialah Shaiful. " +
            "Utamakan soalan pengguna dan akui ketidakpastian. " +
            if (mode == "gelap") "GELAP: berhujah kritis, teliti premis dan falsafah."
            else "CAHAYA: jawab jelas, mudah dan praktikal."
        val config = JSONObject()
            .put("responseModalities", JSONArray().put("AUDIO"))
            .put("speechConfig", JSONObject().put(
                "voiceConfig", JSONObject().put(
                    "prebuiltVoiceConfig", JSONObject().put("voiceName", "Aoede")
                )
            ))
        return JSONObject().put(
            "setup", JSONObject()
                .put("model", "models/" + model)
                .put("generationConfig", config)
                .put("contextWindowCompression", JSONObject()
                    .put("slidingWindow", JSONObject()))
                .put("sessionResumption", JSONObject())
                .put("realtimeInputConfig", JSONObject()
                    .put("automaticActivityDetection", JSONObject()))
                .put("inputAudioTranscription", JSONObject())
                .put("outputAudioTranscription", JSONObject())
                .put("systemInstruction", JSONObject().put("parts",
                    JSONArray().put(JSONObject().put("text", system))))
        ).toString()
    }
    fun microphone(base64Pcm: String): String {
        require(base64Pcm.isNotBlank() && base64Pcm.length <= 8192)
        return JSONObject().put("realtimeInput", JSONObject().put(
            "audio", JSONObject()
                .put("mimeType", "audio/pcm;rate=16000")
                .put("data", base64Pcm)
        )).toString()
    }
}
