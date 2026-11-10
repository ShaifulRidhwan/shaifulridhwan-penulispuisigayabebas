# Android performance validation

Approved native visual baseline: PR #297, merged as `1f646c18205470e2367498253ea1f199b8675dca`.
Its only validation repair selects the footer's unmerged Compose semantics node.
Validated native run: https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/actions/runs/42795938873
Validated Chess run: https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/actions/runs/42795938441

## Measurement stage

No production optimization is included in the initial measurement commit.
`ci/measure-performance.sh` records 10 process-cold launches, 10 task-resume
launches and 10 activity recreations with process-PID continuity checked.
Android `am start -W` launch times measure launch dispatch/first display, not AI
readiness or completion of the preserved 2.3-second branded intro. Missing
timings remain missing; they are never converted to zero.

Three streaming rendering trials each use 100 deterministic history messages,
20 warmup updates and 180 measured text updates paced at 32ms. The fixture calls
the real native chat UI without network inference. Window FrameMetrics, ART
allocation/GC counters, Java/native heap, process CPU samples and system memory,
thermal, battery, alarms and scheduler snapshots are retained. Animations run
at 1x during measurement. These are debug API35 emulator observations on a
software GPU, not physical-device battery, Bluetooth, GPU or AI-quality claims.
Raw device/CPU/display properties and unmodified measurements accompany each
run. No numerical improvement is claimed before baseline and final runs exist.

## Existing limitations

The older web/native parity audit still reports 44 mismatches, 28 missing native
references and four missing web references. That is separate from preserving
PR #297's approved native visuals. Real headset routing, acoustic quality,
thermal endurance, physical-device battery and comprehensive heap-leak analysis
remain unverified. The current chat/live-broker tests do not measure end-to-end
spoken response quality or Studio image-generation quality.

The managed cloud proxy denies local artifact-storage downloads with HTTPS
CONNECT 403. Artifacts remain hosted in GitHub Actions; local screenshot/APK
inspection is blocked until artifact-storage access is available.
