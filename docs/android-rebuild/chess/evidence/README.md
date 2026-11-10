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
