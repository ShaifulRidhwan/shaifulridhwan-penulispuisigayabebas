# OrcaRouter: free-only second-layer fallback

Gemini remains the main model. Groq, OpenRouter, and Requesty retain the existing first fallback routing. OrcaRouter is last for **text only**, using the fixed model ID `orcarouter/free`.

The official OrcaRouter Free documentation describes this endpoint as zero-cost with **rate limits** rather than a fixed call allowance. HTTP 429 uses Retry-After. It cannot select paid models through this fixed model ID.

## Netlify environment variables

```env
AKSARA_FREE_FALLBACKS=true
AKSARA_ORCAROUTER_LAYER2=true
ORCAROUTER_API_KEY=<server-side OrcaRouter key>
```

No `ORCAROUTER_COST_APPROVED` or `ORCAROUTER_MODEL` is required. An arbitrary model override is intentionally disallowed.

## Status display

OrcaRouter appears directly below OpenRouter in the Multi A.I. status dialog. Its status is **Ready** only when configured and not in cooldown. This is configuration readiness, not a claimed live model success. When not configured, the row displays **Not active**.

## Guardrails

Keys stay server-side in Netlify. No images are transmitted to OrcaRouter. Cross-review does not use it. No health-check inference is spent on this provider. Existing fallback logic takes precedence.

## Rollback

Set `AKSARA_ORCAROUTER_LAYER2=false` and redeploy.

## References

- https://www.orcarouter.ai/models/orcarouter/free
- https://www.orcarouter.ai/switch/openrouter

## Aksara parity (October 30, 2026)

- OrcaRouter receives the same full system identity, CAHAYA/GELAP mode instructions and bounded chat history as the other text providers, plus a compact Malay-language reminder.
- `orcarouter/free` stays the fixed free router. It is only considered when the first-layer text providers fail; it never processes images, joins background cross-review, or runs paid/extra inference checks for health status.
- Completion success and latency contribute to Aksara Evaluation Lab/Model Registry observational diagnostics.
- The Multi A.I. status changes from `Ready` to `Connected` only after a real reply (within the warm instance's 90-second window); a later `429` follows `Retry-After` and marks it temporarily offline.
- `Listed` on DeepSeek means an official public model listing, not guaranteed model selection or verified availability. Actual response metadata may identify a different free upstream model.

Run `npm run test:aksara-platform` to check mocked free-only routing, identity and history propagation, SSE streaming, first-layer priority, image isolation and HTTP 429 handling. **Mock tests do not replace a real end-to-end API-key check**; real connectivity and quota eligibility remain unverified until an authentic user message is routed through OrcaRouter.
