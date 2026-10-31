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

The Cloudflare-only text experiment currently uses `gemini-3.5-flash-lite` in `GEMINI_MODEL`, `GEMINI_MODEL_FAST` and `GEMINI_MODEL_COMPLEX`. **There is no official text model named `gemini-3.6-flash-lite`**. Keep Netlify and Gemini Live settings unchanged; run real text responses before declaring stable uptime.

NVIDIA catalog health has already confirmed the owner's API key and DeepSeek listing, **not successful inference**. The owner diagnostic at `/api/aksara-nvidia-test` now retrieves the current `GET /v1/models` list, filters candidate chat LLMs (excluding embeddings, rerankers, moderation, transcription, vision generation and utilities), and offers a dropdown for a selected model. Each inference validates the selected model against NVIDIA's live catalog. This supports more than DeepSeek, including compatible Nemotron, GLM and Mistral models if returned for this account.

A catalog entry means **Listed, not Connected**; a catalogue's Free Endpoint label means trial/prototyping access, **not unlimited free production inference**. The selection remains owner-only until the applicable production entitlement is confirmed. `AKSARA_NVIDIA_ENABLED` stays off on public Chat.

Catalog checks are rate-limited but don't consume inference quota. The Durable Object grants at most **two NVIDIA owner inference tests per UTC day**. `RATE_LIMIT` with `Had dua ujian NVIDIA sehari tercapai` comes from *AKSARA's own control*, not NVIDIA billing; counters reset at 00:00 UTC (08:00 Malaysia). Do not lift this ceiling just to bypass a timeout. On model timeouts, use a different candidate on the next day's approved trial budget instead of retrying the same stalled model.

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
