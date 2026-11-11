package my.aksara.nativeapp

import my.aksara.nativeapp.feature.today.TodayRouteParser
import org.junit.Assert.*
import org.junit.Test

class TodayRouteParserTest {
    @Test fun decodePolyline6RetainsPrecision() {
        val points=TodayRouteParser.decodePolyline6("????")
        assertEquals(2,points.size)
        assertEquals(0.0,points[0].latitude,0.000001)
        assertEquals(0.0,points[1].longitude,0.000001)
    }
    @Test fun rejectIncompleteOrOutOfRangePolyline() {
        assertThrows(IllegalArgumentException::class.java) {
            TodayRouteParser.decodePolyline6("~")
        }
        assertThrows(IllegalArgumentException::class.java) {
            TodayRouteParser.decodePolyline6("!")
        }
    }
    @Test fun parseActualResponseShapeAndSummary() {
        val json="""{"trip":{"status":0,"summary":{"length":2.5,"time":360},"legs":[{"shape":"????","maneuvers":[{"instruction":"Go straight.","begin_shape_index":0,"type":1}]}]}}"""
        val result=TodayRouteParser.parse(json)
        assertEquals(2,result.points.size)
        assertEquals(2.5,result.kilometres,0.000001)
        assertEquals(360,result.seconds)
        assertEquals("Go straight.",result.steps.single().instruction)
    }
}
