# PR #321 final repair, 2026-11-12

Starting head: `b391e965217e7c5c25c0cb1176a108b5c9fa98fc`; same working branch,
`feature/aksara-neural-local-v1`. Keep draft and unmerged until owner device QA.

## Build diagnosis

At the start of this session the latest `b391e965` Neural owner build
[43163581713](https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/actions/runs/43163581713)
had actually succeeded, including JNI compilation, signature/archive checks and
APK publication. Standard Android, Studio, Intelligence and Cloudflare checks
also passed. An old red badge is not evidence of a new JNI or dependency failure.

Historical failed Android run `43156590584`, job `130977945220`, failed at
`Compile installable APKs`; Studio run `43156590593`, job `130978005436`, also failed.
The source at their head `e2b74dd` contains literal `\n` inside a line comment in
`NeuralViewModel.send`, commenting out declarations of `history`/`nativeHistory`,
and another literal `\n` joining the output limit declaration and `measure` call.
Existing commit `8c6f60e` restored those physical Kotlin lines, and `2c0202f` repaired
subsequent UI string newlines. Both are ancestors of `b391e965` and retained here.
The managed environment was denied access to the historical Azure log redirect
(HTTP CONNECT 403). The final owner workflow therefore retrieves the original
logs read-only on its runner and retains compiler error excerpts with the APK;
it never reruns either old job. Do not confuse this access failure with a build error.

## Implementation

- Shared wallpaper, Liquid Glass surfaces/modal and large brain remain. Six modules
  retain navigation, with content-sized minimum-height tiles, wrapping library
  controls, Android Back handling, current model/quantization and real runtime/RAM
  status. Dashboard/device/library RAM snapshots refresh every five seconds.
- Qwen3 fast mode retains a real newline `/no_think` directive. The pinned C API
  detects Qwen3 as ChatML and does not evaluate Jinja `enable_thinking=False`;
  native prompt formatting now appends the documented empty `<think>` block for
  Qwen3 fast requests. This conditions generation, rather than stripping output.
  An explicit reasoning toggle uses `/think`. Short greetings skip retrieval and
  use a short Malay system instruction and a bounded answer budget.
- Incremental UTF-8 decoding buffers split code points. UI receives deltas,
  coalesces at 40 ms and flushes the final frame. No full stream decoding at every
  token. Native token count survives cancellation independently of text chunks.
- Common evaluated prompt prefixes reuse KV entries; last prompt token is always
  re-evaluated for logits. Cancel/failure clears partially evaluated KV state.
  Context overflow remains an explicit error, never a silent context overwrite.
  mmap is explicit, mlock disabled, prefill batch/microbatch 512/256.
- CPU Auto remains a conservative topology heuristic, not a claimed device-tuned
  optimum. Manual 2/4/6 requests are bounded by reported processors. An opt-in
  comparison runs the same prompt with an empty prefix cache per configuration,
  stops under Android pressure/serious thermal status and restores user selection.
- Native prefill, native TTFT, decode compute token/s, queued time and cancellation
  timing are measured independently. UI TTFT and publish-to-Compose-frame latency
  are separate. Inference duration excludes the subsequent Android memory probe.
  PSS/RSS, available RAM, pressure watermark and thermal state are reported from
  Android; missing RSS is unavailable, not zero.
- Activation verifies size/GGUF/SHA-256 before unloading, then probes fresh RAM and
  loads JNI. Active state follows actual JNI success. Removed the Light path that
  bypassed insufficient estimated memory, and the arbitrary 10 GiB physical-RAM
  lock for 8B. All tiers use weights+KV+scratch+overhead+Android reserve; recommendations
  remain advisory, not a substitute for actual free RAM. Light scratch estimate
  is 192 MiB; host graph reserve was about 154 MiB with the current prefill profile.
  Context defaults to 1024; an explicit 2048 request is assessed separately.
- Existing Q8_0 model ID and pre-V2 `.model` recovery are preserved. SHA verification
  is mandatory at every activation. Missing, truncated, wrong-GGUF and wrong-hash
  files have distinct diagnostics. Import closes its input even on storage failure.
- Added optional Unsloth Qwen3 0.6B Q4_K_M with immutable revision, Apache-2.0,
  publisher LFS size/hash and attribution. Original Q8_0 stays first and is never
  automatically replaced. No automatic weight downloads and no weights in APK.
- One dedicated owner workflow builds ARM64/JNI, runs focused regressions and
  publishes checksums, test XML archive, build log and prerelease. The standard
  Android and experimental Studio duplicate builds skip only this PR branch;
  other branches retain their existing jobs. Existing application modules, assets,
  animations, shared design and navigation source are unchanged.

## Local evidence

Pinned llama.cpp `3837bf0bc02ea5d08f8ee3585fc8c7784a81bce8` compiled for Linux x86_64
against the actual JNI bridge. Both real model files match their catalog hashes:

| Model | Bytes | SHA-256 |
| --- | ---: | --- |
| Official Qwen Q8_0 | 639446688 | `9465e63a22add5354d9bb4b99e90117043c7124007664907259bd16d043bb031` |
| Unsloth Q4_K_M | 396705472 | `ac2d97712095a558e31573f62f466a3f9d93990898b0ec79d7c974c1780d524a` |

Both pass real streamed-token/callback agreement, fast response without a generated
thinking block, common-prefix reuse, Stop after one token, queued cancellation,
cleared cache after cancellation, context rejection, generation rejection after
unload and two reload/stream cycles. No inference or benchmark mocks.

For the same 58-token prompt with an empty prefix cache and **2 actual host threads**:

| Model | Prefill ms | Native TTFT ms | Decode compute token/s |
| --- | ---: | ---: | ---: |
| Q8_0 | 534.648 | 540.405 | 41.617 |
| Q4_K_M | 302.550 | 307.257 | 65.239 |

Single samples, random sampling and different answer lengths: not a statistically
controlled performance ranking or quality score. Host exposes three processors;
4/6-thread requests are both clamped to three, recorded in `host-jni-samples.json`.
No claim is made about real 4/6-thread phone performance. Generated text includes
small-model factual errors; availability is not a guarantee of answer quality.
Native cancellation-to-return was 4.807 ms (Q8) and 4.494 ms (Q4), host only.
The exact repeated 47-token greeting reused 46 tokens on both models. This is a
cache correctness sample, not a before/after physical-phone benchmark.

The Voice/Web Brain sync, versioned local knowledge and preservation contracts
passed locally. Kotlin/new UTF-8 split-boundary tests, memory/activation/integrity
tests and selected existing-module regressions are run once in the ARM64 owner
workflow. Its published test XML and exact source SHA are the build receipt;
local JNI evidence alone does not prove Android compilation or packaging.

## Owner validation still required

Install the new SHA-scoped PR preview alongside the existing app. Android does
not share private model files between preview package IDs. Import the already
downloaded catalog GGUF through the document picker if it is available outside
the old preview; this build cannot silently read another app's private storage.

Test activation with the actual phone's free RAM/watermark, Malay quality, warm
TTFT/token rate, thread comparison, context 1024/2048, airplane-mode streaming,
Stop, repeated unload/reload, background/thermal/memory pressure, keyboard and
all six module dialogs/scrolling. Check Chat/Today/Novel/Puisi/Catur/Voice/Studio.
No emulator or CI timings establish these physical-device results. Larger models
remain device-unverified. TTFT <=3s is a device benchmark goal, never a guarantee.
