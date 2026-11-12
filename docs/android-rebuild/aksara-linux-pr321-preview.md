# Aksara Linux PR321 - ARM64 preview

This experimental APK is not the release Android app. It replaces the right-swipe Aksara Neural dashboard with a TerminalView/TerminalSession interactive PTY. The native terminal libraries are from Termux v0.118.0, imported through JitPack; the terminal does not depend on a separately installed Termux application.

## Build and provenance
- Alpine: official Alpine 3.22.8 **aarch64 minirootfs**, fetched from dl-cdn.alpinelinux.org and SHA-256 checked against the official checksum file in CI. Archive and checksum are packaged into the preview APK assets.
- PRoot: GPLv2 fork source at https://github.com/berilevi/proot-static commit `6f8ebfd8e24887dfba64c3f2d7d5fe9dc059b60e`. The workflow builds static AArch64 proot + loader and bundles them in the APK native library directory. The corresponding PRoot source archive is attached to the APK GitHub prerelease.
- License reminder: comply with all Termux, Alpine packages and PRoot upstream licenses before public distribution.

## Critical compatibility note
Only the experimental owner APK built with `-PenableLinuxPreview=true` targets SDK 28 so Alpine executables can run from application-private writable storage on Android. Standard Aksara builds remain target SDK **35**. Do NOT merge the lower SDK configuration into production or describe this preview as Play-Store compliant. Android background process restrictions, SELinux, and OEM behavior may still prevent PRoot from functioning on physical phones.

## Owner verification
Install the SHA-scoped preview APK. Open right-swipe Linux, tap "Pasang Alpine Linux", then test:
```
uname -m
cat /etc/alpine-release
id -u
pwd
apk update
apk add python3 git openssh-client
python3 --version
git --version
ssh -V
cd /workspace
touch persistent.txt
```
Try interactive `vi`, CTRL/ALT/ESC/arrows, tabs, copy/paste, keyboard show/hide, return to chat and back, and app relaunch. Record actual results and check existing Chat/Today/Studio/Voice/Chess. PRoot's `-0` is **fake root inside Alpine**, never Android system root. No `su` functionality is included.

Never merge PR321 until actual on-device Alpine shell, package manager, terminal interactions, performance, and app regression checks pass.
