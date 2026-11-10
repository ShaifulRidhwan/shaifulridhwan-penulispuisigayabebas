package my.aksara.nativeapp

import my.aksara.nativeapp.feature.today.TodayParsers
import my.aksara.nativeapp.feature.today.TodayPrayer
import my.aksara.nativeapp.feature.today.nextPrayer
import java.time.LocalTime
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
    @Test fun latestPushRequiresExactBranchAndHead() {
        val result=TodayParsers.commit("""{
            "commits":[{"sha":"abcdef123456789","html_url":"https://github.com/example/commit/abcdef123456789",
              "commit":{"message":"Fix Android","author":{"name":"Another Author"},
                "committer":{"date":"2026-11-10T17:00:00Z"}}}],
            "workflow_runs":[],
            "events":[
              {"type":"PushEvent","actor":{"login":"WrongUser"},"payload":{
                "ref":"refs/heads/main","head":"abcdef123456789","size":4}},
              {"type":"PushEvent","actor":{"login":"OldUser"},"payload":{
                "ref":"refs/heads/rebuild/aksara-android-native-v1","head":"oldsha","size":9}},
              {"type":"PushEvent","actor":{"login":"ShaifulRidhwan"},
                "created_at":"2026-11-10T18:00:00Z",
                "payload":{"ref":"refs/heads/rebuild/aksara-android-native-v1",
                  "head":"abcdef123456789","size":2}}
            ]
        }""")
        assertEquals("Another Author",result.author)
        assertEquals("ShaifulRidhwan",result.pushedBy)
        assertEquals(2,result.pushCount)
        assertEquals("2026-11-10T18:00:00Z",result.pushedAt)
    }

    @Test fun missingMatchingPushMustNotInventActor() {
        val result=TodayParsers.commit("""{
            "commits":[{"sha":"abcdef123456789",
              "commit":{"message":"Fix Android","author":{"name":"Shaiful"},
                "committer":{"date":"2026-11-10T17:00:00Z"}}}],
            "workflow_runs":[],
            "events":[{"type":"PushEvent","actor":{"login":"OtherUser"},
                "payload":{"ref":"refs/heads/rebuild/aksara-android-native-v1",
                  "head":"oldsha","size":3}}]
        }""")
        assertNull(result.pushedBy)
        assertNull(result.pushCount)
        assertEquals("Shaiful",result.author)
    }

    @Test fun prayerCountdownWrapsToTomorrowAfterIsyak() {
        val prayer=TodayPrayer("SGR01","1448-05-01",listOf(
            "Subuh" to "05:48","Zohor" to "13:00","Asar" to "16:21",
            "Maghrib" to "18:58","Isyak" to "20:10"))
        assertEquals("Subuh" to "7 jam 48 minit",nextPrayer(prayer,LocalTime.of(22,0)))
        assertEquals("Zohor" to "1 jam 0 minit",nextPrayer(prayer,LocalTime.of(12,0)))
        assertEquals("Zohor" to "15 minit",nextPrayer(prayer,LocalTime.of(12,45)))
    }

}
