# AKSARA PERFORMANCE V2 | PR #311

**No auto-merge. All 20 requested areas remain in scope, and nothing is removed
from Liquid Glass, voice, navigation, Studio, games, or motion.**
Actual speedup must be measured on a physical device. Avoid invented percentages.

## Implementation / evidence ledger
| # | Area | Present work | Remaining validation |
|---|---|---|---|
|1|IME|Scoped padding + bounded scroll|20 physical keyboard cycles|
|2|Compose|Stable list keys/content type; Markdown skip unchanged|Layout Inspector recompositions|
|3|Liquid Glass|Haze unchanged, backdrop fixed|GPU/overdraw trace|
|4|Bouncy motion|PR #311 GPU graphicsLayer springs|120Hz/60Hz frame metrics|
|5|UI thread|Session startup I/O, TODAY cache parsing moved to IO|StrictMode & Perfetto|
|6|Baseline Profile|Generator and ProfileInstaller integrated|Real capture, reviewed rules|
|7|Startup|No 2.3s logo gate; on-demand engines|Cold/warm timings|
|8|R8|Opt-in signed, optimized benchmark variant|R8 functional smoke|
|9|Lazy lists|Chat contentType, stable keys|Large conversation/device|
|10|Memory|Existing map/Studio lifecycle; debug frame metrics|Heap snapshots & long run|
|11|Streaming|No delta dropped; stop/resume kept|Streaming stress validation|
|12|Voice|Existing Bluetooth/reconnect untouched|Headset and latency testing|
|13|TODAY refresh|TTL retained; crypto concurrent; IO cache parse|Offline+refresh tests|
|14|Map|On-demand MapLibre and lifecycle preserved|Tile/heap/navigation tests|
|15|Studio|Image engines preserved|Large bitmap heap test|
|16|Games|Native and JS games preserved|Browser/game CI, rotation|
|17|Macrobenchmark|Separate opt-in module, startup/pager metrics|Physical-device data|
|18|Perfetto/JankStats|Trace output; opt-in debug aggregation|Collect real traces|
|19|Battery/network|TTL caching, no artificial startup work|Energy Profiler measurement|
|20|CI|Static preservation gate + existing functional checks|Numeric gate after baseline|

## Android platform splash
Android 12+ mandates a system launch splash; the app-specific 2300ms animated
intro has been neutralized. The system splash now uses a transparent icon with
zero configured animation duration. Do not claim the OS splash can be removed.

## How to measure (physical device)
With SDK + Gradle available and a *non-preview*, normal package installed:
```bash
cd android-native
gradle :app:assembleBenchmark -PaksaraPerformanceBenchmarks=true
gradle :macrobenchmark:connectedCheck -PaksaraPerformanceBenchmarks=true
# For profile capture, rebuild unminified before running generator.
gradle :macrobenchmark:connectedCheck -PaksaraPerformanceBenchmarks=true -PaksaraGenerateBaseline=true -Pandroid.testInstrumentationRunnerArguments.androidx.benchmark.enabledRules=BaselineProfile
```
Save the generated ART profile **after a real capture** to
`app/src/main/baseline-prof.txt`; a made-up file would give fake confidence.
Use Perfetto trace + `PerformanceFixtureTest` for consistent workloads.
A numeric CI gate must only be enabled after device baselines and variance
are known. CI without a hardware benchmark cannot truthfully measure phone jank.
