# Verified checkpoint — 2026-11-08

Branch: `rebuild/aksara-android-native-v1`. Draft PR: https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/pull/271 . Do not merge.

Last artifact-producing source: `0a6c5caf4f6106d9f169270c1fb0b8f9443a049c`.
Workflow: https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/actions/runs/42459564957 . Build and web-audit jobs passed; emulator job failed. APK artifact 13609242471 is real, 58,115,061 bytes, Android API 31+, package `my.aksara.nativeapp`, debug signature verified. Native installation succeeded in emulator. This is not release acceptance.

The earlier checkpoint `86c0903` also produced a real 25,241,610-byte APK, installed successfully; its Terminal scroll layout failed an instrumented test and was subsequently corrected.

The first 360dp paired native/web captures are real. Welcome SSIM is **81.767%**, chat **69.794%**, streaming **78.131%**, Code **44.742%**, Terminal **54.548%**, Portal **51.074%**, Connection **66.759%**, Thinking **64.151%**, attachments **54.372%**, microphone preflight **78.765%**. These are failed comparisons. Background-only similarity is much higher and does not establish control parity. Main frame measured geometry differs by ~0.20px; nested blur, typography, icons and overlay structure need correction. Native voice PNG is truncated and is classified CORRUPT_CAPTURE, never passed. Remaining phone sizes have not yet produced valid native comparisons.

Actual emulator blockers in that run: Android framework SQLite attempted a forbidden ContentProvider call in the isolated UID; the instrumentation process crashed while capturing the native 3D voice scene. The raw test output and partial screenshots were preserved. No voice/audio success or 3D parity is claimed from that run.

Corrections being tested after this checkpoint: bundled SQLite driver preserving isolation, SurfaceFlinger/UiAutomation screenshots, crash-log collection, nested backdrop recording that excludes foreground content, calibrated native blur, single-line Voice Chat padding, original vector paths/sizes, CSS line-box preservation, and source-measured active chat content. The current source must be built and re-captured before scores above can be replaced.

Primary interface remains native Compose; no WebView/TWA/PWA wrapper. Original wallpaper, portrait and fonts are reused. Full Linux userland, native Game Aksara, Studio/reader/Security Lab and several runtimes remain incomplete. Size has no artificial ceiling. Google Play readiness is outside current scope.


## Recovery verification at 8d23be8

Run https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/actions/runs/42460622271 built an installable 65,726,452-byte debug APK (artifact 13609821033). Build/unit tests and web audit succeeded. All five native engine tests passed, including bundled SQLite and isolated-process private-file denial. The emulator job failed.

The three-size screenshots from this run are **obstructed by Android SystemUI's first-time immersive education panel** and are invalid for app similarity. Their raw 55–59% welcome scores must not replace the earlier valid 81.767% baseline. The voice crash is now traced to Filament GLES shader compilation exceeding SwiftShader's 256 vertex uniform-vector limit, followed by native SIGABRT. This is not a verified voice rendering result.

Recovery changes dismiss SystemUI education through the real UI before capture, fail obstructed captures, record capture provenance, capture the keyboard before the independent 3D scene, use current SwiftShader emulation and select Filament Vulkan where advertised by the device. Thinking Mode's measured status card/options and shared dialog border/padding are being corrected. These changes require a fresh CI build and real captures before any new similarity claim.


## Latest completed recovery capture: dbe92de

Read `visual-comparison/RECOVERY_REPORT.md` for complete measured evidence. Source `dbe92decfa5f63139dc1615b9e04124996c0f139`, run 42466403177: build, eight unit tests and web audit passed; all five native engine tests and all three dimension-specific navigation/capture tests passed. The visual comparison correctly failed. All 36 paired captures are real and unobstructed, including native Filament voice preview. Crash log is empty; no live voice-session claim follows from a preview fixture.

Welcome SSIM is 81.758% at360dp, 83.130% at390dp and 84.006% at412dp. The 360dp opening-screen score has not improved over the original 81.767% baseline. Some dialog structures improved; no screen meets acceptance. Artifact 13612146110 contains the signed 65,759,220-byte debug APK. Artifact 13611268976 contains pairs, heatmaps, original images, component geometry and performance logs. Three missing web keyboard references, three blocked Security Lab web references and fifteen missing native secondary-screen references remain explicit.

The next renderer iteration changes descendant backdrop-root sampling and explicitly supported font weight axes, and records the complete scene beneath modals. Its measurements must be collected independently before replacing the dbe92de scores. Native architecture, original assets and all existing runtime/voice integrations remain preserved. Advanced integration remains deferred pending visual approval.
