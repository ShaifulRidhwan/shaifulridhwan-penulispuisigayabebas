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
# Verified official Alpine ARM64 base + installed developer essentials.
# Docker runs only on GitHub runner (ARM64 QEMU/binfmt), never on Android.
base="https://dl-cdn.alpinelinux.org/alpine/v3.22/releases/aarch64"
file="alpine-minirootfs-$VERSION-aarch64.tar.gz"
curl --fail --location --retry 3 --connect-timeout 20 --max-time 240 "$base/$file" -o "$ASSETS/$file"
curl --fail --location --retry 3 --connect-timeout 20 --max-time 60 "$base/$file.sha256" -o "$ASSETS/$file.sha256"
(cd "$ASSETS" && sha256sum --check "$file.sha256")
tar -tzf "$ASSETS/$file" > "$RUNNER_TEMP/aksara-alpine-contents.txt"
grep -Eq 'bin/(sh|busybox)' "$RUNNER_TEMP/aksara-alpine-contents.txt"
grep -Fq 'sbin/apk' "$RUNNER_TEMP/aksara-alpine-contents.txt"
# Full ARM64 developer toolchain is staged in CI, never downloaded at phone startup.
# Android PRoot remains rootless; all package/runtime features require device QA.
BRAND="$ROOT/android-native/scripts/linux"
sh -n "$BRAND/aksara-fetch.sh" "$BRAND/90-aksara-intro.sh" "$BRAND/aksara-linux-smoke.sh" "$BRAND/aksara-linux-benchmark.sh"
python3 -m json.tool "$BRAND/fastfetch-wide.jsonc" >/dev/null
python3 -m json.tool "$BRAND/fastfetch-compact.jsonc" >/dev/null
image="$(docker import --platform linux/arm64 "$ASSETS/$file")"
test -n "$image"
container=""
cleanup_linux_bundle() {
  if [ -n "$container" ]; then docker rm -f "$container" >/dev/null 2>&1 || true; fi
  if [ -n "$image" ]; then docker image rm -f "$image" >/dev/null 2>&1 || true; fi
}
trap cleanup_linux_bundle EXIT
container="$(docker create --platform linux/arm64 "$image" /bin/sh -ec '
  printf "%s\n" \
    "https://dl-cdn.alpinelinux.org/alpine/v3.22/main" \
    "https://dl-cdn.alpinelinux.org/alpine/v3.22/community" > /etc/apk/repositories
  apk add --no-cache \
    bash zsh busybox coreutils findutils grep sed gawk tar gzip zip unzip less nano vim man-db \
    ca-certificates curl wget openssl bind-tools iproute2 netcat-openbsd \
    git openssh-client-default openssh-server \
    build-base binutils make cmake ninja pkgconf autoconf automake libtool \
    clang20 llvm20 lld20 \
    python3 py3-pip py3-virtualenv nodejs npm rust cargo go openjdk17-jdk \
    sqlite sqlite-dev jq cloc ripgrep file htop procps fastfetch gdb strace
  for cmd in sh apk bash zsh curl fastfetch git htop jq less nano ssh python3 rg vi wget \
    gcc g++ clang cmake make ninja node npm rustc cargo go java javac sqlite3 cloc; do
    command -v "$cmd" >/dev/null || { echo "Missing bundled command: $cmd" >&2; exit 1; }
  done
  mkdir -p /usr/local/bin /usr/share/aksara /etc/profile.d /tmp /workspace
  chmod 1777 /tmp
  mv /tmp/aksara-linux-benchmark.sh /usr/local/bin/aksara-linux-benchmark
  chmod 755 /usr/local/bin/aksara-linux-benchmark
  mv /tmp/aksara-linux-smoke.sh /usr/local/bin/aksara-linux-smoke
  chmod 755 /usr/local/bin/aksara-linux-smoke
  /usr/local/bin/aksara-linux-smoke --ci
  mv /tmp/aksara-fetch.sh /usr/local/bin/aksara-fetch
  chmod 755 /usr/local/bin/aksara-fetch
  mv /tmp/90-aksara-intro.sh /etc/profile.d/90-aksara-intro.sh
  chmod 644 /etc/profile.d/90-aksara-intro.sh
  mv /tmp/aksara-logo.txt /usr/share/aksara/aksara-logo.txt
  mv /tmp/fastfetch-wide.jsonc /usr/share/aksara/fastfetch-wide.jsonc
  mv /tmp/fastfetch-compact.jsonc /usr/share/aksara/fastfetch-compact.jsonc
  # Parse both real v3.22 ARM64 fastfetch configs, including logo mode.
  timeout 8 fastfetch --config /usr/share/aksara/fastfetch-wide.jsonc --pipe >/dev/null
  timeout 8 fastfetch --config /usr/share/aksara/fastfetch-compact.jsonc --pipe >/dev/null
  apk info -vv | sort > /etc/aksara-preinstalled-packages.txt
  printf "%s\n" "AKSARA Linux V3 Full Prebuilt Devkit / Alpine v3.22 / ARM64" > /etc/aksara-package-profile
')"
test -n "$container"
# Copy assets into the stopped ARM64 container before it runs package hooks;
# this ensures executable bits/config paths are in the exported rootfs.
for item in aksara-fetch.sh 90-aksara-intro.sh aksara-logo.txt fastfetch-wide.jsonc fastfetch-compact.jsonc aksara-linux-smoke.sh aksara-linux-benchmark.sh; do
  docker cp "$BRAND/$item" "$container:/tmp/$item"
done
docker start -a "$container"
# Flatten actual installed files, apk database, hooks and all dependencies.
docker export "$container" | gzip -9 > "$ASSETS/alpine-minirootfs.bundle"
test -s "$ASSETS/alpine-minirootfs.bundle"
rm -f "$ASSETS/$file" "$ASSETS/$file.sha256"
(cd "$ASSETS" && sha256sum alpine-minirootfs.bundle > alpine-minirootfs.sha256)
python3 - "$ASSETS/alpine-minirootfs.bundle" <<'AKSARA_ROOTFS_BOUNDS'
import sys, tarfile
from pathlib import Path
files, size, members = 0, 0, set()
with tarfile.open(sys.argv[1], "r:gz") as tar:
    for member in tar:
        files += 1
        size += member.size if member.isfile() else 0
        if files > 250000 or size > 4 * 1024 * 1024 * 1024:
            raise SystemExit(f"Android extraction bounds exceeded: {files=} {size=}")
        members.add(member.name.lstrip("./"))
required = {"bin/sh", "sbin/apk", "usr/bin/vim", "usr/bin/nano",
            "usr/bin/git", "usr/bin/python3", "usr/bin/htop", "usr/bin/fastfetch",
            "usr/local/bin/aksara-fetch", "etc/profile.d/90-aksara-intro.sh",
            "usr/share/aksara/fastfetch-wide.jsonc",
            "usr/share/aksara/fastfetch-compact.jsonc",
            "usr/share/aksara/aksara-logo.txt",
            "etc/aksara-preinstalled-packages.txt",
            "usr/bin/gcc", "usr/bin/g++", "usr/bin/clang",
            "usr/bin/node", "usr/bin/rustc", "usr/bin/cargo",
            "usr/bin/go", "usr/bin/java", "usr/bin/javac",
            "usr/bin/sqlite3", "usr/local/bin/aksara-linux-smoke",
            "usr/local/bin/aksara-linux-benchmark"}
missing = sorted(required.difference(members))
if missing: raise SystemExit(f"Bundled Linux files missing: {missing}")
# Installation progress reads the actual verified archive entry count.
manifest = Path(sys.argv[1]).with_name("alpine-minirootfs.entries")
manifest.write_text(str(files) + chr(10), encoding="ascii")
print(f"Alpine essentials verified: {files} entries, {size / 2**20:.1f} MiB")
AKSARA_ROOTFS_BOUNDS
echo "Pinned PRoot + Alpine ARM64 V3 FULL PREBUILT developer toolchain staged."
