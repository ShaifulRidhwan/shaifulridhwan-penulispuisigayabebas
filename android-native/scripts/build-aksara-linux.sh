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
NDK="$ANDROID_HOME/ndk/27.2.12479018" \
  OUT="$RUNNER_TEMP/aksara-proot-build" \
  REPO_ARTIFACT_DIR="$RUNNER_TEMP/aksara-proot-dist" \
  bash "$PROOT_SRC/tools/build-static-aarch64.sh"
cp "$RUNNER_TEMP/aksara-proot-dist/proot" "$LIBS/libaksara_proot.so"
cp "$RUNNER_TEMP/aksara-proot-dist/loader" "$LIBS/libaksara_proot_loader.so"
readelf -h "$LIBS/libaksara_proot.so" | grep -F 'AArch64'
readelf -h "$LIBS/libaksara_proot_loader.so" | grep -F 'AArch64'
base="https://dl-cdn.alpinelinux.org/alpine/v3.22/releases/aarch64"
file="alpine-minirootfs-$VERSION-aarch64.tar.gz"
curl --fail --location --retry 3 --connect-timeout 20 --max-time 240 "$base/$file" -o "$ASSETS/$file"
curl --fail --location --retry 3 --connect-timeout 20 --max-time 60 "$base/$file.sha256" -o "$ASSETS/$file.sha256"
(cd "$ASSETS" && sha256sum --check "$file.sha256")
tar -tzf "$ASSETS/$file" > "$RUNNER_TEMP/aksara-alpine-contents.txt"
grep -Eq '(^|/)bin/sh$|(^|/)bin/busybox
mv "$ASSETS/$file" "$ASSETS/alpine-minirootfs.tar.gz"
mv "$ASSETS/$file.sha256" "$ASSETS/alpine-minirootfs.sha256"
echo "Pinned GPL PRoot and Alpine rootfs staged for ARM64 APK."
 "$RUNNER_TEMP/aksara-alpine-contents.txt"
grep -Eq '(^|/)sbin/apk
mv "$ASSETS/$file" "$ASSETS/alpine-minirootfs.tar.gz"
mv "$ASSETS/$file.sha256" "$ASSETS/alpine-minirootfs.sha256"
echo "Pinned GPL PRoot and Alpine rootfs staged for ARM64 APK."
 "$RUNNER_TEMP/aksara-alpine-contents.txt"
mv "$ASSETS/$file" "$ASSETS/alpine-minirootfs.tar.gz"
mv "$ASSETS/$file.sha256" "$ASSETS/alpine-minirootfs.sha256"
echo "Pinned GPL PRoot and Alpine rootfs staged for ARM64 APK."
