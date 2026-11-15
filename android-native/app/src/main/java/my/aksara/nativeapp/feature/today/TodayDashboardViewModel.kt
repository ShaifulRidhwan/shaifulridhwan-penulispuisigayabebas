package my.aksara.nativeapp.feature.today

import android.location.Location
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel

/**
 * One lifecycle-aware TODAY state owner shared while Chat, TODAY and Linux pages
 * are composed. Data transport remains in TodayRepository and is cancelled by
 * the screen's active-only coroutine effects.
 */
internal class TodayDashboardViewModel : ViewModel() {
    var weather by mutableStateOf<TodayFeed<TodayWeather>?>(null)
    var prayer by mutableStateOf<TodayFeed<TodayPrayer>?>(null)
    var crypto by mutableStateOf<TodayFeed<List<TodayCoin>>?>(null)
    var github by mutableStateOf<TodayFeed<TodayCommit>?>(null)
    var latestLocation by mutableStateOf<Location?>(null)
    var city by mutableStateOf<String?>(null)
    var locating by mutableStateOf(false)
    var locationReady by mutableStateOf(false)
    var lastLocationCheck by mutableLongStateOf(0L)
}

/** Poll only when visible. Actual HTTP refresh is individually throttled by each repository TTL. */
internal object TodayRefreshCoordinator {
    const val ACTIVE_TICK_MS=60_000L
    const val LOCATION_TTL_MS=30L*60_000L
    const val WEATHER_TTL_MS=30L*60_000L
    const val PRAYER_TTL_MS=6L*60L*60_000L
    const val CRYPTO_TTL_MS=15L*60_000L
    const val GITHUB_TTL_MS=10L*60_000L

    fun needsLocation(previous:Location?,lastCheckAt:Long,now:Long,forced:Boolean):Boolean =
        forced || previous==null || lastCheckAt<=0L || now<lastCheckAt ||
            now-lastCheckAt>=LOCATION_TTL_MS
}
