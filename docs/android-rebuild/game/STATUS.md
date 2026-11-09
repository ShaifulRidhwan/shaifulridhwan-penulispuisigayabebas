# AKSARA — Cahaya vs Gelap (development build)

Playable Phaser 3.90 combat is bundled inside the existing Android application. Open Ciri & Fungsi → Game. Select character and difficulty. Touch controls support simultaneous direction and attacks; keyboard arrows and Z/X/C are available for desktop verification. S has a five-second cooldown. Backgrounding pauses gameplay; recreation safely returns to home. No game network service is required.

## Asset limitation

The visible procedural figures are temporary development art, **not final character sprites**. No character atlas, extraction or curation has been completed. sprite-gen 4.3.0 installed successfully through `npx skills add https://github.com/aldegad/sprite-gen --skill sprite-gen`; an editable Python 3.12 environment is at `/tmp/aksara-tools/sprite-gen/.venv`. README, SKILL.md, gen and user-workflow documentation were read. `sprite-gen --help` works. Its read-only workflow reports Codex login ready, entitlement/quota unknown, Grok credentials unavailable. Actual Codex generation failed with HTTP 401: token could not be refreshed after logout/account change. No paid API keys were used. Reauthentication is required to resume this pipeline. The full V1 asset specification is incomplete.

## Validation

`node --test android-native/game-tests/combat.test.cjs`: 7 tests pass, covering movement/jump/landing, misses, active-frame damage/knockback, cooldown, death/result freezing, three AI difficulties and timeout.

Playwright Chromium: renderer, keyboard movement, touch event smoke, collision through victory, restart and pause/resume pass without JavaScript errors. Victory screenshot is in `android-native/game-tests/victory.png`. This uses a low-health fixture to reach victory; AI fights to completion are independently covered in combat tests. This is not Android emulator evidence or a multitouch correctness test.

Voice brain source contract check passes. Existing Chat/Voice/Studio source code is preserved except for adding the game portal route. Android regression, instrumentation, performance and final-art identity checks remain required. Cloud executor has no `/dev/kvm`; no emulator pass is claimed. Do not merge this development PR until required validation and final assets are complete.

Phaser license is bundled alongside the runtime. Runtime SHA256: e92ddef111ba42e92d316979c732311757093688ea1810591cb7aa2858eba7a7.
