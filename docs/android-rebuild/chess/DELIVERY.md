# Verified AKSARA Chess delivery

Implementation commit: `ff00c941ee36a4c093b2d2f577c61c731c3c73b6`.
The PR merge tree tested by CI is `2846c61b2bd789ac54e8306afec00a7249580761`;
`evidence/verified-delivery-build.txt` preserves both identities.

- [Installable debug APK artifact](https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/actions/runs/42745809439/artifacts/13731163654)
- [Matching Stockfish Corresponding Source](https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/actions/runs/42745809439/artifacts/13731393248)
- [Successful Android evidence, attempt 2](https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/actions/runs/42745809439/artifacts/13731139389)
- [Complete application source at the tested commit](https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/tree/ff00c941ee36a4c093b2d2f577c61c731c3c73b6)
- [PR #290, draft and unmerged](https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/pull/290)

APK SHA-256: `b34e45a32296b335685e765b972e3da3ae19330f5d4f5d29bd8ca08b9be52cde`.
Source archive SHA-256: `5de1ba4a03804abdd82ee45e18f831e2277112bcf137129bdc17907512b890c0`.
The downloaded APK passed apksigner verification with an Android-compatible v2
signature. It is the same artifact installed by the successful emulator job.
Artifacts currently expire on 2027-02-08; retain matching source when mirroring.

| Deliverable | Source / evidence |
| --- | --- |
| Real rules, FEN/UCI/SAN/PGN, claims, save/undo | `android-native/engine/chess`, perft and rules tests |
| Stockfish 19, embedded verified NNUE, bounded full strength | `android-native/chess-native`, `UciEngine.java`, Android match report |
| Native human White vs AI Black integration | `ChessActivity.kt`, `ChessModel.kt`, Portal route |
| Perspective arena, original pieces, Queen portrait, glass UI | `ArenaBoardView.kt`, `ChessBoardView.kt`, `QueenPortraitView.kt`, `PremiumChessScreen.kt` |
| Moves, captures, camera, castling/promotion/mate effects | Native renderer; actual Undo-during-animation test |
| Contextual Malay dialogue and real offline speech | `QueenDialogue.java`, `QueenVoice.kt`, TTS callback evidence |
| Replay, analysis and opt-in basic local rivalry memory | `ChessModel.kt`, `RivalryMemory.kt` |
| JVM and Android reports | 94 existing JVM, 22 chess JVM/host, 42 app Android + 5 chess Android tests |
| Performance and visual evidence | `PERFORMANCE.md`, portrait/landscape/mate PNGs and raw frame reports in `evidence/` |
| GPL review and source companion | `LICENSING.md`, `chess-native/README.md`, source artifact above |

The complete Android engine match was `1. f3 e5 2. g4 Qh4# 0-1`. White moves are a
stated legal human fixture; every Black move is selected by actual Stockfish.
Touchscreen play against the engine is separately verified by native UI tests.
The available offline Malay voice produced two onStart and two onDone callbacks.
This confirms software speech playback, not physical audible quality or routing.

Main Android run 42745809361 and experimental Studio run 42745809517 passed.
The first Chess attempt at this implementation passed all five tests but its
unbounded logcat capture ended with exit 255 before evidence pull; attempt 2
passed and published full evidence. Earlier c3ae855 had a real test failure: the
UIAutomator idle barrier outlasted the animation before the assertion. The final
regression injects actual Android MotionEvents without that idle barrier and
observes animation active before tapping Undo; it does not remove the assertion.
The follow-up CI harness preserves optional diagnostic failures while requiring
all test-written proof files and canonical instrumentation success.

See STATUS.md for remaining specification gaps. This delivery is a working native
Android game, not a declaration that every original master requirement or the
physical performance matrix is complete. No PR merge or Netlify deployment has
been performed.
