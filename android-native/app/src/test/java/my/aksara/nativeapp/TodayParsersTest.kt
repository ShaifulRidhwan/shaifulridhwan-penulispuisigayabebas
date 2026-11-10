package my.aksara.nativeapp

import my.aksara.nativeapp.feature.today.TodayParsers
import org.junit.Assert.*
import org.junit.Test

class TodayParsersTest {
    @Test fun weatherUsesActualForecastFields() {
        val result=TodayParsers.weather("""{
            "current":{"temperature_2m":30.6,"weather_code":61,"wind_speed_10m":13},
            "daily":{"precipitation_probability_max":[87]}
        }""")
        assertEquals(30.6,result.celsius,0.001)
        assertEquals(61,result.code)
        assertEquals(87,result.rainChance)
    }

    @Test fun jakimTimesRequireFiveActualPrayerFields() {
        val result=TodayParsers.prayer("""{"prayerTime":[{
            "hijri":"1448-05-01","fajr":"05:48:00","dhuhr":"13:00:00",
            "asr":"16:21:00","maghrib":"18:58:00","isha":"20:10:00"
        }]}""","SGR01")
        assertEquals("SGR01",result.zone)
        assertEquals(5,result.times.size)
        assertEquals("05:48",result.times.first().second)
        assertEquals("Isyak",result.times.last().first)
    }

    @Test fun refusesIncompletePrayerTime() {
        try {
            TodayParsers.prayer("""{"prayerTime":[{"fajr":"05:48:00"}]}""","SGR01")
            fail("Must not display incomplete timetable")
        } catch (_:IllegalArgumentException) { }
    }

    @Test fun zonesComeFromLocationResponseNotHardcoded() {
        assertEquals("SGR01",TodayParsers.zone("""{"zone":"SGR01"}"""))
        assertEquals("JHR02",TodayParsers.zone("""{"data":{"zone":"JHR02"}}"""))
    }

    @Test fun pricesDisplaySource24hChanges() {
        val input="""[
         {"symbol":"BTC","quotes":{"USD":{"price":70000,"percent_change_24h":-2.5}}},
         {"symbol":"ETH","quotes":{"USD":{"price":2100,"percent_change_24h":0.7}}},
         {"symbol":"SOL","quotes":{"USD":{"price":90,"percent_change_24h":1.2}}}
        ]"""
        val coins=TodayParsers.coins(input)
        assertEquals(listOf("BTC","ETH","SOL"),coins.map { it.symbol })
        assertEquals(-2.5,coins[0].change24h,0.001)
    }

    @Test fun commitCiOnlyMatchesLatestHeadSha() {
        val result=TodayParsers.commit("""{
            "commits":[{"sha":"abcdef123456789","html_url":"https://github.com/example/commit/abcdef123456789",
             "commit":{"message":"Fix Android\nextra details","committer":{"date":"2026-11-10T17:00:00Z"}}}],
            "workflow_runs":[
                {"head_sha":"oldsha","status":"completed","conclusion":"failure"},
                {"head_sha":"abcdef123456789","status":"completed","conclusion":"success","html_url":"https://github.com/example/actions/runs/123"}
            ]
        }""")
        assertEquals("abcdef1",result.sha.take(7))
        assertEquals("Fix Android",result.message)
        assertEquals("Lulus",result.ci)
    }

    @Test fun neverClaimsCiSuccessWhenNoMatchingRun() {
        val result=TodayParsers.commit("""{
            "commits":[{"sha":"abcdef123456789","html_url":"https://github.com/example/commit/abcdef123456789",
             "commit":{"message":"Latest","committer":{"date":"2026-11-10T17:00:00Z"}}}],
            "workflow_runs":[{"head_sha":"oldsha","status":"completed","conclusion":"success"}]
        }""")
        assertEquals("Belum disahkan",result.ci)
    }
}
