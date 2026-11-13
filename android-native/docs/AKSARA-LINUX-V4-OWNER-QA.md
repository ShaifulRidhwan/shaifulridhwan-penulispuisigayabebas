# AKSARA Linux V4 · Safe owner QA and Android modernization

This PR is a clean continuation of merged Linux V3 PR #323. It does NOT include
either Nexus V1 or Nexus V2. Owner APKs should not be merged before phone QA.

## Scope implemented

1. **First-time consent:** bundled Alpine ARM64, type SETUJU in the EXISTING
   Termux PTY (BATAL refuses); actual Android rootfs extraction logs stream
   inside the terminal. No duplicated shell renderer or UI install button.
   Already verified rootfs starts directly. The previous revision is NEVER
   silently deleted just because a marker changes.
2. **Gold/Crimson terminal:** JetBrains Mono NL 2.242 (OFL-1.1, license
   included), permanent #080B12 background and shell OSC ANSI palette; 15sp
   baseline with persistent pinch-to-zoom. No A-/A+ or numeric size labels.
3. **Session continuity:** one Termux PTY per independent tab, bounded to six;
   no recreation from Compose re-renders; explicit exit code/signal, targeted
   restart, no false promise about session resurrection after process death.
4. **Project Vault:** user-chosen SAF ZIP export/import from /workspace; safe
   subfolder restore, bounded file counts/bytes, no overwrite, skip common SSH,
   cloud and environment secrets; include package world manifest as documentation,
   never reinstall packages automatically. The app does not request general
   storage access.
5. **Local Dev Server:** USER triggers "SERVER" terminal shortcut to run
   python3 -m http.server 8000 --bind 127.0.0.1, then opens LOCALHOST from
   existing SYSTEM deck. Never bind externally or auto-start services.
6. **Git/SSH Workstation:** git, SSH and compiler tools are present from V3;
   GIT deck adds branch/log/remotes and manual SSH verification. No credentials,
   access tokens or private SSH keys are automatically uploaded.
7. **Linux Environment Doctor:** user types aksara-doctor or taps DOCTOR.
   It performs read-only local checks for tools, filesystem and process state.

## Modern Android target-SDK research (critical limitation)

As of 2026-08-31 Google Play requires Android 16 / API 36 for new apps
and updates. The V3 Linux owner's APK still targets API 28 while the
standard non-Linux app targets 35. This is **NOT** Play Store ready.

Android 10 and later restrict execution of mutable files in application
data for apps targeting SDK 29+. A full guest Alpine rootfs stores ELF
executables in the app data directory. Simply setting targetSdk 36 may
cause Python, gcc, apk and /bin/sh execution to fail.

- The property -PenableLinuxModernProbe=true activates compile/target SDK 36
  **only** with -PenableLinuxPreview=true.
- Default owner Linux APK continues to use SDK 28; the probe must be built and
  tested independently and never published as a supported build.
- A real solution requires a separate PRoot/guest ELF execution strategy
  validated under target SDK 36, with Android SELinux and Play policy review.
  W^X protection must not be disabled by rooting or making SELinux permissive.
- No Play Store or SDK36 compatibility claim before device tests pass.

References:
- https://developer.android.com/about/versions/10/behavior-changes-10#execute-permission
- https://github.com/termux/termux-packages/wiki/Termux-execution-environment
- https://support.google.com/googleplay/android-developer/answer/11926878

## Device acceptance matrix

- **Fresh install**: open Linux → SETUJU prompt; Enter without SETUJU does
  nothing; BATAL leaves install untouched; SETUJU streams real progress,
  checksum and readiness, then real Alpine shell.
- **Interruption**: force-stop during extraction, reopen and SETUJU again.
  Staging must clean itself; never show READY on corrupt extraction.
- **Upgrade**: preserve /workspace, /root/.ssh, packages, histories,
  toolchains and scripts on a compatible rootfs. Incompatible installed rootfs
  must refuse replacement and require explicit migration, not delete data.
- **Visual**: Gold/Crimson/ivory ANSI output, correct JetBrains Mono NL,
  no font icons; pinch zoom persists after application recreation.
- **Session**: Python REPL in tab 1, localhost server in tab 2,
  move Chat↔Today↔Linux, lock screen and return, stop tab 2 and confirm
  tab 1 is untouched; exit code/signal displayed correctly.
- **Vault**: export into SAF chosen document; restore into a NEW isolated
  /workspace/vault-import-* folder, validate files; malicious ../ ZIP
  must fail; .ssh and .env must not export; no overwrite.
- **Server**: open http://127.0.0.1:8000 in external browser. Stop with
  Ctrl+C. Confirm no LAN exposure.
- **Git/SSH**: git init/commit/log/branch, clone, SSH key permission 0700,
  user-controlled known_hosts; never log or back up private keys.
- **Doctor**: aksara-doctor prints only local read-only findings.
- **SDK36 probe**: separate owner-only experiment on real Android 16 device;
  record real ELF exec failures and policy status. Mark unsupported until fixed.

**DO NOT MERGE** until stable APK, unit test, integrity/ABI gate and phone QA.
