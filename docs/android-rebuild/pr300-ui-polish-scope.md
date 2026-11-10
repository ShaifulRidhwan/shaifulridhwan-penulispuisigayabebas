# PR #300 · AKSARA Android Native UI Polish

## Visual baseline (user screenshots, 10 Nov 2026)
- Shared Liquid Glass design tokens across Explore, Settings, Provider Health, Search & History, Thinking Mode and Attachments. Explore currently appears more opaque; remove excessive empty space, align blur, tint, border, radius, gutters and modal sizing.
- Make the "Siapa Aku" default prompt pill more transparent, without sacrificing contrast or changing behavior.
- Chess: keep current 3D board, pieces, Stockfish 19 and gameplay. Board dominant; replace the vertically scrolling, oversized bottom panel with compact HUD, expose history/diagnostics in an optional sheet.
- Cahaya vs Gelap: small aligned Light/Heavy/Jump/Special buttons, compact HUD, glass transparency, reliable multitouch, no gameplay regressions.
- Game settings: consistent modern dark glass, no large opaque blue panels.
- Preserve existing wallpaper, Novel/Perpustakaan, Puisi, voice, routing and backend.

## Engineering acceptance
- Inspect existing Compose/Phaser components and unify style through shared tokens, not one-off hard-coded opacity patches.
- Preserve tap targets and accessibility contrast; check portrait/landscape and phone sizes.
- Keep CI build/unit, game logic, web audit and backend smoke; emulator only manual, no redundant Chess builds for unrelated UI changes.
- Supply screenshots from real-device tests and one standalone APK after all required CI passes.
- No Play Store readiness or unrelated feature expansion.

Work in progress; do not merge until implementation and tests are complete.
