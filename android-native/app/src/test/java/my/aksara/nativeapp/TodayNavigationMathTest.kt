package my.aksara.nativeapp

import my.aksara.nativeapp.feature.today.*
import org.junit.Assert.*
import org.junit.Test

class TodayNavigationMathTest {
    @Test fun zeroAndRealWorldDistances() {
        val a=RouteCoordinate(3.0738,101.5183)
        val b=RouteCoordinate(3.0748,101.5183)
        assertEquals(0.0,TodayNavigationMath.distanceMetres(a,a),0.0001)
        assertTrue(TodayNavigationMath.distanceMetres(a,b) in 100.0..120.0)
    }
    @Test fun guidanceProgressTracksNearestAndNextTurn() {
        val a=RouteCoordinate(3.0738,101.5183)
        val b=RouteCoordinate(3.0748,101.5183)
        val c=RouteCoordinate(3.0758,101.5183)
        val route=TodayRoute(listOf(a,b,c),0.22,50,
            listOf(RouteStep("Left",2,15)))
        val progress=TodayNavigationMath.progress(route,b,0)
        assertEquals(1,progress.nearestIndex)
        assertEquals(0.0,progress.offRouteMetres,0.1)
        assertTrue(progress.remainingMetres in 100.0..120.0)
        assertEquals(15,progress.nextStep?.type)
    }
    @Test fun malayTurnDirectionsAreTypeBased() {
        assertEquals("Belok kanan.",TodayNavigationMath.malayVoice(10))
        assertEquals("Belok kiri.",TodayNavigationMath.malayVoice(15))
        assertEquals("Anda sudah tiba di destinasi.",TodayNavigationMath.malayVoice(4))
    }
}
