package my.aksara.nativeapp.core.neural

import java.nio.ByteBuffer
import java.nio.CharBuffer
import java.nio.charset.CodingErrorAction

/** Decode only complete UTF-8 code points; GGUF token boundaries are byte boundaries. */
internal class NeuralUtf8Stream {
    private val decoder = Charsets.UTF_8.newDecoder()
        .onMalformedInput(CodingErrorAction.REPLACE).onUnmappableCharacter(CodingErrorAction.REPLACE)
    private var pending = byteArrayOf()
    fun append(bytes: ByteArray, end: Boolean = false): String {
        val input = ByteBuffer.wrap(pending + bytes)
        val output = CharBuffer.allocate(input.remaining() + 2)
        decoder.decode(input, output, end).throwExceptionIfError()
        pending = ByteArray(input.remaining()).also { input.get(it) }
        if (end) decoder.flush(output).throwExceptionIfError()
        output.flip()
        return output.toString()
    }
    private fun java.nio.charset.CoderResult.throwExceptionIfError() { if (isError) throwException() }
}

internal object NeuralGenerationPolicy {
    private val greetings = setOf("oi", "hai", "hi", "hello", "helo", "salam")
    fun isGreeting(text: String) = text.trim().lowercase() in greetings
    fun userTurn(text: String, reasoning: Boolean) = NeuralTurn("user", "$text\n${if (reasoning) "/think" else "/no_think"}")
    fun outputLimit(text: String, firstTurn: Boolean, reasoning: Boolean) = when {
        reasoning -> 256
        isGreeting(text) -> 48
        text.length <= 40 && firstTurn -> 96
        else -> 256
    }
}
