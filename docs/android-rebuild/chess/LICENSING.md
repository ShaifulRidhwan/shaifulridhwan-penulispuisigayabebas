# Stockfish 19 distribution review

Stockfish is GPLv3. Host verification used the official source at
https://github.com/official-stockfish/Stockfish/tree/edb0d9db6731067ec50ce619ff372b463bc4dd5d
with `make -j2 build ARCH=x86-64 COMP=gcc`. The upstream build downloaded and
validated `nn-1a298aa575a0.nnue`, embedded in the host executable.
The Android APK now contains independent ARM64 and x86_64 Stockfish executables
with the same embedded network. The historical foundation contained host-only
verification; that is no longer the delivered packaging. API35 instrumentation
executes the extracted x86_64 program and verifies NNUE, UCI and legal bestmoves.

## Android implementation review (2026-11-10)

The selected implementation builds Stockfish as an independent PIE executable,
not a JNI library. The `.so` filename is an Android installer convention only;
AKSARA never dynamically loads or links that file. Communication consists solely
of standard UCI commands and textual results over process pipes. The engine's
internal classes, data structures and NNUE evaluators are not used by app code.
This supports treating the APK as aggregation of independent programs rather
than asserting that a JNI-linked proprietary combination is exempt from GPL.

Upstream engine source, AUTHORS, scripts and GPLv3 text are vendored. The network
is downloaded by immutable content hash and included in the generated
Corresponding Source archive. App assets retain GPLv3 and Apache-2.0 texts and
notices. CI publishes the source companion before publishing the APK and hashes
both; a missing source archive fails delivery. Compiler and system library
requirements are stated in chess-native/README.md. No signing credential is
needed for recipients to rebuild and install their own debug package.

The statically linked NDK libc++ runtime's LLVM notices are included in both the
source companion and APK assets. Chesslib and Apache Commons Lang notices and
Apache-2.0 text are retained. Original graphics and synthesized effects remain
source assets in this repository, without externally licensed placeholder art.

This engineering review covers the chosen independent-process architecture. It
does not change the licensing of pre-existing AKSARA modules or grant permission
to relicense third-party app dependencies. Any later linked/JNI architecture
requires a fresh combined-work review. Stockfish itself and its Corresponding
Source remain GPLv3. Source availability must accompany all subsequent binary
redistribution, including copies distributed outside GitHub Actions.

Actions artifacts expire. Anyone mirroring or retaining the binary must retain
and serve its matching source companion for as long as they distribute it; an
expired artifact URL alone is not a durable source offer. This debug delivery is
not authorization for a proprietary JNI-linked release under different terms.
