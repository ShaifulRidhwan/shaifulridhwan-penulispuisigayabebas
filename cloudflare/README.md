# AKSARA Cloudflare Workers migration

**Status: preview only. No production cutover or automatic deployment on merge.** The Netlify home, poems, existing production API and original novel URLs are unchanged. A separate Worker with Static Assets serves Bilik Antara, Studio and Perpustakaan/Novel only.

## Architecture: three primaries, one backup
1. Google Gemini: text, context tools, media and Gemini Voice Live, subject to actual quota.
2. Groq: GPT-OSS text service; requires `GROQ_API_KEY` and `GROQ_FREE_CONFIRMED=true`.
3. Cloudflare Workers AI: native `AI` binding at the Worker (not a browser key), model `@cf/zai-org/glm-4.7-flash`. It receives the same complete AKSARA identity and mode instructions, bounded history and task context as other models. It is text-only and can stream. Both CAHAYA and GELAP are modes, not models.
4. OpenRouter/free: last-resort backup when enabled with `OPENROUTER_API_KEY`; no paid fallback is assumed. Optional consented image fallback stays with OpenRouter.

## Initial deployment readiness
The Worker config is `cloudflare/wrangler.jsonc`, with `ai.binding = "AI"`, `AKSARA_CONTROL` SQLite Durable Object and Static Assets. Validate first:

```sh
npm ci
node cloudflare/build.mjs
node --test cloudflare/migration.test.mjs cloudflare/control.test.mjs
node --test tests/aksara-workers-ai.test.cjs
npx wrangler@4.135.0 deploy --config cloudflare/wrangler.jsonc --dry-run
```

Cloudflare account owner must separately provision the Worker account, deploy staging preview, set relevant runtime secrets (never commit keys), and perform real provider tests. Required for quotas: `AKSARA_RATE_SALT` (strong private random string) and Durable Object binding. Gemini/Groq/OpenRouter secrets are optional depending on which providers should run. Studio still requires its Cloudflare account/Workers AI REST credentials or other configured image services. The text Workers AI model itself uses `env.AI`, not `CLOUDFLARE_API_TOKEN`.

The Cloudflare Workers AI free neurons allocation is finite and may be consumed by both text inference and Studio image inference. Monitor real neurons usage and add account-level budget controls before promoting text AI to ordinary visitors. A passing mocked test or a configured `AI` binding is only **Ready**, never proof of a successful actual response. Keep error reporting honest and fallback limited to permitted providers.

Security: Worker requires same-origin POST API callers; rate limits and global budgets are handled through Durable Object, and model secrets must stay server-side. Keep preview `noindex` and Netlify canonical URLs until explicit cutover. Do not assume `localStorage` or `IndexedDB` transfer automatically between origins.

After deployment, run true Chat, NDJSON streaming, rate-limit, providers, Voice Live, Studio image enhancement and image generation smoke tests. Maintain a rollback path to current Netlify pages. **Do not merge merely because Wrangler dry-run passes.**
