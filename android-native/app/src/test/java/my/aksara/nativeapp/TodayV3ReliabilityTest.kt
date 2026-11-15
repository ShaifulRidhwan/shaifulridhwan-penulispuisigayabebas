package my.aksara.nativeapp

import my.aksara.nativeapp.feature.today.*
import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDate
import java.time.LocalTime

/** Deterministic checks: no provider request, account credential or Android device is required. */
class TodayV3ReliabilityTest {
    @Test fun weeklyJakimUsesOnlyMatchingDayAndTomorrowSubuh() {
        val prayer=TodayParsers.prayer("""
            {"prayerTime":[
              {"date":"15-Nov-2026","hijri":"1448-06-05","fajr":"05:46","dhuhr":"13:10","asr":"16:31","maghrib":"19:03","isha":"20:14"},
              {"date":"16-Nov-2026","hijri":"1448-06-06","fajr":"05:47","dhuhr":"13:10","asr":"16:31","maghrib":"19:03","isha":"20:14"}]}
        """.trimIndent(),"SGR01",LocalDate.of(2026,11,15))
        assertEquals("05:46",prayer.times.first().second)
        assertEquals("05:47",prayer.nextDaySubuh)
        val next=nextPrayer(prayer,LocalTime.of(21,0))
        assertEquals("Subuh",next?.first)
        assertEquals("8 jam 47 minit",next?.second)
        assertTrue(prayerTimelineProgress(prayer,LocalTime.of(21,0))!! in 0f..1f)
    }

    @Test fun staleOrMismatchedJakimWeekCannotMasqueradeAsToday() {
        val old="""{"prayerTime":[{"date":"14-Nov-2026","fajr":"05:42","dhuhr":"13:10",
            "asr":"16:30","maghrib":"19:00","isha":"20:10"}]}"""
        assertThrows(IllegalArgumentException::class.java) {
            TodayParsers.prayer(old,"SGR01",LocalDate.of(2026,11,15))
        }
        val incomplete=TodayPrayer("SGR01","",listOf(
            "Subuh" to "05:42","Zohor" to "13:10","Asar" to "16:30",
            "Maghrib" to "19:00","Isyak" to "20:10"))
        assertNull(nextPrayer(incomplete,LocalTime.of(22,0)))
        assertNull(prayerTimelineProgress(incomplete,LocalTime.of(22,0)))
    }

    @Test fun webAuditDoesNotOverrideAndroidBuildConclusion() {
        val json="""{"commits":[{"sha":"123456789abcdef","html_url":"https://github.com/owner/repo/commit/123",
          "commit":{"message":"feature update","committer":{"date":"2026-11-15T12:00:00Z"},
          "author":{"name":"Builder"}}}],
          "workflow_runs":[
          {"head_sha":"123456789abcdef","name":"Web Audit","status":"completed","conclusion":"success"},
          {"head_sha":"123456789abcdef","name":"AKSARA Android Full Linux (owner)","status":"completed",
           "conclusion":"failure","html_url":"https://github.com/owner/repo/actions/runs/123"}],
          "events":[]}"""
        assertEquals("Gagal",TodayParsers.commit(json).ci)
    }

    @Test fun freshnessDifferentiatesCachedAndUnavailable() {
        assertEquals(TodayFreshness.LIVE,TodayFeed(31.0,false,123L).freshness)
        assertEquals(TodayFreshness.CACHED,TodayFeed(31.0,true,123L).freshness)
        assertEquals(TodayFreshness.UNAVAILABLE,TodayFeed<Double>(null,false,null).freshness)
        assertEquals(TodayFreshness.STALE,TodayFeed(31.0,true,123L,
            TodayFreshness.STALE,"HTTP 429").freshness)
    }

    @Test fun cryptoCanShowPartialVerifiedQuotesWithoutInventingThirdAsset() {
        val quotes=TodayParsers.coins("""
            [{"symbol":"BTC","quotes":{"USD":{"price":90000.0,"percent_change_24h":-1.0}}}]
        """.trimIndent())
        assertEquals(1,quotes.size)
        assertEquals("BTC",quotes.single().symbol)
        assertThrows(IllegalArgumentException::class.java) { TodayParsers.coins("[]") }
    }

    @Test fun locationPermissionRationaleNeverAppearsWhenAlreadyGranted() {
        assertFalse(shouldShowTodayLocationIntro(true,true,false))
        assertTrue(shouldShowTodayLocationIntro(true,false,false))
        assertFalse(shouldShowTodayLocationIntro(false,false,false))
    }
}
