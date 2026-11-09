package my.aksara.nativeapp

import my.aksara.nativeapp.core.storage.Message
import my.aksara.nativeapp.feature.chat.SessionTransferCodec
import my.aksara.nativeapp.feature.chat.groupSessions
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class SessionTransferCodecTest {
    private val rows=listOf(Message("a","user","Uji",100),
        Message("b","assistant","Jawapan",200,provider="gemini"),
        Message("c","user","Lagi",300))

    @Test fun exportImportPreservesConversationBoundariesWithoutReusingIds() {
        val json=SessionTransferCodec.encode(rows,listOf("a","c"))
        val imported=SessionTransferCodec.decode(json)
        assertEquals(listOf("Uji","Jawapan","Lagi"),imported.messages.map { it.text })
        assertEquals(2,groupSessions(imported.messages,imported.sessionStarts).size)
        assertTrue(imported.messages.none { it.id in listOf("a","b","c") })
        assertEquals("gemini",imported.messages[1].provider)
        assertFalse(json.contains("memoryNotes"))
        assertFalse(json.contains("fileUploads"))
    }

    @Test fun rejectsUnknownFormatAndInvalidRolesWithoutImportSideEffects() {
        assertThrows(IllegalArgumentException::class.java) { SessionTransferCodec.decode("{\"format\":\"unknown\",\"conversations\":[]}") }
        val json=JSONObject(SessionTransferCodec.encode(rows,listOf("a")))
        json.getJSONArray("conversations").getJSONArray(0).getJSONObject(0).put("role","system")
        assertThrows(IllegalArgumentException::class.java) { SessionTransferCodec.decode(json.toString()) }
    }

    @Test fun providerNamesAreSanitizedDuringImport() {
        val json=JSONObject(SessionTransferCodec.encode(rows,listOf("a")))
        json.getJSONArray("conversations").getJSONArray(0).getJSONObject(1)
            .put("provider","gemini\nunsafe")
        val snapshot=SessionTransferCodec.decode(json.toString())
        assertNull(snapshot.messages[1].provider)
    }

    @Test fun limitAndEmptyArchiveCannotBeMistakenForValidBackup() {
        assertThrows(IllegalArgumentException::class.java) { SessionTransferCodec.decode(" ") }
        assertThrows(IllegalArgumentException::class.java) {
            SessionTransferCodec.decode(SessionTransferCodec.encode(emptyList(),emptyList()))
        }
    }
}
