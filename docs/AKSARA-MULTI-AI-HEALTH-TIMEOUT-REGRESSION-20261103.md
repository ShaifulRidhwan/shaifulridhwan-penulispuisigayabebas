# Bilik Antara Multi A.I timeout regression (3 Nov 2026)

Mobile screenshot after PR #214: Gemini 1–4 all reported `Degraded` with `6501–6504 ms · Timeout`. Groq was `Connected`, OpenRouter `Ready`, Workers AI `Disabled`, so this was not a global outage.

## Verified regressions
1. PR #214 set the Gemini Netlify *health-only* inference deadline to 6500ms. All four slots consequently failed at that artificial budget, and the health exception incorrectly fed into `GeminiTextPool.failure`, which marks a slot `Degraded`. A failed synthetic health probe does **not** prove real chat failure.
2. Health time labels could render `Unknown` when the health timestamp was slightly ahead of the browser's clock, despite being otherwise valid.
3. On mobile, expanding all four Gemini slots could scroll the **entire** Multi AI modal, pushing the title and close control off screen.

## Changes
- Health-specific Gemini deadline: initial slot 14s, explicitly requested full four-slot refresh 18.5s; text chat and Voice Live timeouts unchanged. Cloudflare preview retains its 18.5s bound.
- Browser health transaction budget: 23s initial / 28s manual, to include Netlify cold-start and transport overhead.
- Classify synthetic probe timeout, 429, 5xx or network problems as `Ready` with sanitized reason, **not** a degraded chat route; hard 400/401/403/404 failure remains actionable. A genuine chat failure still uses the original pool logic.
- Clamp minor server/browser clock skew for display-only timestamps.
- In the Multi AI dialog only, fixed header and refresh button with scroll confined to provider list. Preserve glass and all other dialogs.
- Cache bust `bilik-antara.css?v=105` and `bilik-antara-multi-ai-status.js?v=3` for the active Netlify site.
- Regression tests cover clock skew, health-timeout routing isolation, mobile modal scrolling and cache revisions.

## Safety / availability
No new keys, forced provider switching, invented success states or changes to free-tier rate limits. Networked production probes cannot be validated with local mocked CI; check deployed status after build.
