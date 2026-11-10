# Distribution gate — Stockfish 19

Stockfish is GPLv3. Host verification used the official source at
https://github.com/official-stockfish/Stockfish/tree/edb0d9db6731067ec50ce619ff372b463bc4dd5d
with `make -j2 build ARCH=x86-64 COMP=gcc`. The upstream build downloaded and
validated `nn-1a298aa575a0.nnue`, embedded in the host executable.
No Stockfish executable, weights, or linked native library is shipped by this change.

Before distributing an Android build containing Stockfish:

- Choose and document Android packaging and the legal relationship with the app.
  UCI or a separate process does not automatically resolve GPL obligations.
- Determine whether the combined application must be released under GPLv3;
  JNI linking must not be assumed compatible with a proprietary distribution.
- Retain GPLv3 text, copyright notices, attribution, modifications and licensing
  notices for both source and evaluation network assets.
- Provide the complete Corresponding Source for the exact binaries: source,
  modifications, NNUE data required to rebuild, build scripts/toolchain versions,
  configuration, and applicable installation information under GPLv3.
- Keep source availability with the distributed artifacts using a GPL-compliant
  delivery method. A generic upstream link alone is insufficient for modified
  builds or missing build material.
- Resolve application/dependency compatibility before releasing artifacts.

Android engine distribution remains gated until this review and runtime validation
are complete. This is an engineering checklist, not a legal conclusion that the
current application can be distributed with Stockfish under its existing terms.

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

This engineering review covers the chosen independent-process architecture. It
does not change the licensing of pre-existing AKSARA modules or grant permission
to relicense third-party app dependencies. Any later linked/JNI architecture
requires a fresh combined-work review. Stockfish itself and its Corresponding
Source remain GPLv3. Source availability must accompany all subsequent binary
redistribution, including copies distributed outside GitHub Actions.
