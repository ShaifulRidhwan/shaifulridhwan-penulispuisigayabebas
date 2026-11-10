package my.aksara.nativeapp

import android.content.pm.ActivityInfo
import android.content.res.Configuration
import androidx.compose.foundation.text.BasicText
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import org.junit.Assert.assertSame
import org.junit.Rule
import org.junit.Test

/** Regression for a test-supplied composition lost to late Activity recreation. */
class VisualHostLifecycleTest {
    @get:Rule val compose = createAndroidComposeRule<VisualTestActivity>()

    @Test fun fixtureSurvivesLandscapeToPortraitConfigurationChanges() {
        compose.setContent { BasicText("fixture-ready") }
        val original = compose.activity
        for ((requested, expected) in listOf(
            ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE to Configuration.ORIENTATION_LANDSCAPE,
            ActivityInfo.SCREEN_ORIENTATION_PORTRAIT to Configuration.ORIENTATION_PORTRAIT
        )) {
            compose.activityRule.scenario.onActivity { it.requestedOrientation = requested }
            compose.waitUntil(15_000) { compose.activity.resources.configuration.orientation == expected }
            compose.waitForIdle()
            compose.activityRule.scenario.onActivity { assertSame(original, it) }
            compose.onNodeWithText("fixture-ready").assertIsDisplayed()
        }
    }
}
