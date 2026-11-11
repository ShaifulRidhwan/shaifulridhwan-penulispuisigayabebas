package my.aksara.nativeapp

import my.aksara.nativeapp.feature.today.TodayDetailParsers
import my.aksara.nativeapp.feature.today.TodayShariahReference
import org.junit.Assert.*
import org.junit.Test

class TodayDetailParsersTest {
    @Test fun readsRealHourlyAndDailyForecastFields() {
        val raw="""{
            "hourly":{"time":["2026-11-11T09:00","2026-11-11T10:00"],
             "temperature_2m":[28,29],"apparent_temperature":[32,34],
             "relative_humidity_2m":[78,72],"precipitation_probability":[60,70]},
            "daily":{"time":["2026-11-11","2026-11-12"],
             "temperature_2m_max":[31,32],"temperature_2m_min":[24,25],
             "precipitation_probability_max":[85,90]}
        }"""
        val forecast=TodayDetailParsers.forecast(raw)
        assertEquals(2,forecast.hours.size)
        assertEquals(32.0,forecast.hours[0].feels,0.001)
        assertEquals(70,forecast.hours[1].rain)
        assertEquals(2,forecast.days.size)
        assertEquals(90,forecast.days[1].rain)
    }

    @Test fun refusesForecastWithMissingArrays() {
        try {
            TodayDetailParsers.forecast("""{"hourly":{"time":[]},"daily":{}}""")
            fail("Missing data should not be shown as current weather")
        } catch (_:Exception) { }
    }

    @Test fun monthlyPrayerUsesJAKIMNamedFieldsAndRejectsIncompleteRows() {
        val raw="""{"prayerTime":[
            {"date":"11-Nov-2026","hijri":"1-5-1448","fajr":"05:52:00",
             "dhuhr":"13:04:00","asr":"16:23:00","maghrib":"19:00:00","isha":"20:12:00"},
            {"date":"12-Nov-2026","fajr":"05:53:00"}
        ]}"""
        val result=TodayDetailParsers.prayerMonth(raw)
        assertEquals(1,result.size)
        assertEquals("11-Nov-2026",result[0].date)
        assertEquals("05:52",result[0].times[0].second)
    }

    @Test fun excludesDraftReleasesAndNeverInventsApkPublication() {
        val releases=TodayDetailParsers.releases("""[
          {"tag_name":"draft","draft":true,"assets":[{"name":"app.apk"}]},
          {"tag_name":"test","draft":false,"prerelease":true,
           "published_at":"2026-11-11T00:00:00Z","assets":[{"name":"README.txt"}]},
          {"tag_name":"installable","draft":false,"prerelease":false,
           "published_at":"2026-11-11T01:00:00Z","assets":[{"name":"AKSARA.apk"}]}
        ]""")
        assertEquals(2,releases.size)
        assertFalse(releases.first().apkPublished)
        assertTrue(releases.last().apkPublished)
        assertTrue(releases.first().prerelease)
    }

    @Test fun commitsAreGroundedInActualShaAndCommitMetadata() {
        val commits=TodayDetailParsers.commits("""[
          {"sha":"a1b2c3d4e5","commit":{"message":"Fix audio\nMore details",
           "author":{"name":"S. Ridhwan"},"committer":{"date":"2026-11-11T01:00:00Z"}}},
          {"sha":"short","commit":{"message":"Invalid"}}
        ]""")
        assertEquals(1,commits.size)
        assertEquals("Fix audio",commits[0].message)
        assertEquals("S. Ridhwan",commits[0].author)
    }

    @Test fun scShariahWhitelistIsStrictAndNotAUniversalHalalClaim() {
        assertEquals(15,TodayShariahReference.listed.size)
        assertEquals(8,TodayShariahReference.unverified.size)
        for(symbol in listOf("BTC","ETH","SOL","ADA","LINK"))
            assertEquals("Patuh Syariah menurut SC",TodayShariahReference.status(symbol))
        for(symbol in listOf("USDT","DOGE","SNX","UNKNOWN"))
            assertEquals("Belum disahkan",TodayShariahReference.status(symbol))
    }
}
