package my.aksara.nativeapp

import my.aksara.nativeapp.feature.chat.visibleMessageOverflow
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
}
