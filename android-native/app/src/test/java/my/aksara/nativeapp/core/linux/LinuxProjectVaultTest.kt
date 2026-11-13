package my.aksara.nativeapp.core.linux

import org.junit.Assert.*
import org.junit.Test

class LinuxProjectVaultTest {
    @Test fun backupExcludesCommonSecrets() {
        assertFalse(LinuxVaultPaths.includeInBackup(".ssh/id_ed25519"))
        assertFalse(LinuxVaultPaths.includeInBackup(".config/gh/hosts.yml"))
        assertFalse(LinuxVaultPaths.includeInBackup("project/.env.production"))
        assertFalse(LinuxVaultPaths.includeInBackup("project/service.key"))
        assertFalse(LinuxVaultPaths.includeInBackup("project/../escape"))
        assertTrue(LinuxVaultPaths.includeInBackup("src/main.py"))
    }

    @Test fun importerRejectsPathTraversalAndAbsolutePaths() {
        assertNull(LinuxVaultPaths.zipImportPath("../secrets"))
        assertNull(LinuxVaultPaths.zipImportPath("workspace/../../secret"))
        assertNull(LinuxVaultPaths.zipImportPath("workspace/\\evil"))
        assertNull(LinuxVaultPaths.zipImportPath("/workspace/file.txt"))
        assertEquals("src/app.py", LinuxVaultPaths.zipImportPath("workspace/src/app.py"))
        assertEquals("metadata/apk-world.txt",
            LinuxVaultPaths.zipImportPath("metadata/apk-world.txt"))
    }
}
