package my.aksara.nativeapp.core.nexus.kernel

import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.nio.file.Files

class KernelWorkspaceTransactionsTest {
    @get:Rule val folder = TemporaryFolder()

    private fun instance(): Pair<KernelWorkspaceTransactions, File> {
        val workspace = folder.newFolder("workspace")
        val journal = folder.newFolder("private")
        return KernelWorkspaceTransactions(workspace, journal) to workspace
    }

    @Test fun createNeedsPreviewAndApprovalAndCanUndoAfterReopen() {
        val (transactions, workspace) = instance()
        val preview = transactions.previewUpsert("docs/report.txt", "Versi pertama")
        val file = File(workspace, "docs/report.txt")
        assertFalse(file.exists())
        assertEquals(KernelWriteOperation.UPSERT, preview.operation)
        assertTrue(preview.details.contains("ASAL").not())
        val receipt = transactions.commit(preview)
        assertEquals("Versi pertama", file.readText())
        assertEquals("UPSERT", receipt.action)
        val restarted = KernelWorkspaceTransactions(workspace, File(folder.root, "private"))
        val undo = requireNotNull(restarted.previewRollback())
        assertEquals(KernelWriteOperation.ROLLBACK, undo.operation)
        restarted.commit(undo)
        assertFalse(file.exists())
    }

    @Test fun updateAndDeleteAreReversible() {
        val (transactions, workspace) = instance()
        val file = File(workspace, "source.txt")
        file.writeText("old value")
        val change = transactions.previewUpsert("source.txt", "new value")
        assertEquals("old value", file.readText())
        transactions.commit(change)
        assertEquals("new value", file.readText())
        val restore = requireNotNull(transactions.previewRollback())
        transactions.commit(restore)
        assertEquals("old value", file.readText())
        val delete = transactions.previewDelete("source.txt")
        transactions.commit(delete)
        assertFalse(file.exists())
        transactions.commit(requireNotNull(transactions.previewRollback()))
        assertEquals("old value", file.readText())
    }

    @Test fun alteredFileOrForgedPreviewCannotOverwrite() {
        val (transactions, workspace) = instance()
        val file = File(workspace, "safe.txt")
        file.writeText("start")
        val preview = transactions.previewUpsert("safe.txt", "replace")
        val forged = preview.copy(target = "other.txt")
        assertThrows(IllegalArgumentException::class.java) {
            transactions.commit(forged)
        }
        assertEquals("start", file.readText())
        // New preview is required after any concurrent modification by the terminal.
        val another = transactions.previewUpsert("safe.txt", "replace")
        file.writeText("terminal changed")
        assertThrows(IllegalArgumentException::class.java) {
            transactions.commit(another)
        }
        assertEquals("terminal changed", file.readText())
    }

    @Test fun noAbsoluteTraversalOrSymlinkEscape() {
        val (transactions, workspace) = instance()
        for (path in listOf("../private/secret", "/etc/passwd", "a/../../b", "a//b")) {
            assertThrows(IllegalArgumentException::class.java) {
                transactions.previewUpsert(path, "not allowed")
            }
        }
        val outside = folder.newFolder("outside")
        val link = File(workspace, "link")
        Files.createSymbolicLink(link.toPath(), outside.toPath())
        assertThrows(IllegalArgumentException::class.java) {
            transactions.previewUpsert("link/escape.txt", "not allowed")
        }
        assertFalse(File(outside, "escape.txt").exists())
    }

    @Test fun tokenPolicyIsNotBlanketDisabledButCannotAuthorizeForgedPreview() {
        val capability = KernelCapability("linux.workspace.write", "alpine-workspace",
            KernelRisk.WRITE_LOCAL)
        val preview = KernelChangePreview(capability.id, "notes.txt", "Update", "a".repeat(64))
        assertFalse(KernelTransactionPolicy.mayExecuteWrite(capability, preview))
        val withToken = preview.copy(token = "issued-by-transaction-engine")
        assertTrue(KernelTransactionPolicy.mayExecuteWrite(capability, withToken))
        // Only a preview object created by the transaction engine is executable.
        val (transactions, workspace) = instance()
        assertThrows(IllegalStateException::class.java) {
            transactions.commit(withToken)
        }
        assertFalse(File(workspace, "notes.txt").exists())
    }
}
