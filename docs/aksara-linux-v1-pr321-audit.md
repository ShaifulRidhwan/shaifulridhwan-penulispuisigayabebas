# PR #321 — Initial source audit (2026-11-12)

## Verified
- PR open, draft, unmerged. Head: feature/aksara-neural-local-v1; base: rebuild/aksara-android-native-v1.
- Existing PR still includes Neural JNI, dashboard, model catalog and Neural-specific CI; its APK is not a Linux APK.
- MainActivity starts feature.chat.AksaraApp.
- feature/tools/NativeToolsContent.kt uses RuntimeClient and tests a sandboxed Android shell with printf AKSARA. It explicitly says Linux userland is not installed.
- Neural implementation lives under core/neural; other feature directories include chat, chess, library, splash, studio, today, tools and voice.

## Required implementation gates
1. Map slide-right navigation and remove Neural only after replacement compiles.
2. Implement real PTY and terminal emulator; Android ProcessBuilder alone is insufficient.
3. Build verified ARM64 userland bootstrap with compatible app-private executable prefix.
4. Provide a compatible package repository and prove installation of bash, python, git, openssh.
5. Implement process lifecycle, persistent home, keyboard/IME, tabs, and Android background restrictions.
6. Optional su only with user approval; verify effective UID; never silently elevate.
7. Remove obsolete Neural JNI, workflows and dependencies only after Linux replacement passes tests.
8. Build dedicated CI, smoke tests and owner APK; retain PR as draft until device validation.

## Status
This commit is a source audit only. No Linux runtime, package ecosystem, root integration, terminal UI, or Linux APK is yet implemented.