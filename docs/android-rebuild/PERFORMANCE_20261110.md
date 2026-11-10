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

## Executed initial baseline

Measurement-only commit `a4898c51f15ac92184ade7cf15c7c352cb423ff5` passed native
and Chess CI. Native measurement run:
https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/actions/runs/42798190575

API35 x86_64, SwiftShader, 390×844 display at density160, 1x animations.
Ten cold launches had a2190.5ms median; ten warm recreations had a443ms median.
Hot `TotalTime` was present in six of ten attempts, median384ms; four values
remain missing. Three rendering trials had medians216.870/230.982/249.244ms,
p95 values285.082/300.213/316.899ms, and allocation deltas
51,990,528/52,379,648/52,191,232bytes. These are debug software-GPU observations.
`performance-20261110/android-initial-baseline.json` retains all samples,
GPU/heap/GC counters and the baseline APK's size/checksum. It is not final delivery.

The separate cloud-proxy baseline completed three real Gemini streams, one
real768×768 FLUX.2 Klein generation and the Live broker request. Its JSON files
are not Android device latency or microphone-quality measurements. The JPEG
was decoded, verified and inspected locally without resampling.

## Implementation awaiting final validation

- Full-width assistant bubbles skip an unused additional text measurement.
  Content-sized user/welcome bubbles retain their original measurement.
- An immutable formatter and timestamp-keyed remembered strings avoid repeated
  date formatting during streaming.
- When no message jump is pending, the no-op jump effect no longer rebuilds
  the complete message-ID list. Pending jumps still observe all ID changes.
- Archive merging iterates both lists without concatenating them first.
  Stable-ID overwrite order, history capacity and encryption are unchanged.
- Each stream creates its HTTP call before its scoped worker starts.
  Cancellation joins cleanup; routing, payloads and fallback are unchanged.
  Blocked-response and mid-stream cancellation tests were added.

Final CI runs baseline/final/baseline on the same disposable emulator, with
three rendering trials and ten startup samples per mode per pass. Fresh CI-only
installs accommodate independent debug certificates. Final median p95 must not
exceed every baseline control trial; no invented FPS target is imposed.
Four-size static native screenshots are compared without resizing or cropping,
allowing only one8-bit channel step of rounding noise. Dynamic voice and Studio
images are excluded from that pixel gate; their production sources are unchanged.
Real Live handshake/audio close, settings, encrypted-draft and game-asset tests
are additional required gates.

The APK remains debug-signed. Matching-certificate update compatibility with a
user's existing installation is not established. Never uninstall a real app as
a workaround. The integration cannot inspect repository signing secrets.

## Existing limitations

The older web/native parity audit still reports 44 mismatches, 28 missing native
references and four missing web references. That is separate from preserving
PR #297's approved native visuals. Real headset routing, acoustic quality,
thermal endurance, physical-device battery and comprehensive heap-leak analysis
remain unverified. End-to-end acoustic/ASR quality and repeated Studio
image-quality comparisons remain unverified; one real generation is established.

The managed cloud proxy denies local artifact-storage downloads with HTTPS
CONNECT 403. Artifacts remain hosted in GitHub Actions; local screenshot/APK
inspection is blocked until artifact-storage access is available.
