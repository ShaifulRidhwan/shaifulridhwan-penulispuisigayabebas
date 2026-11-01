# Cloudflare Seven-Capabilities Integration | AKSARA
All adapters are shipped behind fail-closed flags; **only AI Gateway and native GLM binding already have live integration evidence**. The others require Cloudflare resources, secrets and preview validation and are **not activated by this commit**.

1. **AI Gateway**: optional `AKSARA_AI_GATEWAY_ID` with `skipCache:true,collectLog:false`, no personal chat cache.
2. **AI Search**: `AKSARA_AI_SEARCH_ENABLED=true` and `AKSARA_AI_SEARCH` instance binding. Search uses **verified public poem title only** and validates returned titles and website domain; no private user notes indexed.
3. **Vectorize**: `AKSARA_VECTORIZE_ENABLED=true`; set a 1024-dimension cosine index, name `aksara-public-poems`, binding `AKSARA_VECTORS`, seeded by curated R2/Queues pipeline. Uses multilingual `@cf/baai/bge-m3` and costs neurons. Fallback after AI Search.
4. **Turnstile**: `AKSARA_TURNSTILE_REQUIRED=true` plus secret `AKSARA_TURNSTILE_SECRET_KEY`. Client must acquire a fresh widget token and send `x-aksara-turnstile-token`; server verifies Siteverify + hostname. **Do not enable until client sitekey is configured and tested.** No secret in frontend.
5. **Workers AI audio/vision**: `AKSARA_MEDIA_AI_ENABLED=true`; owner-only `transcribe-audio` (Whisper large v3 turbo) and `inspect-image` (LLaVA). Does not replace Gemini Live or public media flow. Uploaded media is never persisted by these adapters.
6. **Browser Run**: `AKSARA_BROWSER_RUN_ENABLED=true` with `BROWSER` binding; owner-only `browser-homepage` always targets the **fixed public homepage URL**, so no user-supplied URLs or SSRF.
7. **R2 + Queues**: `AKSARA_ARCHIVE_ENABLED=true` with `AKSARA_R2` bucket and `AKSARA_QUEUE` producer. Owner-only archive operation accepts **exact title from committed works index**, uploads public poem JSON and enqueues only its id/key. Consumer binds R2, AI and Vectorize, verifies exact index title and embeds only the curated work. No chat transcripts are stored.

## Privileged request safety
`POST /api/aksara-owner-tools` requires a high-entropy owner token sent only in `x-aksara-owner-token`. Set the SHA-256 of that token as Cloudflare secret `AKSARA_OWNER_TOOL_TOKEN_SHA256`. There is no public admin UI, no fixed bypass token, no unauthenticated tool execution.

## Provisioning (NOT applied by pushing code)
Create AI Search instance, Vectorize index, R2 bucket, Queues producer/consumer, optional Browser Run binding, Turnstile sitekey + secret in Cloudflare Dashboard. Add optional bindings to wrangler config only **after resources exist**, e.g.:

```json
"ai_search": [{"binding":"AKSARA_AI_SEARCH","instance_name":"aksara-public-poetry"}],
"vectorize": [{"binding":"AKSARA_VECTORS","index_name":"aksara-public-poems"}],
"browser": {"binding":"BROWSER"},
"r2_buckets": [{"binding":"AKSARA_R2","bucket_name":"aksara-public-archive"}],
"queues": {"producers":[{"binding":"AKSARA_QUEUE","queue":"aksara-public-index"}],
           "consumers":[{"queue":"aksara-public-index"}]}
```

All bindings above are examples only. They must be provisioned on the target Cloudflare account and configured on a **staging Worker** first. Do not paste private secrets into GitHub. No automatic deploy to main or Netlify.
