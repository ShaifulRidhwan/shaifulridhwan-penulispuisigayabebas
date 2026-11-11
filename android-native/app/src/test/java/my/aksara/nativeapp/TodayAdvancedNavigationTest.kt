package my.aksara.nativeapp

import my.aksara.nativeapp.feature.today.*
import org.junit.Assert.*
import org.junit.Test

class TodayAdvancedNavigationTest {
    @Test fun savedRouteCanBeReusedWithNoNetwork() {
        val route=TodayRoute(
            listOf(RouteCoordinate(3.0738,101.5183),RouteCoordinate(3.0741,101.5189)),
            0.08,70,listOf(RouteStep("Turn left",1,15))
        )
        val saved=TodaySavedRoute.deserialize(TodaySavedRoute.serialize(route))
        assertEquals(2,saved.points.size)
        assertEquals(0.08,saved.kilometres,0.0001)
        assertEquals("Laluan tersimpan / offline",saved.provider)
    }
    @Test fun savedRouteRejectsInvalidCoordinatesAndVersion() {
        assertThrows(IllegalArgumentException::class.java) {
            TodaySavedRoute.deserialize("""{"version":1,"points":[[250,100],[3,102]],"steps":[],"kilometres":1,"seconds":100}""")
        }
        assertThrows(IllegalArgumentException::class.java) {
            TodaySavedRoute.deserialize("""{"version":9,"points":[],"steps":[],"kilometres":1,"seconds":100}""")
        }
    }
    @Test fun trafficFlowUsesActualSpeedOnly() {
        val traffic=TodayTrafficParser.parse(
            """{"flowSegmentData":{"currentSpeed":32,"freeFlowSpeed":68,"confidence":0.82,"roadClosure":false}}""",123L)
        assertEquals(32,traffic.currentKmh)
        assertEquals(68,traffic.freeFlowKmh)
        assertEquals(0.82,traffic.confidence,0.00001)
        assertEquals(123L,traffic.observedAt)
        assertFalse(traffic.roadClosed)
    }
    @Test fun trafficRejectsFakeOrInvalidSpeed() {
        assertThrows(IllegalArgumentException::class.java) {
            TodayTrafficParser.parse(
                """{"flowSegmentData":{"currentSpeed":-3,"freeFlowSpeed":0,"confidence":9.0}}""")
        }
    }
}
