# AKSARA Android Native — SD-Turbo forensic checkpoint and acceptance
Date: 2026-11-09. Base: `5ce71b4ff093691c5bf3b43549e3f4f7878b4466`.
Branch: `fix/aksara-native-diagnostics-20261109`; draft PR #275 targets only `rebuild/aksara-android-native-v1`.

## Verified observations, not assumptions
1. The Web intelligence backend is Netlify and Android invokes its `bilik-antara` handler. PR #273 already added deterministic generated Voice Brain assets and sync tests; PR #274 already merged Session, Voice socket and partial-download safeguards into the Android development branch. The source code is present; actual shared-response quality, provider availability, Aoede audio and physical session recovery remain distinct live acceptance criteria.
2. The configured model is `samoudi/sd-turbo-gguf` / `sd_turbo_q4_0.gguf`, size `1847909248` and SHA-256 `d069ef2b2d3d5c2465662d706c242a1016db56163c109bd7e3008a94cdd00359`. These match the published model card, which describes a `stable-diffusion.cpp` conversion using `b7a74e6`, the same revision pinned in the native workflow. This validates *published provenance*, not a copy actually downloaded on a phone.
3. GitHub Actions run `42546941362` succeeded in compiling and packaging `lib/arm64-v8a/libaksara_sdturbo.so`. It did **not** load weights or produce a generated bitmap. Run `42546941493` built successfully but failed its post-build JNI/packaging assertion: the log shows no success output at the exact `unzip -Z1 ... | grep -Fx 'lib/arm64-v8a/libaksara_sdturbo.so'` step. The second workflow uniquely supplied `-Pandroid.injected.build.abi=arm64-v8a` while Gradle already enforces the ABI in `app/build.gradle.kts`. This discrepancy is a *suspected* packaging reason, not a proven runtime root cause. The new workflow removes the duplicate injected override and checks three JNI symbols.
4. Standard Android run `42546948063`: backend smoke, Web audit and JVM/build jobs passed; the emulator job failed in its visual test runner. That is **not** evidence of an SD-Turbo runtime failure.
5. No original phone `logcat`, native crash trace or generated offline image was provided to this audit. The **first failing stage on the device is NOT VERIFIED**. Do not claim that unsupported GGUF, tensor loading, GPU, RAM, JNI or VAE is the root cause yet.

## Source changes in PR #275
- Native GGUF magic/version preflight and stage tags `SDT_MODEL_HEADER`, `SDT_MODEL_INIT`, `SDT_SAMPLING_DECODE`, `SDT_BITMAP_ALLOC`, `SDT_CANCELLED`. Logcat records only stage labels, never private prompts or model paths.
- The JNI error path no longer reads `images[0]` for zero-image results. JNI OOM paths release the returned native image data/context.
- `probeNative` performs **real initialization and teardown** against the local model. The Studio button accurately states whether this loaded the model. Even a successful probe is *not an inference pass*.
- Model manager verifies actual GGUF header, full file size and SHA-256 before installing or validating existing weights. Cloud API routing is unchanged.
- JVM `SDTurboModelFormatTest` checks signatures/endian versions. `RealOfflineSDTurboTest` on a **physical arm64 Android device** generates images from two seeds with all network interfaces disabled; verifies image dimensions, nontrivial pixels, distinct seeds, PNG export and reopen. Missing prerequisites are JUnit assumptions (SKIPPED, not PASS).

## Capability matrix (source status / verification)
| Capability | Web | Android source | Actual live acceptance |
| --- | --- | --- | --- |
| Canonical Brain and identity | present | shared Netlify Chat; canonical generated Live instructions | Source-tested; semantic parity NOT VERIFIED |
| Chat streaming/provider metadata | present | ChatApi/ChatViewModel adapters present | Backend smoke PASS at baseline; complex provider fallback NOT VERIFIED |
| Research/URL/citations/tools | backend-supported | ChatApi metadata parsing / UI present | NOT VERIFIED per individual tool |
| Voice Aoede/context/reconnect | present | LiveVoiceClient/VoiceRecoveryPolicy with PR #273/#274 | Source-tested; physical audio NOT VERIFIED |
| Encrypted session preservation | Web and Android distinct | SessionStore/SessionContextStore; merged PR #274 | Prior archive instrumentation reported PASS; production migration NOT VERIFIED |
| Memory privacy default OFF | present | SavedConversationContext.memoryEnabled defaults false | Source-tested; physical opt-in/leak audit NOT VERIFIED |
| Cloud Studio generation | present | StudioGateway via Netlify | Source implemented; new-branch live regression NOT VERIFIED |
| Native SD-Turbo library packaged | n/a | pinned native C++ and JNI | Baseline Studio native build PASS; two CI paths under retest |
| Native model initialization | n/a | real `probeNative` added | NOT VERIFIED until phone executes it |
| Offline image diffusion inference | n/a | JNI `generate_image` pipeline present | **NOT VERIFIED** until actual on-device generated pixels |
| Local PNG gallery/history | n/a | MediaStore/history integration present | NOT VERIFIED for a genuinely local output |

## Safe reproduction on an arm64 phone
1. Use the exact JNI-enabled APK from a verified run of PR #275 (not the Cloud-only APK). Do not uninstall the existing app or erase its encrypted storage for signing convenience.
2. Open Studio > Local, install/import the published compatible Q4 GGUF, wait for SHA-256 verification, then run **Uji pemuatan model sebenar**. Note the exact stage code on failure.
3. With a verified installed model, switch off Wi-Fi and mobile data. Generate a prompt and save the output. Reopen it from the device gallery. Verify it differs when seed changes.
4. Collect the stage-filtered native log without messages or tokens: `adb logcat -d -s AksaraSDTurbo:I AksaraSDTurboTest:I`.
5. Optionally run Android instrumentation `my.aksara.nativeapp.RealOfflineSDTurboTest` on the physical device under the same offline prerequisites. A SKIPPED test proves nothing. The result is acceptable only when the test genuinely executes and passes.
6. Re-enable networking. Repeat a Cloud Studio image operation, Chat multi-turn context, Voice reconnect + spoken Malay follow-ups and session save/reopen.

## Release gate and deferred work
Never merge the draft PR before both native CI jobs pass and offline physical-device inference is demonstrated. Once those gates pass, validate the Cloud/Local UI, persisted image, session privacy and production backend non-regression before merging into the Android development branch only.

**Current verdict**: code-level diagnostics and acceptance test added; physical SD-Turbo root cause and actual offline generation remain **NOT VERIFIED**.
