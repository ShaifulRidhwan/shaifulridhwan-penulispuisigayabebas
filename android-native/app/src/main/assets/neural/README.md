# Bundled Neural GGUF test model

This directory intentionally contains no model weights.

To build an experimental APK with a bundled model:
1. Select a legally redistributable GGUF model and record the exact source, license, quantization, size, and SHA-256.
2. Place the model in `android-native/app/src/main/assets/neural/<model>.gguf`.
3. Supply a validated `NeuralModelDescriptor` whose SHA-256 matches the exact bytes.
4. Connect and test a real ARM64 GGUF inference backend. `UnavailableNeuralRuntime` is a deliberate fail-closed placeholder.
5. Verify airplane-mode inference, memory pressure, cancellation, thermal behavior and APK install size on actual hardware.

**Do not report this directory or the asset installer as a bundled working LLM.** GitHub's UTF-8 file writer cannot upload multi-GB GGUF binary assets. A binary artifact upload or reproducible build-time fetch with pinned digest is needed.

For Play Store delivery, APK/AAB distribution size constraints must be assessed separately. Test APKs may use a different delivery path.
