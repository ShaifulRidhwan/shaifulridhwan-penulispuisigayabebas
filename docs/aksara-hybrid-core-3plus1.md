# AKSARA Hybrid Core 3+1

**Gemini, Groq and OrcaRouter** are the primary text providers. **OpenRouter/free** is the universal final text fallback. No automatic paid model routing. Gemini Live and Studio have separate endpoints and budgets.

## Decision policy

- Ordinary text: use task, capability, warm-process response health and latency to rank Groq and OrcaRouter. If they fail, try Gemini, then OpenRouter.
- High-effort technical/critique/hypothetical tasks and requests needing Gemini tools or media: Gemini first. If eligible, continue to the free text primary pool, then OpenRouter last.
- Keep CAHAYA/GELAP, streaming, original context-consent, private session notes boundaries, and existing safety constraints unchanged. Never stitch another model into an interrupted visible stream.
- AKSARA_HYBRID_ROUTER=false restores original provider ordering (default: ON). Benchmarks are evidence only when run against real models, not mock replies.

## Traffic and budget

- Netlify native function rateLimit: Chat streaming 60 requests per IP+domain/60s; Voice Live token 30 requests per IP+domain/60s. Chat JSON fallback retains local 12/min and optional shared budget. Existing per-instance Chat 12/min and Voice session controls stay in place.
- Native platform enforcement is not instantaneous; Netlify's documented enforcement delay may reach ten seconds. Confirm the rules in the post-processing deploy log. These two rules use the Free plan's two code-rule allocation.
- Studio already has its own distributed daily budget and is unchanged.
- **Optional** global shared Chat budget using Netlify Blobs strong reads and ETag conditional writes: set AKSARA_SHARED_CHAT_BUDGET=true to activate. Set AKSARA_CHAT_DAILY_REQUESTS to a suitable cap, default 800 (UTC daily reset = 08:00 MYT). Disabled by default pending live storage verification. Storage failure fails closed to preserve API credits. Avoid enabling on Deploy Preview without isolating the site-wide store.
- The shared counter records only a single daily request count; it does not retain prompts, IP addresses or conversation history. It is not a transactional ledger for billing.

## Verification

1. `npm run test:aksara-platform`
2. `node --test tests/aksara-hybrid-core.test.cjs tests/aksara-three-main.test.cjs tests/aksara-benchmark.test.cjs`
3. `npm run benchmark:aksara` offline only. Actual A/B benchmark `npm run benchmark:aksara:live` requires OrcaRouter and OpenRouter secrets in a secure environment, six requests per provider.
4. Verify Chat streaming, Gemini-required tools, GELAP/CAHAYA, fallback only at end, privacy consent, Voice Live tokens, Studio quota and Netlify rule deployment before production activation.

No secret keys or user conversations belong in GitHub history.
