# AKSARA Chess — implementation status

Checkpoint A is **incomplete**. B–E have not started. This is foundational source,
not a delivered playable Android chess experience. No chess APK exists yet.

## Recovery audit

Base Android branch: `rebuild/aksara-android-native-v1`, clean at
`3c1601bb27d7872c2c07115b1f24b0dfa7a5ef3b` (merged PR #289, Eclipse Arena V3).
Working branch: `feat/aksara-chess-foundation`.

- Gradle app plus runtime, voice and avatar modules; Compose UI, Haze glass,
  native custom avatar drawing. Existing game uses bundled Phaser in WebView.
- `GameContent` launches non-exported landscape `GameActivity`; MainActivity
  remains on the back stack. Keep immersive insets, audio focus, renderer recovery
  and Canvas fallback. Prior verification is documented in game/FULLSCREEN_FIX.md;
  it must not be confused with verification of new chess code.
- Portal dispatches game, Studio and library independently. Code/Terminal/engines
  are explicitly rejected by the overlay. No navigation has been changed.
- Live voice obtains a backend session token and configures Aoede on a Gemini
  live socket. This is not a verified narrative TTS API. No Live session is reused
  for chess and no production backend request was made by this task.
- CI already builds app/instrumentation APKs, runs JVM tests, browser tests,
  backend smoke and Android emulator tests. This change has not been pushed or
  run in CI. Existing workflow artifacts are not evidence for chess.

## Implemented and verified on Linux host

- Vendored pinned Apache-2.0 chesslib source and isolated Java Gradle module.
- Legal move validation, castling, en passant, four promotions, FEN, SAN/PGN,
  mate/stalemate, conservative dead-material detection, repetition, distinct
  claim/automatic draw rules, resignation/agreement, undo and history restore.
- Asynchronous Stockfish 19 UCI process controller, full-strength options,
  bounded threads/hash/search budget, cancellation and stale-result guards.
- Fifteen JUnit tests pass with real official Stockfish 19. The integration test
  waits for an active search before cancelling, then searches a new position.
- Perft: start depths 1–4 = 20/400/8902/197281; Kiwipete depths 1–3 =
  48/2039/97862; rook/en-passant reference depths 1–4 = 14/191/2812/43238.
- Full Fool's Mate game terminates correctly and exports checkmate SAN/PGN.

Host build: official sf_19 commit `edb0d9db6731067ec50ce619ff372b463bc4dd5d`,
`make -j2 build ARCH=x86-64 COMP=gcc`, GCC, embedded NNUE
`nn-1a298aa575a0.nnue` (SHA256
`1a298aa575a085434d29027978dc36867fe9c5bcea9376654b7a8eba1e52dfc2`).
Host executable SHA256:
`f281e3e09f40e23ed7570589fb58eb9a25ebfb42022ff526810b9da9a5ae7b3c`.
It is not an Android artifact and is not committed/distributed.

Reproduce host tests with `engine/chess/host-test.sh`; set
`AKSARA_STOCKFISH_HOST` to the host executable to run the real-engine test.
Without it that test is skipped. ECJ compilation was used because only a JRE
was installed; the package helper could not run because sudo was absent.

## Acceptance gaps

Android SDK, NDK, adb and emulator were not present in this workspace audit.
No Android engine process packaging/JNI, ARM ABI validation, Android NNUE search,
clock, lifecycle integration or APK build was completed. Java API desugaring still
needs checking on minSdk 31. Arbitrary blocked dead positions and full imported
FEN validation remain incomplete. See module README for exact API limits.

No 2.5D arena, animation/VFX, voice, microphone interaction, rivalry memory,
post-game analysis UI or Portal chess entry has been implemented. No hardware
audio, Bluetooth, thermal, frame-time or Android screen evidence is available.
Do not mark any of these as passed. GPL distribution review remains open;
see LICENSING.md. No PR created, no merge, no remote push, no Netlify deployment.
