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

# The older embedded Termux/PRoot fork has an Android 16 zygote seccomp
# regression: chdir(), fchdir() and getcwd() return ENOSYS inside Alpine.
# Import the maintained, device-tested SIGSYS translation implementation
# from the source tree in oonid/pr (a fork of Termux PRoot), pinned to a
# reviewed commit. Keep berilevi's reproducible static talloc/NDK toolchain.
# This source replacement is included in the GPL corresponding-source tarball.
ANDROID_PROOT_REV=7029b1fe8fa84d64339cabe38f9c5be2ea2ae7ac
ANDROID_PROOT_CHECKOUT="$RUNNER_TEMP/aksara-android-proot-seccomp"
git clone --depth=1 --filter=blob:none --no-checkout \
  https://github.com/oonid/pr.git "$ANDROID_PROOT_CHECKOUT"
git -C "$ANDROID_PROOT_CHECKOUT" fetch --depth=1 origin "$ANDROID_PROOT_REV"
git -C "$ANDROID_PROOT_CHECKOUT" sparse-checkout init --cone
git -C "$ANDROID_PROOT_CHECKOUT" sparse-checkout set src/proot/src
git -C "$ANDROID_PROOT_CHECKOUT" checkout --detach "$ANDROID_PROOT_REV"
test "$(git -C "$ANDROID_PROOT_CHECKOUT" rev-parse HEAD)" = "$ANDROID_PROOT_REV"
SOURCE="$ANDROID_PROOT_CHECKOUT/src/proot/src"
test -f "$SOURCE/tracee/seccomp.c"
test -f "$SOURCE/GNUmakefile"
grep -Fq 'case PR_fchdir:' "$SOURCE/tracee/seccomp.c"
grep -Fq 'case PR_getcwd:' "$SOURCE/tracee/seccomp.c"
grep -Fq 'case PR_chdir:' "$SOURCE/tracee/seccomp.c"
rm -rf "$PROOT_SRC/src"
cp -a "$SOURCE" "$PROOT_SRC/src"
# The replacement makefile must still produce 16KB-compatible Android ELF.
printf '\nLDFLAGS += -Wl,-z,max-page-size=16384\n' >> "$PROOT_SRC/src/GNUmakefile"
cat > "$PROOT_SRC/AKSARA-UPSTREAM-SOURCE.txt" <<'SOURCE_RECORD'
PRoot patched source: https://github.com/oonid/pr
Pinned revision: 7029b1fe8fa84d64339cabe38f9c5be2ea2ae7ac
Source subdirectory: src/proot/src
Build support: https://github.com/berilevi/proot-static
Pinned support revision: 6f8ebfd8e24887dfba64c3f2d7d5fe9dc059b60e
Rationale: Android 16 SIGSYS handling of chdir/fchdir/getcwd (ENOSYS).
Keep upstream GPLv2/other applicable license and notices when distributing.
SOURCE_RECORD
# Android API 21 Clang uses emulated TLS for C __thread and therefore does
# NOT create a real PT_TLS section. Android ARM64 Bionic requires real
# executable PT_TLS p_align >= 64, otherwise it aborts before main().
# Embed a tiny initialized ELF TLS section with an explicit 64-byte
# alignment. This is build-time assembly, not a runtime root workaround.
# The modified GPL source is shipped with the APK prerelease.
cat >> "$PROOT_SRC/src/cli/proot.c" <<'AKSARA_TLS_EOF'

/* AKSARA: real ELF TLS for ARM64 Bionic, including API 21 NDK builds. */
__asm__(
    ".section .tdata.aksara,\"awT\",@progbits\n"
    ".balign 64\n"
    ".globl aksara_bionic_tls_anchor\n"
    ".type aksara_bionic_tls_anchor, %object\n"
    "aksara_bionic_tls_anchor:\n"
    ".quad 1\n"
    ".size aksara_bionic_tls_anchor, 8\n"
    ".previous\n"
);
AKSARA_TLS_EOF
API=28 \
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
