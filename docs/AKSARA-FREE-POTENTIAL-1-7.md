# AKSARA Free Potential 1–7

Release 2026-11-02. Implementation matrix. No paid provider auto activation.

1. ROUTING: Groq time capped, cooldown honored, time reserved for Google and RSS.
2. MULTI URL: At most five public HTTPS URLs via Gemini URL Context; evidence required for each. No visual audit.
3. DOCUMENTS: Existing Gemini inline PDF/image and bounded document text enriched with document-aware instructions. Large Gemini Files API upload is NOT integrated; requires explicit user consent and frontend upload.
4. SEMANTIC: Existing public poem lexical RAG + optional Workers AI reranker, public passages only. Set AKSARA_WORKERS_RERANK_ENABLED=true with AI binding. No private notes sent.
5. DATA: CSV/JSON deterministic local median, sample standard deviation, missing count, most common categories. Max 250 rows/30 columns.
6. GATEWAY: Optional Workers AI binding gateway only, no third-party unified billing. Set AKSARA_WORKERS_GATEWAY_ENABLED=true, optionally AKSARA_WORKERS_GATEWAY_ID=default. Caching and prompt logging disabled.
7. DIAGNOSTICS: providerStatus.freePotential reports configured vs executed; no sensitive tokens.

Privacy defaults, Gemini keys, model and voice unchanged. Workers optional features default OFF to protect free neuron allocation.

Production QA: verify RSS numbering and provider diversity, two-URL comparison with a failure, local CSV data JSON, and providerStatus.freePotential. Check Cloudflare neuron allocation before enabling Workers features.

Sources:
https://ai.google.dev/gemini-api/docs/url-context
https://ai.google.dev/gemini-api/docs/file-input-methods
https://developers.cloudflare.com/workers-ai/models/bge-reranker-base/
https://developers.cloudflare.com/ai-gateway/usage/worker-binding-methods/