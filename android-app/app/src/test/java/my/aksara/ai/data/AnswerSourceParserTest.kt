package my.aksara.ai.data

import org.json.JSONArray
import org.junit.Assert.assertEquals
import org.junit.Test

class AnswerSourceParserTest {
    @Test fun rejectsNonHttpsSources() {
        val rows = JSONArray(
            """[{"title":"Bukti","url":"https://ms.wikipedia.org/wiki/Falsafah"},""" +
            """{"title":"Bad","url":"javascript:alert(1)"}]"""
        )
        val sources = AnswerSourceParser.read(rows)
        assertEquals(1, sources.size)
        assertEquals("Bukti", sources[0].title)
    }
}
