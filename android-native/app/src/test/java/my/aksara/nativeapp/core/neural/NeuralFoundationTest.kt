package my.aksara.nativeapp.core.neural

import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.security.MessageDigest

class NeuralFoundationTest {
    private fun descriptor(hash: String) = NeuralModelDescriptor(
        id = "model-v1", runtime = "llama.cpp", sha256 = hash,
        minAvailableRamBytes = 512L * 1024L * 1024L,
        license = "Apache-2.0", downloadUrl = "https://example.org/model.gguf"
    )

    @Test fun descriptorRejectsInsecureTransport() {
        val hash = "a".repeat(64)
        assertTrue(descriptor(hash).validate())
        assertFalse(descriptor(hash).copy(downloadUrl = "http://example.org/model.gguf").validate())
        assertFalse(descriptor(hash).copy(id = "../escape").validate())
        assertFalse(descriptor(hash).copy(sha256 = "invalid").validate())
    }

    @Test fun integrityRejectsCorruptedFile() {
        val file = File.createTempFile("neural-test", ".bin")
        try {
            file.writeText("trusted content")
            val hash = MessageDigest.getInstance("SHA-256").digest(file.readBytes())
                .joinToString("") { "%02x".format(it) }
            assertTrue(NeuralModelIntegrity.verifySha256(file, hash))
            file.appendText("tampered")
            assertFalse(NeuralModelIntegrity.verifySha256(file, hash))
        } finally {
            file.delete()
        }
    }
}
