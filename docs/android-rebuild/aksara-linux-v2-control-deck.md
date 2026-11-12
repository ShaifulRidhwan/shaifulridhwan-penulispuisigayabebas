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

## Follow-up polish · Four-point owner feedback
1. **Alpine PS1 identity:** a tiny interactive-only `/etc/profile.d/99-aksara-prompt.sh`
   shows `aksara:<cwd> ❯`. Installed idempotently for existing V1 rootfs on the next
   new Linux session; never overwrites an existing profile. Opt out with
   `AKSARA_PROMPT_OFF=1` before starting a new login shell, or override
   `PS1` in `~/.profile`. Nothing is printed by non-interactive shells.
2. **Status readability:** one lightweight glass strip containing three equal-width,
   two-line Runtime / Sessions / Storage facts, with larger values.
3. **Commands UX:** explicitly selected Files / System / Dev groups, known Aksara icons,
   and one-tap read-only allowlisted commands. Developer group is Alpine-only.
4. **Restart regression:** a finished process gets a new real PTY in the *same* tab
   with the *same* label; live sessions are not restartable. Repeated taps are guarded.
   Kotlin pure-unit tests cover restart planning, group selection and shell profile.
   A real process-restart/IME/interactive-TUI acceptance test still needs the owner's phone.

**Release QA:** On a device with Alpine already installed, close Linux and reopen, then
create a fresh Linux session. Verify prompt, move with `cd` and check PS1 path updates.
Type `exit`, tap Restart, type `pwd` and `echo AKSARA-RESTART-OK`. Open multiple tabs,
close a preceding tab, and confirm the active PTY remains selected.

No kernel/root elevation, file deletion, background package installs, privileged
commands or extra app permissions were added.


## AKSARA System Identity · Fastfetch V2

- Maintained Alpine v3.22 ARM64 **Fastfetch** binary is actually installed during
  rootfs assembly, including its apk dependencies. Manual use: "fastfetch".
- Original dual-gold/cobalt AKSARA ASCII emblem plus an **adaptive compact/wide**
  startup dashboard: Alpine userland, Android host kernel/CPU/RAM, packages,
  shell, and host uptime are queried live. Host kernel is not called Alpine.
- Startup is **once per interactive PTY session**, never noninteractive jobs or
  nested login shells. No animation loops, background polling or network calls.
  If Fastfetch fails or times out (4 seconds), the terminal still opens.
- Controls: "aksara-fetch", "aksara-fetch --compact", "aksara-fetch --wide",
  "aksara-fetch --off" (persists), "aksara-fetch --on". Shell profile
  overrides remain the user's choice.
- CI tests the real **Fastfetch 2.44 config parser** inside Alpine ARM64,
  validates shell syntax, checks archive contents and enforces extractor bounds.

### Owner acceptance (before merge)

1. Install Alpine in a new preview APK; first PTY shows the AKSARA emblem and
   the ordinary "aksara:/workspace ❯" prompt after the dashboard.
2. Open another tab, then exit and restart a tab: intro appears exactly once
   for each new PTY, not on tab selection or every command.
3. Run "aksara-fetch --wide" and "aksara-fetch --compact" in landscape and
   portrait; info stays readable and live input is never blocked.
4. Run "aksara-fetch --off", then exit and restart; intro stays hidden but the
   normal prompt remains. Run "aksara-fetch --on" to restore.
5. Verify Fastfetch, Vim and Python versions; reopen the existing /workspace
   test file and test interactive Vim.

PR #322 remains Draft and unmerged until owner phone testing.
