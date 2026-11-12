# Neural Native Build (PR #321)

The default APK remains model-free and does not compile llama.cpp.

## Reproducible source setup

The Android NDK build is deliberately opt-in. The native source must be checked out under:

`android-native/app/src/main/neural/third_party/llama.cpp`

Use an **audited, pinned upstream commit**, not a moving branch. Record the exact commit and verify it in CI before shipping. Do not commit generated binaries or model weights to Git.

Example developer workflow (replace the placeholder with a reviewed 40-character upstream SHA):

```sh
git clone https://github.com/ggml-org/llama.cpp android-native/app/src/main/neural/third_party/llama.cpp
git -C android-native/app/src/main/neural/third_party/llama.cpp checkout <reviewed-40-char-sha>
cd android-native
./gradlew :app:assembleDebug -PenableNeuralNative=true
```

A native build intentionally fails when the source is absent, rather than silently shipping an empty engine. The C++ API must be checked against the selected upstream revision.

## Release gates

1. Compile native arm64-v8a JNI against the pinned upstream.
2. Verify correct Java JNI symbol names and successful System.loadLibrary.
3. Download a verified GGUF from the optional model catalog; verify SHA-256.
4. Load, generate, cancel and unload on a physical Android phone.
5. Run Malay benchmark, memory pressure, thermal and airplane-mode tests.
6. Confirm local-only mode never silently invokes a cloud provider.

**Known limitations:** current JNI generation returns its full result at completion, not streaming; prompt chat templates and runtime-level progress are not integrated; source commit has not been pinned and CI has not been run. Do not claim production readiness.

## Locked upstream source (2026-11-12)
- Upstream: https://github.com/ggml-org/llama.cpp
- Release tag: `b12248`
- Verified Git commit: `3837bf0bc02ea5d08f8ee3585fc8c7784a81bce8`
- Repository script: `bash android-native/scripts/prepare-neural-native.sh`
- Native build: `cd android-native && ./gradlew :app:assembleDebug -PenableNeuralNative=true`
- Upstream source is intentionally excluded from the Aksara Git tree; prepare it in CI before Gradle.
- This is a source pin, **not** a successful native compilation. The JNI API must still be validated against the pinned revision.
