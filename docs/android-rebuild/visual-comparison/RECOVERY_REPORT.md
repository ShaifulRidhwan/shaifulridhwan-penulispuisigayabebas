# Visual parity recovery — verified captures at dbe92de

Source: `dbe92decfa5f63139dc1615b9e04124996c0f139`. Branch `rebuild/aksara-android-native-v1`. Draft PR [271](https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/pull/271).

[CI run](https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/actions/runs/42466403177) built APKs, passed all eight unit tests, passed the web audit and ran three real API-35 emulator dimensions. Native engine tests: 5/5 passed. Navigation/screenshot tests: 3/3 passed. The emulator job correctly failed visual acceptance. No screenshot has been passed from compilation alone.

[APK artifact](https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/actions/runs/42466403177/artifacts/13612146110), [web reference](https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/actions/runs/42466403177/artifacts/13611693566), [paired screenshots, heatmaps, geometry and logs](https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/actions/runs/42466403177/artifacts/13611268976).

The debug APK is 65,759,220 bytes. Its debug signature was verified with Android SDK apksigner. Package `my.aksara.nativeapp`, min API31, target API35. Emulator cold launch (one sample): 1,959ms; PSS 76,511KiB; RSS 180,168KiB; measured code directory 64,208KiB and app-private data 56KiB. These are debug emulator observations, not physical-device performance or a complete package-manager storage measurement.

## Measured SSIM

Every row remains MISMATCH. No screen or whole application is accepted. Component ROIs are required independently.

| State | 360dp | 390dp | 412dp |
|---|---:|---:|---:|
| welcome | 81.758% | 83.130% | 84.006% |
| chat | 72.010% | 74.719% | 76.579% |
| streaming | 78.441% | 80.436% | 81.588% |
| composer-focused | 78.847% | 81.991% | 82.990% |
| connection | 75.447% | 76.985% | 76.768% |
| code | 67.784% | 70.782% | 67.604% |
| terminal | 63.226% | 62.567% | 65.270% |
| portal | 63.770% | 64.645% | 65.630% |
| thinking | 72.349% | 85.644% | 82.413% |
| attachments | 63.454% | 65.875% | 64.134% |
| voice-permission | 84.950% | 86.355% | 89.230% |
| voice | 71.804% | 76.847% | 77.253% |

## Baseline and evidence validity

The previous valid 360dp welcome baseline at `0a6c5ca` was 81.767%; current 81.758% is effectively unchanged, not an improvement claim. Code increased from 44.742% to 67.784%, Thinking 64.151% to 72.349%, and microphone preflight 78.765% to 84.950% at 360dp. All source-specific images remain in their original CI artifacts; no pixels were changed before scoring.

The intervening `8d23be8` screenshots were obstructed by Android SystemUI's immersive education overlay and must not be used as app similarity evidence. Recovery dismisses that UI through UiAutomator before capture, checks for obstruction and records capture metadata. All twelve named captures per width at dbe92de are intact, including native Filament voice preview. No crash was recorded in this latest run; live microphone/provider session success is not established by the deterministic preview.

Remaining records: 15 missing native references (Studio, library, sessions, metrics, knowledge across three widths), three blocked web Security Lab references and three Android keyboard images without equivalent web-IME references. These are unfinished or blocked, never passed.

## Largest remaining causes

The 360dp middle-background ROI (x20..340, y300..650) measured 98.962%, while header 76.709%, status row 55.862%, welcome content 56.862%, starter controls 52.031% and composer 88.634%. A matching wallpaper masks large control errors. Typography weight/rasterization, nested backdrop sampling, borders/icons and dialog body structures still differ. Code health/automatic-execution states and Terminal's default editor content also differ; treat those semantic fixture differences separately from renderer error rather than forcing fake success states.

The primary frame geometry retains a ~0.203px vertical rounding difference. Native input semantics report its padded text content, while web metrics describe the textarea border box; their raw delta is not proof of an incorrectly sized field.

## Next measured iteration

A subsequent source change tests explicit supported font weight axes and CSS backdrop-root isolation: parent filtered imagery remains outside the source recording used by descendant glass. The full underlying scene is recorded for modal backdrops. These are renderer corrections under test; the scores above are specifically dbe92de and must not be assigned to later source without another real capture. Original source/assets and the dbe92de implementation remain recoverable in Git history.

Advanced feature integration and Google Play work remain deferred. Developer visual approval is still required.
