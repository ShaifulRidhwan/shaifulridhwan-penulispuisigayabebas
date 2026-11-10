# AKSARA Chess — current acceptance status

## Checkpoint A: passed on Android

Base preserved: `16de29dcfd0a3fab7e27b5a9a5955a86068eb61f` on
`feat/aksara-chess-foundation`, successfully pushed to the verified origin.
The draft PR is https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/pull/290
and targets `rebuild/aksara-android-native-v1`; no merge has been performed.

Source `8f5f0b8c95b5f7c5f5afeb8f382ec0b9d71f1e28` passed build and Android API35
runtime in GitHub run 42734184090. Both instrumentation tests passed, including
actual touchscreen e2-e4, Stockfish response, Undo, Activity recreation, search
cancellation, legal bestmove and a complete engine match to checkmate. See
`evidence/checkpoint-a-pass.txt`, screenshot and Android PGN. This is Android proof,
not merely host engine proof or Gradle build success.

Stockfish 19 is a separate NDK-built PIE process extracted by PackageManager from
libstockfish.so, never loaded as a JNI DSO. ARM64 and x86_64 binaries include the
hash-verified official NNUE. API35 CI executes x86_64; physical ARM64 execution is
not yet independently verified. Absolute Darkness disables UCI_LimitStrength,
sets Skill Level 20 and MultiPV 1, bounds resources, and validates all bestmoves.

## Premium candidate: activated, Android regression pending

Current source activates native perspective arena, procedural marble/obsidian,
original vector portrait, cached piece geometry/shaders, move/capture particles,
knight jumps, castling rook movement, promotion animation, camera focus/reset,
skip and animation speed controls. The existing Phaser game remains independent.

It also adds offline Malay TTS with explicit subtitle fallback, transient audio
focus, original effects, four voice modes, replay/volume controls and cleanup;
on-device-only push-to-talk requires an explicit user permission action. The
existing Gemini Live Voice service and production backend are not used or changed.

Post-game analysis re-searches actual positions with bounded time, cancellation
and thermal checks. It exposes depth and centipawn changes, not fabricated
accuracy. Replay preserves the authoritative session. Rivalry storage defaults
to disabled and is bounded to 50 local records, with deletion controls.

The premium app and instrumentation APK compile locally and JVM regression
passes. New Android tests cover perspective touch, both orientations, castling,
en passant, Knight underpromotion, checkmate, replay and Undo during animation.
Their CI result and final visual/performance assessment are still pending.
Do not mark B–E or the full project complete until those gates pass.

## Evidence and limitations

- Existing app/runtime/voice JVM regression: 94 tests passed before premium
  activation. Chess tests include canonical perft, special rules, history,
  repetition/claim distinctions and sustained legal games. Final totals are in XML.
- Earlier local software API31 run failed UI tests with System UI/Phone ANRs;
  its native Stockfish/NNUE shell test passed. Failure evidence is retained.
- CI's initial touch failures were diagnosed to Android's first-use immersive
  education overlay, not hidden: a screenshot showed the blocking dialog. Tests
  now dismiss that system education exactly as the pre-existing game tests do.
- No physical Bluetooth/wired/speaker/microphone/thermal test is claimed. Actual
  offline Malay voice availability, gender and naturalness depend on installed
  device voices. Aoede narration is not implemented; Gemini Live is not a TTS API.
- Generic blocked-pawn dead-position reachability and complete imported-FEN
  reachability validation remain unsupported; proven dead-material classes are
  detected conservatively. Imported saves are local, not a multiplayer authority.
- Untimed practice is the implemented mode. No rated/competitive mode or timed
  chess clock is advertised. ARMv7 is not bundled or runtime verified.
- GPL engineering review and Corresponding Source delivery are documented in
  LICENSING.md and chess-native/README.md. CI publishes matching source with APK.

No production website or Netlify configuration files have been modified. New
commits use [skip netlify]. No deployment or force-merge action is authorized here.
