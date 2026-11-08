# Verified checkpoint — 2026-11-08

Branch: `rebuild/aksara-android-native-v1`. Draft PR: https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/pull/271 . Do not merge.

Last artifact-producing source: `0a6c5caf4f6106d9f169270c1fb0b8f9443a049c`.
Workflow: https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/actions/runs/42459564957 . Build and web-audit jobs passed; emulator job failed. APK artifact 13609242471 is real, 58,115,061 bytes, Android API 31+, package `my.aksara.nativeapp`, debug signature verified. Native installation succeeded in emulator. This is not release acceptance.

The earlier checkpoint `86c0903` also produced a real 25,241,610-byte APK, installed successfully; its Terminal scroll layout failed an instrumented test and was subsequently corrected.

The first 360dp paired native/web captures are real. Welcome SSIM is **81.767%**, chat **69.794%**, streaming **78.131%**, Code **44.742%**, Terminal **54.548%**, Portal **51.074%**, Connection **66.759%**, Thinking **64.151%**, attachments **54.372%**, microphone preflight **78.765%**. These are failed comparisons. Background-only similarity is much higher and does not establish control parity. Main frame measured geometry differs by ~0.20px; nested blur, typography, icons and overlay structure need correction. Native voice PNG is truncated and is classified CORRUPT_CAPTURE, never passed. Remaining phone sizes have not yet produced valid native comparisons.

Actual emulator blockers in that run: Android framework SQLite attempted a forbidden ContentProvider call in the isolated UID; the instrumentation process crashed while capturing the native 3D voice scene. The raw test output and partial screenshots were preserved. No voice/audio success or 3D parity is claimed from that run.

Corrections being tested after this checkpoint: bundled SQLite driver preserving isolation, SurfaceFlinger/UiAutomation screenshots, crash-log collection, nested backdrop recording that excludes foreground content, calibrated native blur, single-line Voice Chat padding, original vector paths/sizes, CSS line-box preservation, and source-measured active chat content. The current source must be built and re-captured before scores above can be replaced.

Primary interface remains native Compose; no WebView/TWA/PWA wrapper. Original wallpaper, portrait and fonts are reused. Full Linux userland, native Game Aksara, Studio/reader/Security Lab and several runtimes remain incomplete. Size has no artificial ceiling. Google Play readiness is outside current scope.
