# V5.1 progress ledger

Baseline: `27156391fa3fa8636fbfc359f7b96078a0890fce`, Android development branch.
PR #290 and #291 merged; splash #292 open and excluded. One implementation branch:
`feat/aksara-absolute-intelligence-v5-1`. No production deployments authorized.

## Single audit

- P0/P1: reuse `bilik-antara.js`, Brain/Identity, Context Manager, Thinking V3/V4,
  quality/evidence/consistency/recovery V6, registry, capability policy, structured
  output, safe tools and research workflow. Android `WebBrainBridge` already uses
  this server pipeline; Cahaya/Gelap reach the server. No replacement engines.
- Workers AI text already uses allowlisted GLM through native binding or Netlify REST;
  Studio separately uses FLUX.1 Schnell / FLUX.2 Klein. Reuse both.
- P2/P4: existing NDJSON cancellation, no-replay JSON handling, attachment receipts,
  encrypted history/context/drafts, branching, import/export, bounded retrieval and
  summaries. Optional memory defaults OFF; fallback consent defaults false.
- P3: existing Aoede, shared generated Malay persona, epoch isolation, bounded
  reconnect, resumption, transcript handoff, focus and device routing. Preserve.
- P5/P6/P7: existing knowledge manifests, tools, grounding and Studio contracts.
  Runtime configuration and inference require separate live verification.
- Confirmed fixes: Workers AI router abort not propagated to REST; diagnostic token
  whitespace regex differed from credential validation; summary timeout treated as
  user cancellation; Android discarded provider HTTP/reason classification;
  Live peer-close lacked OkHttp close acknowledgement.
- Protected game, literary, splash, login and frozen runtime sources untouched.

## Gates

- Targeted backend regressions: pending.
- Android unit/build and focused emulator integration: pending; no local Android SDK.
- Live backend contracts/configuration: pending; no provider secrets configured locally.
- Commit/push/PR/merge/APK: pending; release remains gated on verified results.
- Physical Bluetooth, microphone/playback, device switching: requires physical phone.
