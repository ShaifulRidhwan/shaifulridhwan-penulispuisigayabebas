# Bilik Antara render-performance pass — 2026-11-03

Base: `9e62e223ec847f2f781e08362a0b6568bd35b74a` (`main`). Separate from repository cleanup PR #211.

## Changes
1. Session restore now composes existing chat bubbles in a `DocumentFragment`, appending once after format/metadata, then performs the existing single queued scroll. Live messages still append immediately, and all message metadata, controls, local archives and scroll semantics are retained.
2. Multi A.I visual/status redraw is skipped while the browser tab is hidden. Existing fifteen-second refresh remains during visible use; status repaint resumes on `visibilitychange`. This does **not** change provider probing, routing or backend health verification.
3. Existing CSS glow for Multi A.I sparkle and Thinking brain remains, but breathing keyframes animate opacity and transforms rather than recalculating `drop-shadow()` filters each frame. `prefers-reduced-motion` still disables these animations.

## Validation
- Node test contracts for batching, tab visibility and no animation filter changes.
- Existing Bilik browser smoke, desktop/mobile visual check, memory persistence/restore, Voice and Code Engine regressions.
- Do not claim a measured FPS or LCP improvement without comparing the same device/browser/conditions.
- Verify after cherry-pick or rebase if PR #211 (asset cleanup) merges first.

No changes to Gemini quad-pool, Groq/OpenRouter/Workers AI router, Voice Live model, storage defaults, Code Engine execution, Studio or the Novel.
