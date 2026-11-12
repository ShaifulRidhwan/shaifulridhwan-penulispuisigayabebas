# AKSARA Linux V2 · Control Deck

Base: `rebuild/aksara-android-native-v1`, after merged PR #321.
Feature branch: `feature/aksara-linux-control-deck-v2`.

## Delivered
- Branded Liquid Glass Linux Control Deck, preserving the Aksara wallpaper and fonts.
- Authentic Termux emulator and PTY stay opaque, legible and full-height; no terminal-webview replacement.
- Status strip reports actual installed Alpine/Android shell state and real ViewModel session count.
- Lightweight pulsing LIVE indicator; no filesystem polling or repeated PTY spawning on Compose recompositions.
- Session selection fix when closing tabs left of the current tab.
- Restart failed process in the same tab, preserving its label and location.
- Monotonic session labels prevent confusing duplicates after multiple closes.
- Ctrl/Alt modifiers cleared on session change and restart.
- Three focused input modes: KEYBOARD with PageUp/PageDown/Delete, COMMANDS, and SYSTEM.
- Command palette sends only constant, read-only, allowlisted commands on an explicit tap.
- Linux-only shortcuts are withheld in Android-shell mode; no root, su or privileged actions.
- Alpine/PRoot stack unchanged and build isolated from production Android targetSdk 35.

## Owner test checklist (physical Android 16, ARM64)
1. Open Linux: verify wallpaper, glass, contrast, keyboard access, and runtime label.
2. Open three tabs; select the last and close the first. The last PTY should stay selected.
3. Run `exit`, tap restart, and ensure the same tab name and position are preserved.
4. Test Ctrl+C, Alt shortcuts, Enter, Tab completion, arrows, PageUp/PageDown, text paste.
5. Test COMMANDS with `PWD`, `FILES`, `DISK`, `KERNEL`, `GIT`, `PYTHON`.
6. Test interactive Linux apps (`vi`, `top` where installed), copy/selection and Android keyboard.
7. Toggle between deck modes with the keyboard open; check viewport and scrollback.
8. Check Alpine `apk update`, package install, `cd /workspace`, Python `os.fchdir()`,
   `git init` and commits. PRoot Android 16 syscall translation must remain intact.
9. Reopen the screen and restart the APK. Stored files should persist in app-private storage;
   **running sessions are not promised across application process death**.
10. Regress Chat, Voice, Studio, Settings and Today, especially back navigation.

## Builds
- Owner Linux preview remains experimental sideload-only using targetSdk 28, for executing
  binaries installed into app-private storage. Production Android remains targetSdk 35.
- A single workflow-path push produces a new V2 APK; source commits do not burn CI quota.
- Workflow is also manually dispatchable after modifying the workflow itself.
- Physical testing and owner approval are required before merge.
