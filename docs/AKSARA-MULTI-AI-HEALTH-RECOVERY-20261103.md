# Bilik Antara Multi A.I health recovery | 2026-11-03

A mobile screenshot showed all four providers as `Unverified`, `0/4 Connected` and `Health check failed`.

## Code causes addressed
- Browser's original 12.5s health timeout nearly matched a 12s Gemini Netlify health probe. Netlify health probes now have a 6.5s per-probe bound; **normal AI chat and Voice Live paths are unchanged**.
- Health fetch previously swallowed HTTP status, 429 retry-after and transport aborts. The modal now shows sanitized `HTTP 429`, `HTTP 503`, `HTTP 404`, `Timeout` or `Network error`.
- A failed call formerly left `multiLastCheck` unchanged, so opening the status repeatedly could send redundant provider probes. Transient failure now gets at most **one** delayed, visible-tab automatic retry after 30s.
- Backend `STATUS_RATE_LIMIT` 429 is respected: the frontend disables Refresh until the returned retry interval elapses. It does **not** attempt to bypass rate limits.
- Updated versioned `bilik-antara-multi-ai-status.js?v=2` so stale browser cache doesn't load previous behavior.
- Active provider health and chat-request activity remain separate. An unsuccessful health transaction never proves that all four providers are offline.

## Validation
Node status regression, Gemini slots, isolated 429 contract and Chromium phone/desktop browser suites should pass before merge. Live Netlify POST was inaccessible from the automated external probe environment, so production post-deploy verification still depends on Netlify and the UI.

## Scope
No changes to environment keys, actual fallback routing, AI model selection, voice streaming, memory/session settings or Code Engine.
