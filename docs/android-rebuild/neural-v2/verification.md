# Neural V2 implementation and verification

PR #321 stays on `feature/aksara-neural-local-v1`, targeting
`rebuild/aksara-android-native-v1`. The branch merges the existing target's PR #320
knowledge integration and preserves `b39e83ad67291b0e356145894605214f95d892eb`.
The PR remains unmerged and draft for owner review.

## Implementation

- Six compact, clickable modules use the existing `ChatWallpaper`, Liquid Glass
  surfaces/modals, Haze backdrop, gold icons, DM Sans/Space Grotesk and animations.
  Details scroll independently. Neural is page 2 (swipe left from center); Today
  is page 0 (swipe right). Open Neural details and the keyboard inhibit pager swipes.
- Three official Qwen GGUF releases have immutable revisions, real byte sizes,
  LFS SHA-256 hashes and license attribution. See `catalog-evidence.json`.
- Explicit download/import, real byte progress, cancellation/retry, staging,
  size/header/hash checks and same-filesystem atomic replacement. Interrupted
  transfers restart from zero. Private storage, deletion confirmation, hash
  verification on activation, migration of previous `.model` imports, no weights
  in the APK and no startup downloads.
- Pinned llama.cpp ARM64 JNI: GGUF lifecycle, model-provided chat templates,
  UTF-8 token streaming, 256-token prompt batches/128-token microbatches,
  bounded context, top-k/top-p/temperature sampling, epoch cancellation,
  native abort/load callbacks, serialized background work and cleanup.
- Current RAM/storage/ABI/API/thermal reporting; conservative load eligibility.
  Context choices 1024/2048; Advanced requires 8 GiB available plus 1 GiB reserve,
  so an 8 GB total-RAM phone is rejected. No performance guarantee from RAM alone.
- Offline chat uses only JNI, with four previous turns, Stop, context rejection,
  scrolling/IME handling, model switching, real token/timing metrics and errors.
  The local runtime has no cloud provider fallback.
- Explicit nine-case laboratory suite records real outputs, load time, TTFT,
  native tokens/s, duration, process PSS, cancellation, thermal status and errors.
  No automatic quality scores or background benchmark loops.
- Existing PR #320 knowledge and correction/follow-up retrieval are reused with
  attribution and missing-knowledge handling. Facts are displayed separately from
  generated reasoning. Chat is session RAM only; long-term memory remains OFF.
- Backgrounding/low-memory callbacks cancel work and unload the runtime. Queued
  transfers/hash checks/loading are cancellable. Initialization/storage errors
  become visible state instead of uncaught startup errors.

## Executed verification and fixed budget

1. Static audit; ARM64 NDK syntax check against pinned llama.cpp headers.
2. Voice Brain sync, local knowledge-index check, performance-preservation static
   contracts and `git diff --check` passed.
3. One genuine GGUF host JNI smoke run passed: load, 13 generated/streamed tokens,
   cancellation after one token, oversized-context rejection and unload. It ran
   without network access. Full details/output: `host-jni-smoke.txt`. This is Linux
   x86_64 evidence, not Android-device verification. One 639 MB Light-model download;
   no Balanced/Advanced weights downloaded.
4. Local full Gradle attempt 1: **SUCCESS**, 8m 6s, `assembleDebug
   testDebugUnitTest :engine:chess:test` with native enabled. One complete unit-suite
   execution: 194 reported, 193 passed, zero failures/errors, one skipped.
   App 146, runtime 3, voice 23, chess 22 (one skipped). The skipped existing
   `UciEngineTest.realStockfishSearchCancelAndRestart` requires an
   `AKSARA_STOCKFISH_HOST` executable, which was not supplied.
5. Local full Gradle attempt 2: **SUCCESS**, 53s, native `assembleDebug` only.
   It compiles the final cancellation/lifecycle/scrolling refinements. Unit-covered
   installer/catalog/integrity/device contracts were unchanged after the suite.
   The complete test suite was not repeated.
6. Local APK passes APK Signature Scheme v2 and ZIP integrity verification.
   Packaging includes ARM64 Neural, Stockfish, MapLibre and existing avatar/SQLite
   native libraries. Neural ELF LOAD segments have 16 KiB alignment. No GGUF weights.
7. A configure-only native check caught Android toolchain variables shadowing
   cached optimization flags. Normal CMake variables now set `-O3 -g`; generated
   ARM64 compile commands for JNI, llama and ggml CPU were checked without another
   build. The final CI workflow asserts this configuration and builds that revision.
8. One final manual workflow dispatch is reserved for the final pushed revision.
   It builds/sign-verifies/packages and publishes the owner APK; it does not repeat
   the complete test suite or run model inference. Intermediate pushes use
   `[skip ci]`. No automatic rerun, emulator cycle, endurance test or merge.

The two local full-build allowance is exhausted. Do not run another local full
Gradle build in this cycle. Final CI failure must be reported without reruns.

## Wallpaper integrity

Both assets and the `ChatWallpaper.kt` renderer are unchanged from `b39e83ad`:

- Mobile SHA-256: `aab5ebc2e56d4c4e265ed2c65cac3d26b08b8eea5949afcdaceaa92a90b1229f`
- Desktop SHA-256: `83060de2e2155d7f14cd1ba7f713d04f65f529440dd877238e4e4c8561d80048`

## Pending owner verification

Android physical-device inference, visual parity on the phone and large fonts,
full regression navigation/voice/Studio/game QA, low-memory/thermal behavior and
Balanced/8B quality/performance remain unverified. No physical-device or emulator
execution is claimed. Native dependencies/ARM64 packaging and host inference do
not establish those outcomes. Model quality is not certified by the timing suite.

Use `owner-checklist.md`. Test Light first, then larger models only when eligible.
No silent cloud fallback, automatic download or persistent conversation memory is
introduced. Do not merge PR #321 before owner testing.
