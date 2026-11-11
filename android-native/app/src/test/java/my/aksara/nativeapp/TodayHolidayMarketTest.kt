package my.aksara.nativeapp

import my.aksara.nativeapp.feature.today.*
import org.junit.Assert.*
import org.junit.Test

class TodayHolidayMarketTest {
    @Test fun holidayParserReadsPublishedDatesAndTentative() {
        val result=TodayHolidayParser.parse(
            """{"data":[{"name":"Hari Test","date":"2026-11-11","is_subject_to_change":true},{"name":"Invalid","date":"no-date"}]}""")
        assertEquals(1,result.size)
        assertEquals("Hari Test",result.single().name)
        assertTrue(result.single().tentative)
        assertEquals("2026-11-11",result.single().date.toString())
    }
    @Test fun holidayStatesDoNotGuessWithoutValidRegion() {
        assertEquals("SGR",MalaysiaHolidayStates.fromName("Selangor"))
        assertEquals("PNG",MalaysiaHolidayStates.fromName("Penang"))
        assertNull(MalaysiaHolidayStates.fromName(null))
    }
    @Test fun priceIdsDoNotRenameLegacyTokenSilently() {
        assertFalse(TodayMarketIds.mapped.containsKey("MATIC"))
        val quotes=TodayMarketIds.parse(
            """{"bitcoin":{"usd":72500.25,"usd_24h_change":-1.1,"last_updated_at":1800000000},"ethereum":{"usd":2100.0}}""")
        assertEquals(2,quotes.size)
        assertEquals(72500.25,quotes["BTC"]!!.usd,0.01)
        assertNull(quotes["ETH"]!!.change24h)
        assertFalse(quotes.containsKey("MATIC"))
    }
}
