package my.aksara.ai.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class GeminiLiveProtocolTest {
    @Test fun makesConstrainedSetup() {
        val data = JSONObject(GeminiLiveProtocol.setup("gemini-3.8-live", "gelap"))
        val setup = data.getJSONObject("setup")
        assertEquals("models/gemini-3.8-live", setup.getString("model"))
        assertTrue(setup.getJSONObject("systemInstruction").toString().contains("GELAP"))
        assertEquals("AUDIO", setup.getJSONObject("generationConfig")
            .getJSONArray("responseModalities").getString(0))
    }
    @Test(expected = IllegalArgumentException::class)
    fun refusesUnknownModel() {
        GeminiLiveProtocol.setup("gemini-unknown", "cahaya")
    }
    @Test fun usesExpectedMicrophoneFormat() {
        val data = JSONObject(GeminiLiveProtocol.microphone("AAAA"))
        assertEquals("audio/pcm;rate=16000",
            data.getJSONObject("realtimeInput").getJSONObject("audio")
                .getString("mimeType"))
    }
}
