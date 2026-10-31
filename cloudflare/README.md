# AKSARA Cloudflare Apps Migration

**STATUS: PREVIEW. No production cutover.** Netlify keeps the main site, home, poems and all original published URLs.

Cloudflare Workers Static Assets hosts only Bilik Antara, Studio Antara and the Novel/Perpustakaan. The Worker adapts existing Netlify handlers while preserving streaming and the four-model 3+1 policy, with a SQLite-backed Durable Object for cross-instance budgets and leases.

## Build and preview

From the repository root:

```sh
npm ci
node cloudflare/build.mjs
npx wrangler@4.135.0 deploy --config cloudflare/wrangler.jsonc --dry-run
```

Use Cloudflare Dashboard → Workers & Pages → Create Worker → Import GitHub. Set config path to `cloudflare/wrangler.jsonc`, build command `node cloudflare/build.mjs`, deploy command `npx wrangler@4.135.0 deploy --config cloudflare/wrangler.jsonc`. For preview branches use `wrangler preview --config cloudflare/wrangler.jsonc` with a supported Wrangler version. This repository contains **no automatic production Cloudflare deployment workflow**.

## Dashboard variables versus Wrangler deployments

Cloudflare Workers Builds deploys `cloudflare/wrangler.jsonc` on every commit to the Cloudflare production branch. **By default, Wrangler removes Dashboard-only Text Variables not in config.** That can make the popup show Groq `Not active` and NVIDIA `Enable AKSARA_NVIDIA_ENABLED` after an otherwise successful redeploy.

The config now sets `keep_vars: true`, pins `GROQ_FREE_CONFIRMED=true`, leaves `AKSARA_NVIDIA_ENABLED` unset (disabled by default until authorised Dashboard opt-in), and retains `AKSARA_FREE_FALLBACKS=true`, and adds regression checks. Dashboard-managed `CLOUDFLARE_ACCOUNT_ID` and optional budgets are preserved. Do **not** commit API keys, tokens or salt in `vars`. Cloudflare secrets remain encrypted and persist across deployments.

If Gemini Text shows `503`, that is an **upstream inference failure or transient availability signal**, not proof the API key is wrong; Gemini Live can still work independently. Check current provider status after redeploy and examine redacted provider logs before changing models.

## Required secrets

Set privately on Cloudflare Worker, never GitHub or chat:

- `AKSARA_RATE_SALT`: random 32-byte+ secret used for one-day IP pseudonyms.
- `GEMINI_API_KEY`, `GROQ_API_KEY`, `NVIDIA_API_KEY`, `OPENROUTER_API_KEY`: enable only those you actually use.
- `GROQ_FREE_CONFIRMED=true` for Groq. `AKSARA_NVIDIA_ENABLED=true` is an explicit **Dashboard runtime variable** only when NVIDIA production entitlement has been confirmed; do not publish Developer Program trial inference to end users.
- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` for existing Workers AI REST image generation. OVH Beta remains optional.
- Optional `STUDIO_DAILY_NEURONS`, `AKSARA_CHAT_DAILY_REQUESTS`.

The Gemini Live ephemeral-token broker runs inside Cloudflare Worker, never exposing `GEMINI_API_KEY`. `AKSARA_SHARED_CHAT_BUDGET` stays false because it references Netlify Blobs. Instead, the Workers ingress uses `AKSARA_CONTROL` with an atomic Durable Object daily budget, per-IP limits and Studio leases.

## Gemini Flash-Lite and NVIDIA multi-model prototype

**LOCKED: Gemini 3.5 Flash-Lite for Cloudflare text.** Keep `gemini-3.5-flash-lite` in all three config keys: `GEMINI_MODEL`, `GEMINI_MODEL_FAST`, `GEMINI_MODEL_COMPLEX`. This lock is checked by `cloudflare/migration.test.mjs` and should not be changed without a documented A/B test and rollback path. Two real Cloudflare requests (ordinary and complex) were both answered by Gemini on 2026-10-31 (HTTP 200; no fallback), but that is not a long-term uptime guarantee. **There is no official text model named `gemini-3.6-flash-lite`.** Keep Netlify and Gemini Live settings unchanged.

NVIDIA catalog health has already confirmed the owner's API key and DeepSeek listing, **not successful inference**. The owner diagnostic at `/api/aksara-nvidia-test` now retrieves the current `GET /v1/models` list, filters candidate chat LLMs (excluding embeddings, rerankers, moderation, transcription, vision generation and utilities), and offers a dropdown for a selected model. Each inference validates the selected model against NVIDIA's live catalog. This supports more than DeepSeek, including compatible Nemotron, GLM and Mistral models if returned for this account.

A catalog entry means **Listed, not Connected**; a catalogue's Free Endpoint label means trial/prototyping access, **not unlimited free production inference**. The selection remains owner-only until the applicable production entitlement is confirmed. `AKSARA_NVIDIA_ENABLED` stays off on public Chat.

Catalog checks are rate-limited but do not consume the NVIDIA inference test budget. By explicit owner request on 2026-11-01 Malaysia time, the Durable Object now permits **8 owner-only NVIDIA inferens tests per UTC day, at most 4 per 10 minutes for the owner**. These are safety/budget caps, not an NVIDIA quota or billable production entitlement. Reset is 00:00 UTC (08:00 Malaysia). The protected test page requires `AKSARA_NVIDIA_TEST_TOKEN`, and its **auto** mode selects up to three currently listed chat candidates, attempts them one at a time with streamed visible-output detection, and stops after the first valid reply. Attempts are counted in the global Durable Object before reaching NVIDIA, including failures and timeouts. HTTP 401/402/403/429 stops automatic testing. Results contain only model ID, status, elapsed time and proof of streamed output, not API keys, conversation data or generated text. Public NVIDIA Chat remains **OFF** pending production-use permission. Listing 44 Chat candidates does not prove they can produce replies or that access is unlimited.

## Public NVIDIA NIM requires a production entitlement

**NVIDIA Build Developer/Trial API is not licensed to serve ordinary public visitors.** NVIDIA's product FAQ explicitly defines serving real end users as production, which needs NVIDIA AI Enterprise licensing or a separate production agreement. The trial API at `integrate.api.nvidia.com` remains available **only** to the protected, owner-only `/api/aksara-nvidia-test` evaluation workflow. Successful Nemotron 3.5 Bolt E4B inference on 2026-11-01 (960 ms, HTTP 200) proves technical connectivity, NOT public redistribution rights.

Production readiness is implemented behind all of the following independent conditions:

- `AKSARA_NVIDIA_ENABLED=true` (code-controlled public activation)
- `AKSARA_NVIDIA_PRODUCTION_AUTHORIZED=true` (owner must hold a valid production license or permission; this flag is a declaration, not proof)
- `NVIDIA_PRODUCTION_API_KEY` (Cloudflare **Secret**, separate from `NVIDIA_API_KEY` trial key)
- `NVIDIA_PRODUCTION_CHAT_URL` (the approved, licensed **HTTPS inference deployment** ending in `/chat/completions`; the trial host is explicitly refused).

The production router uses model `nvidia/nemotron-3.5-bolt-e4b` by default and automatically retains Gemini and Groq as primaries with OpenRouter as final fallback if this licensed route fails. The trial key is never used in public Chat. Do not turn both flags on until a genuine licensed deployment and permissions are verified; the default Cloudflare config pins both to `false`.

The hosted developer trial may log prompts and outputs. Do not route private/public visitor conversations to it. The separate inference endpoint must carry its own data handling, access and cost controls.

## Preview and cutover rules

Preview HTML includes `noindex,follow`, retains original Netlify canonical URLs, and links home to Netlify. Do not change the Netlify site's main navigation or redirects until functional live-provider, Studio quotas, Voice and browser tests are complete, and Cloudflare preview has been deployed.

- Preview root redirects to the existing Netlify home.
- Original Netlify pages remain untouched, including user localStorage/IndexedDB and their canonical SEO metadata.
- Session data is origin-scoped. A fresh Cloudflare URL will not automatically inherit old private conversations or reading position. Export/import must be explicitly designed before cutover.
- The public site and preview MUST NOT share a public client-side API key.
- Only use `wrangler deploy` when you intend to publish to Cloudflare's production Worker. Never infer deploy success from a GitHub PR.

## Test

```sh
node --test cloudflare/migration.test.mjs
node cloudflare/build.mjs
```

Cloudflare Worker's CPU limits and external provider quotas still apply. Cloudflare Workers AI through REST is initially retained for compatibility, not reimplemented with a different image model contract.
