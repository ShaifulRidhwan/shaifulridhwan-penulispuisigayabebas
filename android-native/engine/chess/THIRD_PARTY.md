# Rules dependency

Vendored unmodified Java sources from https://github.com/bhlangonijr/chesslib
commit `12dac82e072696c209143f3b10a440044da9531b` (upstream pom version 1.3.7).
License: Apache-2.0, retained in licenses/chesslib-Apache-2.0.txt.
Upstream copyright headers remain in each source file. No upstream NOTICE file
was present at this revision. Uses Apache Commons Lang 3.18.0 (Apache-2.0).

Stockfish source and executable are NOT included in this module or APK.
The UCI driver accepts an already started Process; it does not download, extract,
or execute untrusted binaries. Host validation used official Stockfish tag sf_19,
commit `edb0d9db6731067ec50ce619ff372b463bc4dd5d`.
