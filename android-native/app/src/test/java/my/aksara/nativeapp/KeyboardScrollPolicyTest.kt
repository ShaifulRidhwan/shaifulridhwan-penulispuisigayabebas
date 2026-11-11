package my.aksara.nativeapp

import my.aksara.nativeapp.feature.chat.visibleMessageOverflow
import my.aksara.nativeapp.feature.chat.imeViewportFollowDelta
import my.aksara.nativeapp.feature.chat.overlayNeedsImeSpace
import org.junit.Assert.assertEquals
import org.junit.Test

class KeyboardScrollPolicyTest {
    @Test fun fullyVisibleMessageDoesNotScroll() {
        assertEquals(0,visibleMessageOverflow(180,220,600,20))
    }

    @Test fun overflowingMessageScrollsOnlyTheMissingPixels() {
        assertEquals(90,visibleMessageOverflow(350,320,600,20))
    }

    @Test fun keyboardViewportShrinkRequiresOnlyNewOverflow() {
        val before=visibleMessageOverflow(300,160,720,0)
        val after=visibleMessageOverflow(300,160,400,0)
        assertEquals(0,before)
        assertEquals(60,after)
    }

    @Test fun animatedImeOpeningFollowsViewportWithoutJump() {
        assertEquals(0,imeViewportFollowDelta(null,720,0,0,true))
        assertEquals(48,imeViewportFollowDelta(720,672,0,48,true))
        assertEquals(32,imeViewportFollowDelta(672,640,48,80,true))
    }
    @Test fun animatedImeClosingFollowsViewportBackDown() {
        assertEquals(-36,imeViewportFollowDelta(640,676,80,44,true))
        assertEquals(-44,imeViewportFollowDelta(676,720,44,0,true))
    }
    @Test fun manualScrollAndNonImeLayoutStayUnchanged() {
        assertEquals(0,imeViewportFollowDelta(720,640,0,80,false))
        assertEquals(0,imeViewportFollowDelta(640,720,0,0,true))
        assertEquals(0,imeViewportFollowDelta(640,640,80,80,true))
    }
    @Test fun passiveModalsDoNotFollowDismissedKeyboard() {
        assertEquals(false,overlayNeedsImeSpace("thinking"))
        assertEquals(false,overlayNeedsImeSpace("connection"))
        assertEquals(false,overlayNeedsImeSpace("portal"))
        assertEquals(true,overlayNeedsImeSpace("search-hub"))
        assertEquals(true,overlayNeedsImeSpace("settings"))
        assertEquals(true,overlayNeedsImeSpace("studio"))
    }
}
