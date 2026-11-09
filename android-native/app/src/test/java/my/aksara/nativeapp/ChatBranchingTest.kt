package my.aksara.nativeapp

import my.aksara.nativeapp.core.storage.Message
import my.aksara.nativeapp.feature.chat.ChatBranching
import my.aksara.nativeapp.feature.chat.groupSessions
import my.aksara.nativeapp.feature.chat.mergeSessionArchive
import org.junit.Assert.*
import org.junit.Test

class ChatBranchingTest {
    private fun m(id: String, role: String, text: String, incomplete: Boolean = false) =
        Message(id, role, text, incomplete = incomplete)

    @Test fun editingAnEarlierUserTurnCopiesOnlyPriorHistoryAndPreservesOriginal() {
        val source = listOf(m("a","user","Pertama"),m("b","assistant","Jawapan pertama"),
            m("c","user","Kedua"),m("d","assistant","Jawapan kedua"))
        var next = 0
        val fork = ChatBranching.prefix(source,"c",false) { "fork-${++next}" }!!
        assertEquals(listOf("Pertama","Jawapan pertama"),fork.map { it.text })
        assertTrue(fork.none { it.id in source.map(Message::id) })
        assertEquals(4,source.size)
        assertEquals("Kedua",source[2].text)
        val added = fork + m("new","user","Kedua yang telah diedit")
        val archive = mergeSessionArchive(source,added)
        assertEquals(7,archive.size)
        assertEquals(2,groupSessions(archive,listOf("a",fork.first().id)).size)
    }

    @Test fun regenerateOnlyFromCompletedTextQuestions() {
        val source=listOf(m("1","user","Kenapa langit biru?"),
            m("2","assistant","Cahaya berselerak."),
            m("3","user","Analisis\n\n[Lampiran: foto.jpg]"),
            m("4","assistant","Analisis gambar."))
        assertEquals("1",ChatBranching.questionForRegeneration(source,"2")?.id)
        assertEquals("1",ChatBranching.questionForRegeneration(source,"4")?.id)
        assertFalse(ChatBranching.editable(source[2]))
        assertNull(ChatBranching.questionForRegeneration(source,"3"))
        assertNull(ChatBranching.questionForRegeneration(source+"".let{ listOf(m("5","assistant","Separuh",true)) },"5"))
    }

    @Test fun forkRejectsStaleIdsAndPendingResponses() {
        val messages=listOf(m("u","user","Soalan"),m("a","assistant","Separuh",true))
        assertNull(ChatBranching.prefix(messages,"a",true))
        assertNull(ChatBranching.prefix(messages,"missing",true))
        assertEquals(1,ChatBranching.prefix(messages,"u",true)?.size)
    }
}
