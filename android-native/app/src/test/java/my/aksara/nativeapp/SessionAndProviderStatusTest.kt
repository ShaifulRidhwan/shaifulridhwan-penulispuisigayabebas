package my.aksara.nativeapp

import my.aksara.nativeapp.core.storage.Message
import my.aksara.nativeapp.feature.chat.ProviderConnectionStatus
import my.aksara.nativeapp.feature.chat.groupSessions
import org.junit.Assert.*
import org.junit.Test

class SessionAndProviderStatusTest {
    private val ids = ProviderConnectionStatus.expected
    @Test fun readyIsNotARealOutageOrFakeConnection() {
        assertEquals("Connected",ProviderConnectionStatus.label(ids.map { it to "online" }))
        assertEquals("Ready",ProviderConnectionStatus.label(ids.mapIndexed { i,id -> id to if(i==0)"online" else "ready" }))
        assertEquals("Degraded",ProviderConnectionStatus.label(ids.mapIndexed { i,id -> id to if(i==2)"offline" else "online" }))
        assertEquals("Offline",ProviderConnectionStatus.label(ids.map { it to "off" }))
        assertEquals("Unverified",ProviderConnectionStatus.label(emptyList()))
        assertEquals("Backend unreachable",ProviderConnectionStatus.label(listOf("backend" to "Backend unreachable")))
        assertEquals("Status unavailable",ProviderConnectionStatus.label(listOf("backend" to "Backend error: 429")))
    }
    @Test fun splitsOnlyAtSavedBoundariesAndKeepsEveryLegacyMessage() {
        val messages=listOf(Message("a","user","Pertama",1), Message("b","assistant","Jawab",2),
            Message("c","user","Kedua",3),Message("d","assistant","Balas",4))
        val legacy=groupSessions(messages,emptyList())
        assertEquals(1,legacy.size)
        assertEquals(messages,legacy.single().messages)
        val sessions=groupSessions(messages,listOf("a","c"))
        assertEquals(listOf("a","c"),sessions.map { it.startId })
        assertEquals(listOf(2,2),sessions.map { it.messages.size })
        assertEquals("Kedua",sessions.last().title)
        assertTrue(groupSessions(emptyList(),listOf("a")).isEmpty())
    }
}
