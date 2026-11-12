package my.aksara.nativeapp.core.neural

import java.io.File
import java.security.MessageDigest
import kotlinx.coroutines.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.*
import org.junit.Test

/** Tiny genuine transfer fixtures, synthetic HTTP responses; no model weights or inference mocks. */
class NeuralManagementTest {
    private val payload = "GGUFtest-model-fixture".toByteArray()
    private fun descriptor(bytes: ByteArray = payload) = NeuralModelDescriptor("fixture", "llama.cpp",
        MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) },
        1024, "test-only", "https://example.org/fixture.gguf", bytes.size.toLong())
    private fun client(code: Int = 200, bytes: ByteArray = payload) = OkHttpClient.Builder().addInterceptor { chain ->
        Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(code).message("fixture")
            .body(bytes.toResponseBody("application/octet-stream".toMediaType())).build()
    }.build()
    private fun directory() = java.nio.file.Files.createTempDirectory("neural-fixture").toFile()
    @Test fun successfulTransferVerifiesAndAtomicallyInstallsGguf() = runBlocking {
        val dir = directory()
        try {
            val store = NeuralModelStore(dir); var count = 0L
            val result = NeuralModelDownloader(store, client()).download(descriptor()) { n, _ -> count = n }.getOrThrow()
            assertEquals("gguf", result.extension)
            assertArrayEquals(payload, result.readBytes())
            assertEquals(payload.size.toLong(), count)
            assertEquals(result, store.installedModel(descriptor()))
            assertEquals(1, dir.listFiles()!!.size)
        } finally { dir.deleteRecursively() }
    }
    @Test fun httpFailureTruncationAndChecksumMismatchNeverInstall() = runBlocking {
        val dir = directory()
        try {
            val store = NeuralModelStore(dir)
            assertTrue(NeuralModelDownloader(store, client(503)).download(descriptor()).isFailure)
            assertTrue(NeuralModelDownloader(store, client(bytes = payload.dropLast(1).toByteArray())).download(descriptor()).isFailure)
            val corrupt = payload.clone().also { it[it.lastIndex] = 0 }
            assertTrue(NeuralModelDownloader(store, client(bytes = corrupt)).download(descriptor()).isFailure)
            assertNull(store.installedModel(descriptor()))
            assertTrue(dir.listFiles()!!.isEmpty())
        } finally { dir.deleteRecursively() }
    }
    @Test fun cancelledImportCleansPartialAndPreservesPreviousInstallation() = runBlocking {
        val dir = directory()
        try {
            val store = NeuralModelStore(dir)
            NeuralModelDownloader(store, client()).download(descriptor()).getOrThrow()
            val task = launch(Dispatchers.IO) {
                store.importStream(payload.inputStream(), descriptor(), coroutineContext) { _, _ -> cancel() }
            }
            task.join()
            assertTrue(task.isCancelled)
            assertArrayEquals(payload, store.installedModel(descriptor())!!.readBytes())
            assertEquals(1, dir.listFiles()!!.size)
        } finally { dir.deleteRecursively() }
    }
    @Test fun recoveryRemovesInterruptedFilesAndDeletionRemovesModel() = runBlocking {
        val dir = directory()
        try {
            val store = NeuralModelStore(dir)
            File(dir, "interrupted.part").writeText("partial")
            store.recover(); assertTrue(dir.listFiles()!!.isEmpty())
            NeuralModelDownloader(store, client()).download(descriptor()).getOrThrow()
            assertTrue(store.uninstall(descriptor())); assertNull(store.installedModel(descriptor()))
        } finally { dir.deleteRecursively() }
    }
    @Test fun activationDiagnosesMissingTruncatedAndWrongDigestWithoutDeletingUserFile() {
        val dir = directory()
        try {
            val store = NeuralModelStore(dir)
            fun failure() = runCatching { store.requireInstalledModel(descriptor()) }.exceptionOrNull()!!.message.orEmpty()
            assertTrue(failure().startsWith("MODEL_MISSING:"))
            val file = store.target(descriptor())
            file.writeBytes(payload.copyOf(8))
            assertTrue(failure().startsWith("GGUF_SIZE_MISMATCH:"))
            file.writeBytes(payload.clone().also { it[it.lastIndex] = 0 })
            assertTrue(failure().startsWith("SHA256_MISMATCH:"))
            assertTrue(file.exists())
            file.writeBytes(payload)
            assertEquals(file, store.requireInstalledModel(descriptor()))
        } finally { dir.deleteRecursively() }
    }
    @Test fun memoryEligibilityRejectsEightGbDeviceAndThermalPressure() {
        val snapshot = NeuralDeviceSnapshot(8L shl 30, 6L shl 30, false, listOf("arm64-v8a"), 20L shl 30, 35)
        assertNotNull(snapshot.loadingIssue(NeuralModelCatalog.entries.last().model!!))
        assertNull(snapshot.loadingIssue(NeuralModelCatalog.entries.first().model!!))
        assertNotNull(snapshot.copy(thermalStatus = 3).loadingIssue(NeuralModelCatalog.entries.first().model!!))
        assertNotNull(snapshot.copy(supportedAbis = listOf("x86_64")).loadingIssue(NeuralModelCatalog.entries.first().model!!))
    }
    @Test fun catalogIsPinnedToAuditedPublisherRevisions() {
        assertEquals(4, NeuralModelCatalog.entries.size)
        NeuralModelCatalog.entries.forEach { entry ->
            val model = entry.model!!
            assertTrue(entry.canDownload)
            assertTrue(model.sourceRevision.matches(Regex("[0-9a-f]{40}")))
            assertTrue(model.downloadUrl.contains("/resolve/${model.sourceRevision}/"))
            assertTrue(model.sizeBytes > 0)
            assertEquals("Apache-2.0", model.license)
        }
    }
}
