package my.aksara.nativeapp.core.neural

import org.junit.Assert.*
import org.junit.Test

class NeuralGenerationPolicyTest {
    @Test fun utf8SurvivesEveryPossibleTokenBoundaryWithoutReplacementCharacters() {
        val text = "Bahasa Melayu · aksara 漢字 🧠 é\n"
        val encoded = text.toByteArray(Charsets.UTF_8)
        for (split in 0..encoded.size) {
            val stream = NeuralUtf8Stream()
            val result = stream.append(encoded.copyOfRange(0, split)) +
                stream.append(encoded.copyOfRange(split, encoded.size)) + stream.append(byteArrayOf(), true)
            assertEquals("split $split", text, result)
        }
        val stream = NeuralUtf8Stream()
        assertEquals(text, encoded.map { stream.append(byteArrayOf(it)) }.joinToString("") + stream.append(byteArrayOf(), true))
    }
    @Test fun incompleteCharacterIsBufferedUntilCompletedOrStreamEnds() {
        val stream = NeuralUtf8Stream()
        assertEquals("", stream.append(byteArrayOf(0xf0.toByte(), 0x9f.toByte())))
        assertEquals("🧠", stream.append(byteArrayOf(0xa7.toByte(), 0xa0.toByte())))
        assertEquals("", stream.append(byteArrayOf(), true))
    }
    @Test fun directivesHaveRealNewlinesAndDoNotMutateVisiblePrompt() {
        val visible = "oi"
        assertEquals("oi\n/no_think", NeuralGenerationPolicy.userTurn(visible, false).text)
        assertEquals("oi\n/think", NeuralGenerationPolicy.userTurn(visible, true).text)
        assertEquals("oi", visible)
    }
    @Test fun fastGreetingsAndReasoningHaveExplicitOutputBudgets() {
        assertTrue(NeuralGenerationPolicy.isGreeting(" HAI "))
        assertEquals(48, NeuralGenerationPolicy.outputLimit("oi", true, false))
        assertEquals(96, NeuralGenerationPolicy.outputLimit("Apa khabar?", true, false))
        assertEquals(256, NeuralGenerationPolicy.outputLimit("oi", true, true))
        assertEquals(256, NeuralGenerationPolicy.outputLimit("Sambung.", false, false))
    }
}
