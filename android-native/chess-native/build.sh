#!/usr/bin/env bash
set -euo pipefail
base="$(cd -- "$(dirname -- "$0")" && pwd)"
ndk="${ANDROID_NDK_HOME:-${ANDROID_HOME:?Set ANDROID_HOME}/ndk/27.2.12479018}"
export PATH="$ndk/toolchains/llvm/prebuilt/linux-x86_64/bin:$PATH"
work="$base/build"
mkdir -p "$work"
cp -r "$base/stockfish/scripts" "$work/"
net=nn-1a298aa575a0.nnue
if [ ! -f "$work/$net" ]; then
 curl -fL --retry 3 "https://tests.stockfishchess.org/api/nn/$net" -o "$work/$net"
fi
printf '%s  %s\n' 1a298aa575a085434d29027978dc36867fe9c5bcea9376654b7a8eba1e52dfc2 "$work/$net" | sha256sum --check
for abi in ${AKSARA_CHESS_ABIS:-arm64-v8a x86_64}; do
 case "$abi" in arm64-v8a) arch=armv8;; x86_64) arch=x86-64;; *) echo "Unsupported ABI: $abi" >&2; exit 1;; esac
 mkdir -p "$work/$abi" "$base/../app/src/main/jniLibs/$abi"
 cp -r "$base/stockfish/src/." "$work/$abi/"
 cp "$work/$net" "$work/$abi/$net"
 # Stockfish has official NDK support. Produce a PIE executable (not a JNI DSO),
 # packaged under lib*.so for PackageManager extraction to its executable directory.
 make -C "$work/$abi" -j2 build ARCH="$arch" COMP=ndk EXTRALDFLAGS='-Wl,-z,max-page-size=16384'
 llvm-strip "$work/$abi/stockfish"
 cp "$work/$abi/stockfish" "$base/../app/src/main/jniLibs/$abi/libstockfish.so"
 llvm-readelf -l "$base/../app/src/main/jniLibs/$abi/libstockfish.so" | awk '/INTERP|LOAD/'
 sha256sum "$base/../app/src/main/jniLibs/$abi/libstockfish.so"
done
# Corresponding Source includes the exact network, source and build instructions.
mkdir -p "$work/corresponding-source"
cp -r "$base/stockfish" "$work/corresponding-source/"
cp "$work/$net" "$work/corresponding-source/stockfish/src/$net"
cp "$base/build.sh" "$base/README.md" "$work/corresponding-source/"
tar -czf "$work/stockfish-19-corresponding-source.tar.gz" -C "$work/corresponding-source" .
