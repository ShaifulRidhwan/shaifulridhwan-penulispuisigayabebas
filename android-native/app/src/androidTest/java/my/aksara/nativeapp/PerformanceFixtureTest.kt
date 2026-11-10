package my.aksara.nativeapp

import android.os.Debug
import android.os.Handler
import android.os.HandlerThread
import android.view.FrameMetrics
import android.view.Window
import androidx.compose.runtime.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import my.aksara.nativeapp.core.storage.Message
import my.aksara.nativeapp.feature.chat.*
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Rule
import org.junit.Test
import java.io.File
import java.util.Collections

/** Deterministic UI workload, not an AI/network latency measurement. */
class PerformanceFixtureTest {
    @get:Rule val compose = createAndroidComposeRule<VisualTestActivity>()

    @Test fun streamingRenderFixture() {
        val frames = Collections.synchronizedList(mutableListOf<Long>())
        val gpu = Collections.synchronizedList(mutableListOf<Long>())
        val handlerThread = HandlerThread("aksara-frame-measurement").apply { start() }
        val listener = Window.OnFrameMetricsAvailableListener { _, metrics, _ ->
            frames.add(metrics.getMetric(FrameMetrics.TOTAL_DURATION))
            gpu.add(metrics.getMetric(FrameMetrics.GPU_DURATION))
        }
        val timestamp = 1794117600000L
        val history = (0 until 100).map { i ->
            Message("history-$i", if (i % 2 == 0) "user" else "assistant",
                "Antara aksara dan cahaya, perbualan $i mengekalkan konteks dan identiti.", timestamp)
        }
        var answer by mutableStateOf("")
        compose.setContent {
            AksaraScreen(ChatState(messages = history + Message("stream", "assistant", answer,
                timestamp, incomplete = true), busy = true, loaded = true), fixedTimestamp = timestamp)
        }
        compose.waitForIdle()
        // Warm text/font/shader resources using the same workload before collecting.
        repeat(20) {
            compose.runOnIdle { answer += " cahaya" }
            Thread.sleep(32)
        }
        compose.runOnIdle { compose.activity.window.addOnFrameMetricsAvailableListener(listener, Handler(handlerThread.looper)) }
        val before = Debug.getRuntimeStats()
        val start = System.nanoTime()
        try {
            repeat(180) {
                compose.runOnIdle { answer += " antara cahaya dan aksara" }
                Thread.sleep(32)
            }
            compose.waitForIdle()
        } finally {
            compose.runOnIdle { compose.activity.window.removeOnFrameMetricsAvailableListener(listener) }
            handlerThread.quitSafely()
            handlerThread.join()
        }
        val after = Debug.getRuntimeStats()
        val report = JSONObject()
            .put("fixture", "100-history-180-stream-updates-32ms-debug")
            .put("elapsedNs", System.nanoTime() - start)
            .put("frameTotalNs", JSONArray(frames.toList()))
            .put("frameGpuNs", JSONArray(gpu.toList()))
            .put("runtimeBefore", JSONObject(before))
            .put("runtimeAfter", JSONObject(after))
            .put("nativeHeapBytes", Debug.getNativeHeapAllocatedSize())
            .put("javaHeapUsedBytes", Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory())
            .put("api", android.os.Build.VERSION.SDK_INT)
            .put("abis", android.os.Build.SUPPORTED_ABIS.joinToString())
        check(frames.isNotEmpty()) { "No frame metrics collected" }
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        File(context.getExternalFilesDir(null), "streaming-render-fixture.json").writeText(report.toString(2))
        println("AKSARA_RENDER_METRICS=" + report)
    }
}
