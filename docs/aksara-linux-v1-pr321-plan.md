# PR #321 — Aksara Linux V1 implementation contract

Status: planning / implementation pending. Do not merge before owner tests an APK on a physical Android device.

## Product decision
Replace the Aksara Neural slide-right experience entirely with **Aksara Linux**, a genuine Android-hosted Linux userland terminal. Do not keep a duplicate AI chat, model library, or Neural dashboard. Keep Bilik Antara, Aksara Today, Voice, Studio, and other existing app features unchanged.

## Technical requirements
- ARM64-first embedded native Linux userland (Termux-style), not a simulated command interpreter or a dependency on an externally installed Termux app.
- Audit Android application ID, private data directory, executable paths, packaging, native libraries, and package repository compatibility before selecting a bootstrap. Do not assume stock Termux packages work with a different prefix.
- Real interactive PTY and terminal emulator supporting ANSI/VT sequences, UTF-8, cursor navigation, alternate screen, resizing, copy/paste, and scrollback.
- Persisted home/workspace and recoverable multiple sessions; lifecycle handling and safe process termination.
- Package management backed by a verified, compatible package ecosystem; Python, Git, OpenSSH, and development tools as functional acceptance tests.
- Optional root via user-approved existing su provider only. Normal shell works on unrooted devices. Distinct verified USER/ROOT indicator. Never auto-execute privileged AI commands.
- No root exploit, root simulation marketed as real root, or bypass of Android security prompts.
- Clear error states for unsupported architecture, bootstrap failures, missing packages, low storage, and Android process restrictions.

## UI contract
- Right-swipe destination is Aksara Linux, with full-height terminal content and minimal chrome.
- Preserve Aksara dark theme, gold accents, Liquid Glass header/tabs/toolbar, and wallpaper identity.
- Terminal viewport prioritizes legibility over translucency.
- Multi-tab sessions; ESC, CTRL, ALT, TAB, arrow key bar; configurable monospace font, cursor, scrollback.
- Navigation gestures must not interfere with terminal programs or IME; avoid per-character UI recomposition and keyboard jumpiness.
- No redundant CPU/RAM cards or duplicated Advanced Settings.

## Acceptance gates
1. Audit existing PR #321 code and workflows before destructive changes.
2. Build bootstrap and verify shell, PTY, filesystem persistence, and exit codes.
3. Verify package installation and real Python/Git/SSH commands.
4. Verify optional root detection and user-granted root session; no root required for baseline.
5. Verify responsive terminal UI, keyboard, copy/paste, tabs, and gesture behavior.
6. CI green; publish installable ARM64 APK artifact.
7. Owner tests APK on real device; PR remains open/unmerged until explicit approval.

This document is a product/engineering contract, not evidence that the runtime or UI has been implemented.
