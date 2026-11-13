package my.aksara.nativeapp

import my.aksara.nativeapp.feature.today.TodayParsers
import my.aksara.nativeapp.feature.today.TodayDetailParsers
import my.aksara.nativeapp.feature.today.TodayPrayer
import my.aksara.nativeapp.feature.today.prayerTimelineProgress
import my.aksara.nativeapp.feature.chat.ChatResponseLifecycle
import my.aksara.nativeapp.feature.chat.SessionTransferCodec
import my.aksara.nativeapp.core.storage.Message
import org.junit.Assert.*
import org.junit.Test
import java.time.LocalTime

/** Deterministic PR327 regression tests: no network, live provider or device required. */
class TodayChatV2RegressionTest {
    @Test fun hourlyWeatherOnlyUsesSuppliedForecastSamples() {
        val weather=TodayParsers.weather("""
            {"current":{"temperature_2m":30,"weather_code":61,"wind_speed_10m":10},
             "daily":{"precipitation_probability_max":[85]},
             "hourly":{"precipitation_probability":[30,75,40],
                       "temperature_2m":[30.0,30.5,31.0,31.5]}}
        """.trimIndent())
        assertEquals(75,weather.rainNext3Hours)
        assertEquals(1.5,weather.temperatureTrend3Hours!!,0.0001)
        assertEquals(85,weather.rainChance)
    }

    @Test fun oldWeatherCacheNeverInventsHourlyRisk() {
        val weather=TodayParsers.weather("""
            {"current":{"temperature_2m":28,"weather_code":2},"daily":{}}
        """.trimIndent())
        assertNull(weather.rainNext3Hours)
        assertNull(weather.temperatureTrend3Hours)
    }

    @Test fun prayerTimelineHandlesMidnightWithoutNegativeProgress() {
        val prayer=TodayPrayer("SGR01","",listOf(
            "Subuh" to "05:45","Zohor" to "13:15","Asar" to "16:35",
            "Maghrib" to "19:10","Isyak" to "20:25"))
        val midnight=prayerTimelineProgress(prayer,LocalTime.of(0,15))!!
        val afterAsar=prayerTimelineProgress(prayer,LocalTime.of(17,0))!!
        assertTrue(midnight in 0f..1f)
        assertTrue(afterAsar in 0f..1f)
        assertEquals(0f,prayerTimelineProgress(prayer,LocalTime.of(16,35))!!,0.0001f)
    }

    @Test fun lifecycleLabelsCorrespondToActualTransportStages() {
        assertEquals("Menyimpan mesej",ChatResponseLifecycle.label("saving"))
        assertEquals("Menghubungi backend",ChatResponseLifecycle.label("connecting"))
        assertEquals("Menjana respons",ChatResponseLifecycle.label("streaming"))
        assertEquals("",ChatResponseLifecycle.label("idle"))
    }

    @Test fun perAnswerMetadataHasSafeLegacyDefaults() {
        val old=Message("old","assistant","Jawapan lama")
        assertNull(old.model)
        assertTrue(old.toolsUsed.isEmpty())
        val modern=old.copy(provider="groq",model="test-model",
            researchStatus="complete",toolsUsed=listOf("web_search"),
            evidenceLevel="search_excerpt",reviewApplied=true)
        assertEquals("groq",modern.provider)
        assertEquals("test-model",modern.model)
        assertEquals(listOf("web_search"),modern.toolsUsed)
        assertEquals("search_excerpt",modern.evidenceLevel)
        assertEquals(true,modern.reviewApplied)
    }

    @Test fun sessionTransferKeepsPerAnswerProvenanceForNewArchives() {
        val original=Message("original","assistant","Jawapan",provider="gemini",
            model="gemini-test",researchStatus="complete",
            toolsUsed=listOf("web_search"),evidenceLevel="page_text",reviewApplied=true)
        val exported=SessionTransferCodec.encode(listOf(original),listOf(original.id))
        val restored=SessionTransferCodec.decode(exported).messages.single()
        assertEquals("gemini",restored.provider)
        assertEquals("gemini-test",restored.model)
        assertEquals(listOf("web_search"),restored.toolsUsed)
        assertEquals("page_text",restored.evidenceLevel)
        assertEquals(true,restored.reviewApplied)
    }

    @Test fun marketChartRequiresRealValidSamples() {
        val prices=TodayDetailParsers.btcHistory("""
            {"prices":[[1000,90000.0],[2000,91000.0],[3000,90500.0]]}
        """.trimIndent())
        assertEquals(listOf(90000.0,91000.0,90500.0),prices)
        assertThrows(IllegalArgumentException::class.java) {
            TodayDetailParsers.btcHistory("""{"prices":[[1000,-10.0]]}""")
        }
    }
}
