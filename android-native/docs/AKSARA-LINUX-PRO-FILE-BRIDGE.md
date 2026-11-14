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


---

## AKSARA LINUX · ADVANCED MODE (implemented on PR329, not yet owner-tested)

The existing `SYSTEM` bottom tab is renamed **ADVANCED**. This is a
developer/workstation feature set, *not* a privileged "Owner Mode", no second
kernel/runtime, and not an Android root switch. Existing terminal styling and
the full Alpine bundle are preserved.

### Android file movement: explicit two-way folder bridge

- **FILES:** choose one or multiple documents via system picker, stored under
  `/workspace/imports/batch-*` using existing atomic batch import.
- **FOLDER:** Android `OpenDocumentTree` asks you to choose an accessible
  directory; persist read/write URI grant in private app preferences.
- **PULL:** copy *top-level regular files* from selected Android folder into
  a new `/workspace/android-in/batch-*`; source Android files untouched.
  Subdirectories are currently skipped, not recursively imported.
- **PUSH:** copy *top-level regular files* from `/workspace/android-out` to
  *newly created* documents in the selected Android folder; never overwrite
  existing documents. Already-exported outbox files are retained. If batch
  fails, earlier successful exports remain and the failing partial item is
  deleted when supported by provider.
- **UNLINK:** revoke previously persisted Android directory permission and
  clear stored URI without deleting any files.

Direct cross-filesystem bind mounts, Android shell escalation, automatic
background synchronization, or unrestricted `/sdcard` access are intentionally
**not** included. The Android system picker may refuse storage roots, the
`Download` directory as a folder, and `Android/data` or `Android/obb` on
Android 11 and later; use **FILES** for individual downloads or create/select a
normal writable subdirectory when allowed.

### CLI workflow

```sh
aksara-capabilities
aksara-share help
aksara-share status
aksara-share inbox
ls -lah /workspace/android-in
aksara-share stage /workspace/poem.py
aksara-share outbox
# Then tap ADVANCED > PUSH in the Android UI
```

`aksara-share stage` accepts ordinary files from `/workspace`, rejects
symlinks, non-workspace paths, common secret filenames and oversized files.
Staging is **not** automatic export. User chooses destination and taps PUSH.

Transfer limits: up to 50 *regular files*, 256 MiB per file and 512 MiB
per transaction. No recursive copy and no overwrite. File Bridge already
imports 20 selected files per batch. Workspace is persisted inside app
sandbox, so separate signed preview package IDs do not automatically share it.

### Reliability / test gate

- Run Kotlin unit tests for filename collision avoidance, path traversal,
  secret and symlink exclusion.
- Android actual device: test folder grant/regrant/revoke, canceled picker,
  PULL from writable subdirectory, PILOT full MP3 + LRC + PY import, PUSH
  a text file, name conflict and read-only provider failures.
- Verify that changing tabs, process lifecycle, Enter, shell history, UI
  transparency, Chat and Today remain unchanged.
- Ensure Android package identity, signature, full rootfs archive (roughly
  740 MB class), native ARM64 PRoot and bundled source archive are verified.
- Do **not** merge based on green CI alone. Device validation required.

**Android sources:**
https://developer.android.com/training/data-storage/shared/documents-files
https://developer.android.com/reference/android/provider/DocumentsContract
