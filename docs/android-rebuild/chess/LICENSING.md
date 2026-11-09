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
