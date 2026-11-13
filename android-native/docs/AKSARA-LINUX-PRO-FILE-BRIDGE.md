# AKSARA Linux Pro · Runtime capability audit and File Bridge V1

Base: `rebuild/aksara-android-native-v1`. Target: existing ARM64 Alpine 3.22.8 / PRoot / Termux PTY, **no second runtime**, no root privileges.

## Verified by source inspection (not phone acceptance)

- **Already present in code:** Alpine offline ARM64 rootfs, GCC/G++, Clang, Rust/Cargo, Go, Node/npm, Python/pip/venv, JDK, CMake/Ninja, Git/SSH, SQLite and general utilities. The bundle itself must still be verified by Android owner build and real device.
- **Already present:** six max independent PTY slots, first-use `SETUJU`, persistent font setting, Obsidian gold/crimson terminal identity, doctor command, Python local server shortcut, Git/SSH commands, ZIP Project Vault, Linux performance benchmark and rootless guardrails.
- **Gap reproduced on device (13 Nov 2026):** `/sdcard/Download` and `/storage/emulated/0/Download` unavailable inside guest. PRoot binds host app-private `linux-workspace` to guest `/workspace`. Direct Download visibility was never configured.
- **New File Bridge:** user taps SYSTEM > FILES, Android system document picker returns one or more selected documents, Android ContentResolver streams them into a bounded private staging directory, then commits the complete batch under `/workspace/imports/batch-xxxxxxxx`. Existing files are never overwritten. Python, MP3, LRC, ZIP and arbitrary other user-selected files can be imported (not auto-run or auto-extracted). No `MANAGE_EXTERNAL_STORAGE` permission or system root.
- **New inspector:** `aksara-capabilities` is a read-only guest command, installed idempotently for compatible existing rootfs, plus CAPS and IMPORTS shortcuts in the existing deck. It distinguishes tool presence from full execution validation.

## Feature inventory and honest status

| Capability | Status | Notes |
|---|---|---|
| Linux native ARM64 userland | Bundled; device tested before | PRoot, not Android kernel replacement |
| Package manager `apk` | Present | Owner-controlled installs; signed Alpine sources |
| Python 3, pip, venv | Present | Device Python test passed; validate venv separately |
| GCC, G++, Clang, CMake, Ninja | Bundled | Benchmark/smoke tests available |
| Rust/Cargo, Go, Node/npm | Bundled | Compilers may be slow or memory-hungry on phone |
| Java/Javac | Bundled | Verify on actual APK |
| Git and SSH client | Present | No automatic key access or GitHub credential export |
| SQLite and CLI utilities | Present | Local databases usable |
| Multi-session PTY | Present | In-process only, Android may kill app |
| Long-running localhost development server | Present shortcut | User explicitly starts; check port availability |
| `aksara-doctor` | Present | Read-only inventory/health |
| `aksara-capabilities` | **Added** | Read-only feature inspector |
| Android -> Alpine single/multiple file import | **Added** | SAF; batch-staged; `/workspace/imports` |
| Workspace ZIP backup/restore | Present | Existing bounded SAF Vault; not raw device storage |
| Raw `/sdcard` mount | **Not provided** | Avoid broad permission/bind; bridge is explicit |
| Linux file browser UI | Not provided | Native picker only for Android source selection |
| Single-file export to Android | Not provided | Use existing ZIP Vault until separately designed |
| FFmpeg/media toolchain | Optional | `aksara-capabilities` reports if installed |
| tmux/screen | Optional | APK package or `apk add`; not automatically installed |
| Host root / privileged mount / Docker daemon | **Unavailable** | PRoot rootless and Android sandbox restrictions |
| Play Store-ready Android target 35/36 PRoot exec | **Unsolved** | Owner preview uses sideload-only targetSdk 28 |
| Full Linux desktop GUI | Not provided | No X/Wayland desktop display bridge |

## File Bridge security and behavior

1. Android OpenMultipleDocuments via `"*/*"`; only `content://` selections.
2. Up to 20 selected files, 256 MiB per file, 512 MiB per batch; 64 KiB streamed buffer. Reject oversize rather than trusting the provider-reported size.
3. Strip paths and control characters from filenames, preserve common extensions, resolve duplicate names without overwrite.
4. Stage under app-private `filesDir`. If any file fails, remove whole stage. On success rename complete stage under `/workspace/imports/batch-xxxxxxxx`.
5. Never generate a shell command using a selected filename. Imported code is not executed automatically.
6. Existing Alpine rootfs and workspace are preserved; no migration, reinstall, bypass of Android scoped storage or root request.
7. APK previews have separate app IDs/filesDir, so **new preview APK does not inherit files from another preview**. Export Vault ZIP before changing app IDs/uninstalling.

## Owner QA gate: keep PR unmerged

- Open Linux > SYSTEM > FILES; select `about_you_v2.py`, `about_you_120s.lrc`, `About_You_00-02.mp3` together.
- Confirm success shows `/workspace/imports/batch-xxxxxxxx`, then in terminal: `ls -la /workspace/imports`, `cd /workspace/imports/batch-xxxxxxxx`, `ls -lh`, `python3 about_you_v2.py --start 44 --countdown 0`.
- Import two identically named files, confirm one is renamed `-1`, no overwritten data.
- Cancel picker, import a failed document provider, and try a >256 MiB file. Existing batches should be untouched and status truthful.
- Open SYSTEM > CAPS; verify command output; reopen terminal, switch sessions, lock/unlock phone, confirm Linux PTY and UI stable.
- Verify ZIP BACKUP, ZIP restore, LOCALHOST and other Android pages still function.
- Build with project's **existing** owner Full Linux workflow. Green CI is not device acceptance, and **no merge** until owner approves.

Android documentation: https://developer.android.com/guide/topics/providers/document-provider and https://developer.android.com/training/data-storage/shared/documents-files
