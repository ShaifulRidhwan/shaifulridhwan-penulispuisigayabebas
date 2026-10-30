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
