# PR #288: Android black-screen and orientation repair

## Changes

Game launch now opens a dedicated, non-exported, hardware-accelerated landscape `GameActivity`. The existing `MainActivity` stays portrait on the back stack; launching the game no longer changes orientation from a Compose disposal effect. Native Back and the game return button finish the game window. The activity pauses the simulation/audio when backgrounded, destroys its own WebView, and disposes a dead renderer before offering recovery.

The original Phaser parent had no explicit viewport height. Its new CSS has a full viewport width/height and its resize observer only touches Phaser after the scene is initialized. Start is disabled until a scene has rendered with nonzero canvas and viewport dimensions. Errors and failed startup show a visible Canvas retry action. A forced Canvas route is available at `?renderer=canvas`. WebChromeClient logs JavaScript output under `AksaraGame`, including scene creation, first frame, renderer, dimensions, resource errors and renderer-process failures. This fixes observed structural defects; the original physical-device black screen has not been reproduced locally or verified on that device.

Portal retains its scrollable layout and now adapts up to 470dp to accommodate four rows. A short-screen instrumentation test verifies scrolling each row into view.

## Studio investigation

Prior CI run 42656116884 failed only `StudioV2UiTest.templateStyleIsChosenWithoutDuplicateStylePicker`: no `Pilihan Penjanaan` node after clicking the Settings tab. The test had scrolled to the template gallery and then clicked an offscreen tab. Tests now `performScrollTo()` on Settings before clicking it. No Studio runtime or backend behavior changed. Android emulator rerun is required to validate this diagnosis.

## Local validation

- `assembleDebug testDebugUnitTest assembleDebugAndroidTest`: successful.
- Android JVM tests: 94 tests, zero failures, errors or skips.
- Combat tests: pass; mechanics unchanged.
- Chromium WebGL and forced Canvas: initialization, nonzero canvas dimensions, movement, simultaneous direction/attack touch pointers, release, combat through victory, restart and pause/resume pass, no JavaScript exceptions.
- Missing Phaser script: visible failure and Canvas retry verified.
- Both app and instrumentation APK compile. Development APK: `/workspace/deliverables/aksara-game-fullscreen-fix-debug.apk`.
- APK SHA256: `292a666de223c34b3c178ad4cf5f85d33cfc8b6bc84c9d9f0e5e8b18da4d18a2`.

New Android tests cover scene/frame readiness, nonzero dimensions, Canvas pixel output, touchscreen movement, reverse-landscape configuration change, Back, return to the same portrait Chat activity, and four Portal rows on a short screen. They are added to the existing CI emulator gate with screenshot and `AksaraGame`/Chromium logcat collection.

Local Android emulator execution was attempted with API 35 Google APIs and the smaller API 31 default system image. Both failed extracting with `No space left on device` on the 7.9GB Cloud filesystem; no local emulator pass or physical-device verification is claimed. API 35 CI emulator results remain the runtime acceptance gate. PR stays open, unmerged. Final character artwork remains temporary as previously reported.

## First API 35 emulator run (42660895600)

All three `StudioV2UiTest` cases now pass, including the previously failing template/Settings case. `PortalLayoutTest.fourPortalItemsRemainReachableOnShortScreen` passes. The game test reaches frame readiness, starts combat, verifies touchscreen movement and landscape configuration changes, and captures `game-auto.png`. It then fails returning to its MainActivity scenario: `ActivityScenario.launch(GameActivity)` uses a task-clearing test launch, destroying the caller activity. This is a test harness defect, not an observed application crash. The test now starts the game through MainActivity's `startActivity`, matching production navigation. Instrumentation recompilation succeeds; the rerun remains required, including the Canvas half of the test and real Portal/draft continuity. Screenshot/logcat artifact exists in CI; Cloud download attempts returned HTTP 403 at the artifact redirect, so no local Android screenshot inspection is claimed.
