# AKSARA Chess — verified Android delivery

Foundation `16de29dcfd0a3fab7e27b5a9a5955a86068eb61f` is preserved in ancestry.
All implementation commits are pushed to `feat/aksara-chess-foundation`.
[PR #290](https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/pull/290)
targets `rebuild/aksara-android-native-v1`, is mergeable, remains draft and is not merged.
The protected library notice from the advanced Android target is retained.

## Actual acceptance

Game implementation `ff00c941ee36a4c093b2d2f577c61c731c3c73b6` passed
[Chess Android run 42745809439, attempt 2](https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/actions/runs/42745809439).
Five API35 x86_64 instrumentation tests passed in 65.179 seconds:

- Real native touchscreen selection and moves against packaged Stockfish 19,
  undo, engine recreation, both orientations and saved-session restoration.
- Castling, en passant, Knight underpromotion, replay, White and Dark Queen
  checkmate, and actual touchscreen Undo while the knight animation is active.
- Three immediate Activity exits with no remaining native Stockfish processes.
- Original renderer fixture, paired cache measurement, and real offline Malay
  TTS start/completion callbacks (`ms-my-x-mse-local`, two started/two completed).
- Complete legal match from the starting position through checkmate, NNUE
  search, UCI_LimitStrength=false, legal bestmoves and search cancellation.

[Main Android regression 42745809361](https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/actions/runs/42745809361)
passed all 42 Android regression tests, app build, web audit, legacy game logic and
backend smoke checks. [Experimental Studio build 42745809517](https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/actions/runs/42745809517)
also passed. Existing app/runtime/voice JVM regression has 94 passing tests;
all 22 chess host tests pass with real Stockfish (including the optional engine
test which Gradle skips without its host-binary environment variable).

Evidence, hashes and the tested PR merge SHA are in `evidence/`. These are actual
Android matches and input events, not host-only proof or Gradle-only acceptance.

## Checkpoints and limits

A is passed on Android. B's perspective arena and responsive glass UI are usable
in both tested orientations. C's piece/capture VFX, camera, skip, promotion,
castling, checkmate and uninterrupted Undo are implemented and exercised. D's
contextual offline Malay speech is software-verified on Android. E's APK build,
regressions, source distribution and emulator measurements are verified; the
physical-device matrix and long-session performance acceptance remain open.
The entire original master specification is not declared 100% complete.

See [DELIVERY.md](DELIVERY.md), [PERFORMANCE.md](PERFORMANCE.md) and
[LICENSING.md](LICENSING.md) for artifacts, measured limits and distribution terms.

- Untimed practice only; no rated mode, time control or ARMv7 binary is advertised.
- Arbitrary blocked-pawn dead-position reachability and exhaustive imported-FEN
  reachability validation remain unsupported. Proven dead-material classes are
  detected conservatively. Restored local saves are not a multiplayer authority.
- Live verified blunder/brilliant/sacrifice classification and comprehensive
  behavioral rivalry profiling remain incomplete. The planner uses only supported
  board facts and qualified engine evidence, without inventing those labels.
- Physical ARM64, Bluetooth/wired/speaker/microphone, thermal, battery and long-session
  device testing remain unverified. TTS gender/naturalness depend on installed
  offline Malay voices. Cloud Aoede narration is not implemented.
- The emulator recorded median/p95 16 ms in one paired trial; other runners were
  much slower. Stable physical-device 60 FPS and full cross-process RAM/CPU are
  not proven. See the measured variability in PERFORMANCE.md.

No website, production backend implementation or Netlify configuration was
modified, and no Netlify deployment was invoked. Chat, Voice, Studio and the old
game remain separate. Code Engine and Terminal remain disabled.
