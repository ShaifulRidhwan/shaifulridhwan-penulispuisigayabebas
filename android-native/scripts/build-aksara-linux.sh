#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VERSION=3.22.8
PROOT_SHA=6f8ebfd8e24887dfba64c3f2d7d5fe9dc059b60e
PROOT_SRC="$RUNNER_TEMP/aksara-proot-static"
ASSETS="$ROOT/android-native/app/src/main/assets/linux"
LIBS="$ROOT/android-native/app/src/main/jniLibs/arm64-v8a"
mkdir -p "$ASSETS" "$LIBS"
git clone --filter=blob:none https://github.com/berilevi/proot-static.git "$PROOT_SRC"
git -C "$PROOT_SRC" fetch --depth=1 origin "$PROOT_SHA"
git -C "$PROOT_SRC" checkout --detach "$PROOT_SHA"
# Android ARM64 Bionic requires the executable's PT_TLS segment to have
# p_align >= 64. The upstream static PRoot otherwise has p_align=8 and
# aborts before main() with signal 6 on physical Android phones.
# Force a 64-byte-aligned TLS section into PRoot's main executable object.
# This patch is retained in the corresponding GPL source tarball.
cat >> "$PROOT_SRC/src/cli/proot.c" <<'AKSARA_TLS_EOF'

/* AKSARA Android ARM64: Bionic static executable TLS alignment anchor. */
__thread unsigned char aksara_bionic_tls_anchor[64]
    __attribute__((aligned(64), used));
AKSARA_TLS_EOF
NDK="$ANDROID_HOME/ndk/27.2.12479018" \
  OUT="$RUNNER_TEMP/aksara-proot-build" \
  REPO_ARTIFACT_DIR="$RUNNER_TEMP/aksara-proot-dist" \
  bash "$PROOT_SRC/tools/build-static-aarch64.sh"
cp "$RUNNER_TEMP/aksara-proot-dist/proot" "$LIBS/libaksara_proot.so"
cp "$RUNNER_TEMP/aksara-proot-dist/loader" "$LIBS/libaksara_proot_loader.so"
readelf -h "$LIBS/libaksara_proot.so" | grep -F AArch64
readelf -h "$LIBS/libaksara_proot_loader.so" | grep -F AArch64
# A compile-successful executable may still abort before PRoot starts.
# Fail the build if PT_TLS regresses to 8-byte alignment.
python3 - "$LIBS/libaksara_proot.so" <<'AKSARA_TLS_CHECK'
import subprocess
import sys
output = subprocess.check_output(["readelf", "-lW", sys.argv[1]], text=True)
segments = [line.split() for line in output.splitlines()
            if line.strip().startswith("TLS ")]
assert segments, "PRoot executable has no PT_TLS; review ARM64 runtime"
alignment = int(segments[0][-1], 0)
assert alignment >= 64, f"PRoot ARM64 PT_TLS alignment {alignment}, Bionic requires >=64"
print(f"Verified ARM64 executable PT_TLS p_align: {alignment} bytes")
AKSARA_TLS_CHECK
base="https://dl-cdn.alpinelinux.org/alpine/v3.22/releases/aarch64"
file="alpine-minirootfs-$VERSION-aarch64.tar.gz"
curl --fail --location --retry 3 --connect-timeout 20 --max-time 240 "$base/$file" -o "$ASSETS/$file"
curl --fail --location --retry 3 --connect-timeout 20 --max-time 60 "$base/$file.sha256" -o "$ASSETS/$file.sha256"
(cd "$ASSETS" && sha256sum --check "$file.sha256")
tar -tzf "$ASSETS/$file" > "$RUNNER_TEMP/aksara-alpine-contents.txt"
grep -Eq 'bin/(sh|busybox)' "$RUNNER_TEMP/aksara-alpine-contents.txt"
grep -Fq 'sbin/apk' "$RUNNER_TEMP/aksara-alpine-contents.txt"
# Android aapt has special handling for *.gz assets: it strips or
# transforms the .gz suffix. Preserve the literal gzip bytes under .bundle.
mv "$ASSETS/$file" "$ASSETS/alpine-minirootfs.bundle"
mv "$ASSETS/$file.sha256" "$ASSETS/alpine-minirootfs.sha256"
echo "Pinned GPL PRoot and Alpine rootfs staged for ARM64 APK."
