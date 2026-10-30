# Aksara: Vector RAG + Global Model Quality (Cloudflare)

This is an **optional, free-tier-first** upgrade. Nothing is provisioned or billed automatically by the repository. Without the environment variables below, Aksara continues using the existing lexical/concept retrieval and per-instance provider selection.

## 1. Why these two new systems

**Vector RAG:** Workers AI `@cf/baai/bge-m3` generates multilingual 1024-dimensional embeddings. Cloudflare Vectorize stores and queries vectors for the **public literary corpus only**. Queries use a real cosine-nearest-neighbor lookup, merged with existing lexical scores.

**Global model selection:** Cloudflare D1 stores atomic success/failure counts, latency totals and *separately* developer-reviewed quality ratings aggregated by provider and task. No prompts, reply text, IP addresses, user identifiers or API keys are stored.

## 2. Cloudflare setup

You must create or select resources in your own Cloudflare account and use a scoped API token. Never put tokens into the GitHub repository, browser code or chat.

| Netlify environment variable | Purpose |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID, 32 hex characters |
| `AKSARA_CF_RAG_TOKEN` | Server-only API token with Workers AI Run and Vectorize read/write access |
| `AKSARA_VECTORIZE_INDEX` | Optional name, default `aksara-public-knowledge` |
| `AKSARA_CF_D1_DATABASE_ID` | UUID of a Cloudflare D1 database you created |
| `AKSARA_CF_METRICS_TOKEN` | Separate server-only D1 read/write API token |
| `AKSARA_D1_TRACK_USAGE` | Optional `true`: record live backend successes/failures in D1 |

If the existing image service uses a Cloudflare account, you may reuse **only the account ID**, not its token unless its restricted permissions already meet the requirement.

A. Create or initialize Vectorize (index dimensions 1024, distance metric cosine). Using the developer machine with environment variables set, run:

```sh
npm run rag:count
npm run rag:init
AKSARA_RAG_INDEX_CONFIRM=YES_PUBLIC_ONLY npm run rag:index
```

`rag:index` upserts **only titles and poem lines in the repository public corpus**, limited to 200 chunks by default (configurable through `AKSARA_RAG_INDEX_LIMIT`). Nothing from a visitor session is indexed. It does not index private user files, chat text, or memory. Import requires explicit confirmation. First indexing can consume Workers AI free quota; retry manually if the free limit is reached.

B. Create a D1 database in Cloudflare. Then, from the developer environment:

```sh
npm run quality:init
npm run quality:status
```

C. After personally evaluating a real model answer, record a quality rating from 1 (poor) to 5 (excellent):

```sh
AKSARA_EVALUATOR_CONFIRMED=HUMAN_REVIEWED node scripts/aksara-rating-cli.cjs rate groq philosophy 4
```

Ratings are human-supplied and require **at least five rated samples** for a provider/task before they influence routing. HTTP 200 and a fast response do not count as proof of answer quality. The CLI does not store the question or answer, only the provider/task/rating aggregate. To meaningfully measure gains, use a documented and balanced rubric, blind comparisons, and enough samples.

## 3. User privacy and opt-in

The Knowledge & Research glass dialog includes a checkbox for optional Cloudflare vector search. It is OFF by default and resets with the tab. Only relevant public-work questions can invoke the vector query after the checkbox is enabled.

**Important:** Even a question may contain private information. The UI explicitly states that question text is sent to Cloudflare when vector search is enabled. Private notes, session summaries, memories and uploaded documents are **not vectorized or persisted**. Private memory needs separate strong authentication, explicit consent and deletion controls; it is not silently activated in this patch.

## 4. Fallback, safety and budget

- If the Cloudflare keys, index, D1, free quota or HTTP service are unavailable, Aksara falls back to its previous in-process system.
- Worker AI embed requests have short timeouts; do not add costly or unbounded model calls.
- Rating and telemetry writes are server-only, parameterized and atomic. Recording live usage is opt-in through `AKSARA_D1_TRACK_USAGE=true` to protect quotas.
- Read quality stats are cached for 90 seconds in each warm function; scores are global once D1 has been configured.
- Dynamic OpenRouter free models still vary; a rating on the **provider** is not guaranteed to represent the exact same model on each request.
- The existing CAHAYA/GELAP, Voice Live, images, design and regular model routing remain untouched.

## 5. Current limits

Cloudflare Vectorize has a Workers Free allowance of 30 million queried vector dimensions/month and 5 million stored vector dimensions, subject to current Cloudflare terms. Workers AI currently offers 10,000 neurons/day free. Enabling extra requests can consume this allocation. No paid plan is enabled by this code.

Vectorize provides persistent **public** vectors. D1 provides shared **aggregated model metrics**. This patch deliberately does **not** create a permanent cross-visitor user-memory service. Such a feature must have authenticated ownership, access and erasure guarantees.

References:
- https://developers.cloudflare.com/vectorize/platform/pricing/
- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/
- https://developers.cloudflare.com/api/resources/vectorize/subresources/indexes/methods/query/
