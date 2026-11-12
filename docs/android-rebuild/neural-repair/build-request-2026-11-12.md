# PR #321 Android build request

Requested: 2026-11-12 (Malaysia time)
Branch: `feature/aksara-neural-local-v1`
Workflow: `.github/workflows/aksara-android-neural-native.yml`

This commit records the owner's request for a fresh native APK build. The neural workflow uses `workflow_dispatch` only, so a push does **not** start that workflow. Run it manually with `publish_manifest` empty to execute `build-native`. No application code, design, or tests were modified by this marker.
