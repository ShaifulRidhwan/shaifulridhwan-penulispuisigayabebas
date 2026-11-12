# AKSARA NEURAL V1 — Advanced On-device LLM (PR #321)

Status: FOUNDATION SPECIFICATION; NOT A FUNCTIONING LLM. Target: Android Native branch `rebuild/aksara-android-native-v1`.

## Locked UX
- Three horizontal destinations: swipe left from Bilik Antara opens Aksara Neural, center is Bilik Antara, swipe right opens Aksara Today.
- Neural dashboard is single-screen, non-scrollable; detailed glass panels may scroll.
- Six cards: Neural Core, Device Intelligence, Live Inference, Model Library, Neural Laboratory, Knowledge & Reasoning.
- Separate Neural Playground; Bilik Antara remains the only main conversation interface.
- Dark Liquid Glass parity, keyboard/gesture conflict protections, no changes to existing Today, Chess, Voice or Studio modules.

## Advanced model selection, not marketing
- Benchmark modern 4B–8B-class models and mobile-optimized architectures; **no model chosen or bundled yet**.
- Compare quality in colloquial Malay, typo robustness, poetry, coding, reasoning, multi-turn instruction following, refusal and hallucination behavior.
- Runtime candidates: LiteRT-LM and llama.cpp, gated by Android ABI, chipset, driver, memory, licensing and supported model formats.
- Never equate model size with quality. Never promise 8B will run on every 8GB device.
- Model licenses, distribution permissions, provenance and cryptographic hashes must be reviewed before release.

## Architecture
1. `NeuralRuntime` interface: load/unload/generate streaming/cancel/metrics; **mock implementation first**.
2. `DeviceCapabilityProbe`: available RAM, ABI, accelerators, thermal and storage capabilities; no synthetic capability claims.
3. `ModelCatalog`: signed/verified manifest with model ID, variant, quantization, SHA-256, download URL, license, min-memory and runtime compatibility.
4. `ModelManager`: opt-in download, pause/resume, hash verify, atomic install, uninstall and disk quotas.
5. `NeuralRouter`: user-selected local mode; do not silently upload offline requests to cloud.
6. `NeuralKnowledgeBridge`: versioned offline facts and retrieval from PR #320 after it merges; avoid code duplication.
7. `NeuralPlayground`: separate ephemeral test context and explicit data deletion; default persistent memory OFF.
8. `NeuralDiagnostics`: measured TTFT, tokens/sec, RAM delta, temperature/thermal and error codes. No fake live readings.

## Security and performance
- Models download over HTTPS with trusted manifests, checksum and atomic rename; no arbitrary remote code execution.
- Local tool calling uses an allowlist and confirmation for write actions. No direct shell access by default.
- Concurrency limits, memory budgets, background cancellation, thermal throttling and graceful OOM recovery.
- Streaming must not block Compose UI or cause keyboard jumpiness.
- All performance targets are hypotheses until benchmarked on 8GB, 12GB and 16GB devices.

## Phased implementation
A. Foundation: model catalog schema, runtime contracts, device probe, feature flags and unit tests.
B. Model laboratory: reproducible benchmark harness and scored Malay prompt suite.
C. Runtime prototype: actual inference with selected model on supported physical Android device.
D. Model download manager: verified optional assets, storage management and offline verification.
E. Advanced RAG and context: integrate knowledge index, grounding, source display and session policies.
F. Locked dashboard and Playground UI, gesture tests and Liquid Glass parity.
G. Reliability: CI, device tests, battery/thermal/memory/latency and staged beta.

## Non-negotiable release gates
- PR #320 must be merged or integration rebased and retested.
- No 'AI ready' status until real model loads and generates on-device with network disabled.
- No PR merge solely on mock/demo UI.
- Preserve existing app, its provider fallback, privacy defaults, and current branch.


## Updated experimental target (2026-11-12): 8B first
- Primary evaluation candidate: Qwen3-8B GGUF Q4_K_M, subject to exact license, source revision, digest, Android llama.cpp compatibility and measured Malay benchmark results.
- Initial context window: 4096 tokens. Do not assume this fits every 8GB RAM device.
- Target arm64-v8a CPU backend first; acceleration only after verified device-specific testing.
- Model file is not committed or embedded yet. Do not advertise a working offline 8B until a physical Android device successfully generates in airplane mode.
- Bundle in test APK only through reproducible pinned artifact injection, not Git LFS pointers or fabricated placeholders.
- Gate installation on available RAM/storage; offer explicit unsupported-device explanation rather than crash.
- Never silently fall back to cloud when local-only mode is selected.

## Decision superseding embedded-8B proposal (2026-11-12)
- **No bundled model weights in the APK**. Remove the previous embedded-model delivery proposal from the release plan. Keep native runtime code small and model-agnostic.
- User explicitly opts into each model download from Model Library, after seeing size, license, hardware compatibility and available storage.
- Provide multiple independently selectable tiers (lightweight, balanced, advanced 8B). Qwen3-8B Q4_K_M remains an advanced evaluation candidate, not the mandatory default.
- Model files live in private app storage and support checksum verification, cancellation, deletion and clear download failure recovery. Resume is a separate implementation gate; do not label as supported before implemented.
- No model download on startup, no automatic model selection that triggers network access, no silent cloud fallback for local-only mode.
- The optional asset installer is experimental scaffolding only and must not be invoked by normal application startup or release packaging.
- A working model library requires authenticated manifest provenance, pinned artifact hashes and a real inference runtime; those remain release blockers.
