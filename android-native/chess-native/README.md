# Stockfish 19 Android process distribution

Unmodified upstream source: official-stockfish/Stockfish, sf_19,
`edb0d9db6731067ec50ce619ff372b463bc4dd5d`. GPL-3.0, full notices in stockfish/.
Build with Linux, make, curl, tar, sha256sum and Android NDK 27.2.12479018:

    ANDROID_HOME=/path/to/sdk bash android-native/chess-native/build.sh

Default ABIs: arm64-v8a and x86_64. No unsupported ARMv7 claim. Native min API 29,
application min API 31. NNUE is hash-verified and embedded in the executable.
The source is not linked into AKSARA: a separate process receives standard UCI
text through stdin/stdout. No shared address space, JNI calls or engine internals.
The same UciEngine works with an independently installed host Stockfish.

The PIE executable is named libstockfish.so only to have Android PackageManager
extract it into the executable, read-only nativeLibraryDir. It must NOT be loaded
with System.loadLibrary. Legacy packaging and extractNativeLibs are required;
executing downloaded files from writable app filesDir is deliberately avoided.
The C++ runtime is statically linked. Its LLVM/libc++ notices are preserved in
stockfish/LLVM-libcxx-LICENSE.txt and in the app's chess license assets.
ELF LOAD alignment is 16 KiB.

`build/stockfish-19-corresponding-source.tar.gz` contains source, NNUE, licenses,
this documentation and build script. Ship it beside every APK artifact, preserve
notices, publish modifications and retain source availability with downloads.
Building from this archive: its layout expects this script and stockfish/ together;
set ANDROID_HOME then run ./build.sh. Output path is an app packaging convenience;
standalone binaries remain in build/<abi>/stockfish. No signing keys are needed to
replace the engine in a separately rebuilt/debug-installed application.

Engineering license review: Stockfish is treated as a separate independent
GPL-3.0 program, aggregated in the APK and communicating only by public UCI pipes.
No Stockfish code is linked into the application; its full Corresponding Source
is supplied. This does not grant permission to relicense the rest of AKSARA or
establish a legal opinion about every combined-work scenario. Revisit distribution
terms before any JNI/shared-memory integration or proprietary release.
