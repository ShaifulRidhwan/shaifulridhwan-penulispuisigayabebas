package my.aksara.macrobenchmark

import androidx.benchmark.macro.CompilationMode
import androidx.benchmark.macro.FrameTimingMetric
import androidx.benchmark.macro.StartupMode
import androidx.benchmark.macro.StartupTimingMetric
import androidx.benchmark.macro.junit4.BaselineProfileRule
import androidx.benchmark.macro.junit4.MacrobenchmarkRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import androidx.test.uiautomator.By
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

private const val PACKAGE = "my.aksara.nativeapp"

@LargeTest
@RunWith(AndroidJUnit4::class)
class AksaraMacrobenchmark {
    @get:Rule val benchmark = MacrobenchmarkRule()

    @Test fun coldStartup() = benchmark.measureRepeated(
        packageName = PACKAGE,
        metrics = listOf(StartupTimingMetric()),
        compilationMode = CompilationMode.Partial(),
        startupMode = StartupMode.COLD,
        iterations = 6
    ) { startActivityAndWait() }

    @Test fun chatDashboardMotion() = benchmark.measureRepeated(
        packageName = PACKAGE,
        metrics = listOf(FrameTimingMetric()),
        compilationMode = CompilationMode.Partial(),
        startupMode = StartupMode.WARM,
        iterations = 6
    ) {
        startActivityAndWait()
        val y = device.displayHeight / 2
        val left = device.displayWidth / 5
        val right = device.displayWidth * 4 / 5
        device.swipe(left, y, right, y, 24)
        device.waitForIdle()
        device.swipe(right, y, left, y, 24)
        device.waitForIdle()
    }
    // P2: Real-device keyboard open/close frame timing.
    // Missing composer fails the test, never substitutes synthetic metrics.
    @Test fun chatKeyboardMotion() = benchmark.measureRepeated(
        packageName = PACKAGE,
        metrics = listOf(FrameTimingMetric()),
        compilationMode = CompilationMode.Partial(),
        startupMode = StartupMode.WARM,
        iterations = 6
    ) {
        startActivityAndWait()
        val composer = device.findObject(By.clazz("android.widget.EditText"))
            ?: throw AssertionError("Chat composer unavailable in UI hierarchy")
        repeat(10) {
            composer.click()
            device.waitForIdle()
            device.pressBack()
            device.waitForIdle()
        }
    }
}

/**
 * Capture on a real, non-debuggable, unminified target with
 * -PaksaraGenerateBaseline=true. Commit the generated profile only after capture.
 */
@LargeTest
@RunWith(AndroidJUnit4::class)
class AksaraBaselineProfileGenerator {
    @get:Rule val profile = BaselineProfileRule()
    @Test fun mainJourneys() = profile.collect(packageName = PACKAGE) {
        startActivityAndWait()
        val y = device.displayHeight / 2
        device.swipe(device.displayWidth / 5, y, device.displayWidth * 4 / 5, y, 25)
        device.waitForIdle()
        device.swipe(device.displayWidth * 4 / 5, y, device.displayWidth / 5, y, 25)
        device.waitForIdle()
    }
}
