# Android rendering measurement

The acceptance emulator runs Android API35 x86_64 with KVM and SwiftShader, 2 GiB guest RAM and audio output disabled. These are actual Android frame statistics, not host-JVM timing and not a phone/GPU guarantee.

The debug instrumentation replays the same 16 legal plies into the native board twice. The first pass disables rendering caches; the second uses them. Both retain original geometry, materials, gradients, shadows and effects. Each pass warms for 600 ms, resets dumpsys gfxinfo, records the fixed animation fixture and saves frame statistics and main-app memory. No AI move selection is simulated by this rendering benchmark; separate runtime tests exercise real Stockfish matches.

One paired trial in fixed uncached-then-cached order is exploratory. Host load, TTS initialization and the ordering can confound the comparison. Frame-time percentiles are not a measured steady-state FPS rate. No artificial reduction in effects, geometry or engine strength is applied.

Baseline code c3ae855, run 42744225438 (four of five tests passed; the precise animation timing assertion failed):

| Renderer | Frames | Janky frames | Median | p90 | p95 | p99 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Uncached original vectors/tiles | 232 | 74.14% | 61 ms | 101 ms | 117 ms | 150 ms |
| Board-plane and path caches | 283 | 66.43% | 53 ms | 73 ms | 77 ms | 97 ms |

The cached main-app PSS was 85,479 KiB. It excludes the separate Stockfish process; it must not be described as total game RAM. The embedded NNUE is about 109 MiB in the engine's runtime diagnostics, not a full process-PSS measurement.

A subsequent change also caches the same original pieces as 512px textures, above their displayed size. Acceptance source ff00c941ee36a4c093b2d2f577c61c731c3c73b6, run 42745809439 attempt 2:

| Renderer | Frames | Janky frames | Median | p90 | p95 | p99 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Uncached original vectors/tiles | 477 | 3.77% | 16 ms | 16 ms | 16 ms | 30 ms |
| Board-plane / 512px piece / path caches | 474 | 4.01% | 16 ms | 16 ms | 16 ms | 36 ms |

The cached main-app PSS was 106,866 KiB (RSS 203,172 KiB, swap PSS 10,553 KiB),
excluding the separate engine. The two passes do not show a measurable cache
speed advantage on this runner. Both are dramatically faster than the prior
runner, including its uncached pass; that variability prevents attributing the
cross-run difference to caching. This is not a claim that optimization alone
caused a 53-to-16 ms improvement. Original board materials remain on a 1024px plane. These are explicit reuse optimizations, not simplified substitute artwork.

A stable 60 FPS claim requires more work and physical-device measurement. Physical ARM64, long-session thermal/battery behavior, total cross-process RAM/CPU and Bluetooth/wired/speaker/microphone behavior remain unverified. No physical-device performance result is inferred from this emulator.
