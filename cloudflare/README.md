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

## Required secrets

Set privately on Cloudflare Worker, never GitHub or chat:

- `AKSARA_RATE_SALT`: random 32-byte+ secret used for one-day IP pseudonyms.
- `GEMINI_API_KEY`, `GROQ_API_KEY`, `ORCAROUTER_API_KEY`, `OPENROUTER_API_KEY`: enable only those you actually use.
- `GROQ_FREE_CONFIRMED=true`, `AKSARA_ORCAROUTER_LAYER2=true` for the respective primaries.
- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` for existing Workers AI REST image generation. OVH Beta remains optional.
- Optional `STUDIO_DAILY_NEURONS`, `AKSARA_CHAT_DAILY_REQUESTS`.

The Gemini Live ephemeral-token broker runs inside Cloudflare Worker, never exposing `GEMINI_API_KEY`. `AKSARA_SHARED_CHAT_BUDGET` stays false because it references Netlify Blobs. Instead, the Workers ingress uses `AKSARA_CONTROL` with an atomic Durable Object daily budget, per-IP limits and Studio leases.

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
