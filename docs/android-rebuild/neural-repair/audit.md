# PR #321 repair and APK forensic audit

Baseline: `fdf8bcade3008f57034be355bba9213780ee4379`.
Existing feature branch/PR retained; no merge or replacement architecture.

## Disabled activation: root cause

The old `loadingIssue()` required Light's 2 GiB recommendation plus an additional
fixed 1 GiB before allowing any attempt. The UI disabled activation on any issue,
so successfully downloaded/verified models never reached JNI on many 6 GB phones.
It incorrectly recommended “Light or Balanced” even when Light was selected.
The probe omitted `MemoryInfo.threshold`, and switching assessed RAM before freeing
the previous model. This was a managed policy/state issue, not evidence that native
loading had failed. The reported phone's exact available RAM/threshold is unknown.

## Repair

- `NeuralFoundation.kt`: preserve Android `totalMem`, `availMem`, `lowMemory`; add
  `threshold`, ART heap used/max, allocated native heap and process PSS. Physical
  RAM is not substituted for free RAM. Virtual/extended RAM is never added. ART's
  heap cap does not cap the mmap-backed native model.
- `NeuralMemoryPolicy.kt`: model-specific GGUF + fp16 KV + scratch + overhead
  estimates, plus `max(Android threshold, 256 MiB) + 128 MiB` reserve. Estimates
  are engineering bounds, not measured phone guarantees. Light explicitly uses
  1024 tokens: 639,446,688-byte model + 112 MiB KV + 128 MiB scratch + 192 MiB
  overhead = 1,092,431,520-byte estimated native working set. With a 216 MiB Android
  threshold, minimum available is 1,495,084,704 bytes (about 1.39 GiB); recommended
  availability remains 2 GiB + 384 MiB reserve. Above the minimum but below the
  recommendation, show a warning and permit a user-initiated controlled attempt.
- Hard failures remain: invalid RAM reading, unavailable ARM64 ABI, Android
  `lowMemory`/watermark pressure, serious thermal state, or insufficient working
  memory plus reserve. Balanced/8B retain conservative recommendation gates;
  Advanced also requires at least 10 GiB Android physical RAM. No virtual RAM credit.
- `NeuralActivationState.kt` / `NeuralViewModel.kt`: distinguish pending verification
  from confirmed native load. Verify the incoming file, unload the previous model,
  then resample RAM. Only successful JNI return AND `runtime.isLoaded` confirm the
  active ID. Cancellation/failure/unload reconcile state with the native runtime.
  Chat and Laboratory use the same readiness predicate and remain blocked until
  genuinely loaded. Stop/OOM/background cleanup remain in place.
- `AksaraNeuralDashboard.kt`: existing glass layout retained; show actual RAM,
  threshold, heap/PSS, native estimates/reserve, context and warning/failure separately.
  Refresh snapshots every five seconds only while Device/Library details are open,
  plus a manual Semak RAM control. Show pending/active/controlled-attempt labels.
  Model switching can request reevaluation after the current model is unloaded.

No native API or CMake replacement is needed. The pinned bridge already uses CPU
mmap loading (`LLAMA_LOAD_MODE_AUTO`), without mlock, and bounded 256/128 prefill
batches/microbatches. Native GGUF/context allocation errors and abort callbacks
already propagate failure and release resources. Default llama.cpp behavior was
inspected against the exact pinned header/source. Native mmap/KV are independent
of the ART maximum heap; PSS is reported for the whole process, not model-only RAM.

## Real APK comparison

Stable release: [f05ec540b647 APK](https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/releases/tag/aksara-android-308-309-310-merged-f05ec540b647).
This is the current `rebuild/aksara-android-native-v1` head, verified by its
[successful Android CI run](https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/actions/runs/43132572093).
Both actual APKs were obtained; no historical-artifact substitution was necessary.
Stable download matched published SHA256SUMS and APK Signature Scheme v2 verification.
Baseline Neural APK was retained from the prior verified release and rehashed.

| Category (compressed bytes inside APK) | Stable f05ec540 | Neural fdf8bcad |
| --- | ---: | ---: |
| ARM64 libraries | 90,781,608 | 93,495,932 |
| armeabi-v7a libraries | 8,677,637 | 0 |
| x86 libraries | 10,169,606 | 0 |
| x86_64 libraries | 91,142,603 | 0 |
| DEX | 31,051,036 | 35,627,380 |
| Assets | 10,778,339 | 10,778,973 |
| Resources | 1,502,818 | 1,502,816 |
| Metadata/other | 292,639 | 575,248 |
| ZIP headers/alignment/signature overhead | 58,148 | 56,500 |
| **Actual APK bytes** | **244,454,434** | **142,036,849** |

Stable SHA-256: `0b65b0ab9763c2c0bcc68ec541425a6c1ecccde50a54026d6a8755a47cccccc6`.
Baseline SHA-256: `d4fbb35ad7a3a01a1399611c92d0bdd121f6e97fa9895d2c3d5ae4c6c04348ad`.

**Cause B: ARM64-only packaging.** 109,989,846 compressed bytes of non-ARM64
libraries were omitted, offset by 7,572,261 bytes of additions/overhead changes.
Net reduction: **102,417,585 bytes (97.67 MiB)**. The largest single contributor
is x86_64 Stockfish: 99,921,776 raw / **81,211,141 compressed bytes**. Other omitted
entries are alternate-ABI MapLibre, Filament/avatar, graphics and SQLite libraries.

All **41 stable assets**, **seven stable ARM64 native libraries**, **132 drawable
entries**, and **both resource fonts** remain byte-identical. Neural adds one
6,754,872-byte ARM64 library (2,714,324 compressed), an assets/neural README and
Material3-related DEX/metadata. DEX count grows 22 → 23. Full per-entry sizes,
compression methods and SHA-256 inventories: `stable-vs-baseline.json`.

Both APKs are debug, min API 31 / target 35, versionCode 4, legacy native library
packaging. The Neural build sets `enableNeuralNative=true`, which filters to
ARM64; stable is universal. Neither uses R8/resource shrinking in debug. The
benchmark-only shrink configuration is irrelevant here. No dependency was removed;
Material3 was added before this repair. Compression methods are unchanged for
existing entries. Resource count is unchanged (166); five notification XMLs have
shifted compiled style IDs, and resources.arsc/manifest differ with new dependency
IDs and the intentional preview application ID. Decoding notification_action.xml
confirmed changed style references only. Wallpapers/images/fonts are unchanged.
No splits, missing ARM64 dependency, accidental variant switch or asset deletion
explains the reduction. Existing Studio optional SD-Turbo native library is absent
in **both** APKs; its absence was not introduced by Neural. No LLM weights were
bundled in either APK. Stockfish's embedded NNUE is preserved byte-for-byte on ARM64.

**Restoration: none warranted.** Do not inflate the ARM64 APK with other ABIs.
File preservation is not proof of every feature's behavior on a physical device.

## Backend unreachable: independent investigation

`backend-probe.json` records production web **HTTP 200** and provider-health
**HTTP 200 / ok=true**, Gemini/Groq online at 2026-11-12 03:41 UTC. No cloud inference
or Live token was requested. Both APK DEX inventories contain the same production
Netlify origin; the client transport, routes, timeouts, Internet permission and
manifest network settings are unchanged from the development branch.

`BackendNetworkErrors` uses this label only for DNS, connection, route or socket
timeout exceptions, not ordinary HTTP/provider failures. The reported device's
historical failure cannot be assigned conclusively without its exception/logcat
and network state. No client routing regression or current backend outage was
reproduced. No backend/routing changes are made on speculative evidence. Offline
Neural has no ChatApi/BackendRoutes transport and remains independent of cloud
health, even if the separate Bilik provider check fails.

## Preservation and controlled validation

The repair leaves ChatViewModel/multi-provider routing, Voice, Studio, Today,
chess/games, Explore/Settings/history/privacy, shared glass, wallpaper, resources,
assets, gestures, Gradle dependencies and packaging unchanged. Static performance,
knowledge-index and Voice Brain checks pass. New memory-boundary and activation
state tests explicitly distinguish control-state fixtures from real inference.

Run one consolidated native-enabled Gradle `assembleDebug` + targeted unit-test
invocation after the full repair is committed. Publish that exact local APK,
signed/ZIP/hash/ELF verified, as a prerelease from the existing branch. No Actions
build/dispatch or emulator loop is necessary. Actual results and final three-way
APK comparison will be attached to the release and PR, preserving the source SHA.
The native harness adds real repeated activation after streaming/Stop/unload with
one verified Light model on Linux. It does not constitute Android device validation.

Owner tests still required: load on the reported 6 GB phone after Semak RAM, inspect
its real available/threshold values, test streaming/Stop/unload/reload, verify chat
and Laboratory gating, test memory pressure/backgrounding, then review the existing
module regression checklist. No guarantee is made that every memory condition can
safely load Light, or that extended RAM makes Advanced eligible.
