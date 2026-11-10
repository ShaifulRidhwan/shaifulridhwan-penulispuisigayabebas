# Runtime evidence, 2026-11-10

- android-shell-uci.txt: actual Android API31 x86_64 process, embedded NNUE, legal
  bestmove after e4. Does not prove application UI.
- android-api35-engine-match.txt: actual API35 GitHub emulator, application-packaged
  executable, full legal game to checkmate, NNUE search and cancellation test pass.
- local-api31-failed-tests.txt: software-emulated API31 had System UI ANRs and UCI
  initialization timeout. This is a failed run, not a pass.
- android-initial.png: local system ANR screenshot, retained as failure evidence.
- initial-android-build-sha256.txt: local first gameplay candidate, not final APK.
- gradle-jvm.json: existing app/runtime/voice pass; the optional host-engine test
  was skipped by Gradle, and separately executed successfully in host-junit.txt.

CI 42729088110 produced APK/source but failed the touch test before first frame.
Do not call this CI run a pass. The follow-up waits for an actual first frame and
computes hit-test geometry on size changes. Runtime rerun required.

CI 42732815269 diagnostic established the main blocker precisely: the Android
immersive education dialog "Viewing full screen / Got it" covered the board.
The View state was 320x330, rendered=true, shown=true, focus=false, engine ready,
no engine error, and no moves entered. See immersive-education.png and its state
file. The first-frame hypothesis alone did not fix the test. The next test uses
the same explicit system-education dismissal already used by VisualParityTest;
real touch selection and AI reply assertions remain required.

Final implementation ff00c941ee36a4c093b2d2f577c61c731c3c73b6:
`premium-android-pass.txt` records five actual API35 tests passing in 65.179 s.
The portrait, landscape, Dark Queen mate, PGN, TTS callback, process cleanup and
paired renderer reports are copied from successful run 42745809439 attempt 2.
`verified-delivery-build.txt` identifies source and PR merge commits, and the
SHA256 file identifies the exact APK and source archive. Main Android regression
run 42745809361 passed all 42 tests. See ../DELIVERY.md for immutable artifact links
and ../PERFORMANCE.md for measured limitations, including cross-run variability.
