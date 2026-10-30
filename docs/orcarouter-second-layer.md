# OrcaRouter: optional second-layer fallback

Aksara keeps Gemini as the primary model and its existing Groq, OpenRouter and Requesty fallbacks. OrcaRouter is tried **last**, only for text, only when the upstream fallbacks have not returned an answer.

## Netlify environment variables

- `AKSARA_FREE_FALLBACKS=true` (existing fallback master switch)
- `AKSARA_ORCAROUTER_LAYER2=true`
- `ORCAROUTER_API_KEY=<server-side key>`
- `ORCAROUTER_COST_APPROVED=true` (explicit approval of upstream token charges)
- Optional: `ORCAROUTER_MODEL=orcarouter/auto` (default if unset; may choose paid models)

The OrcaRouter gateway's free Hacker plan **does not make model tokens free**. Avoid enabling the cost-approval flag until your billing or BYOK exposure is understood. There is no safe assumption that `orcarouter/auto` selects only zero-cost models. Leave `ORCAROUTER_COST_APPROVED` unset to keep the integration dormant.

Keys must only be stored in Netlify server-side environment variables, not HTML or browser JavaScript. No image or attached-media transfer is routed to OrcaRouter. Cross-review never selects OrcaRouter. Health reporting marks it **ready** (configured but unprobed), never **online** based on a paid inference probe. A successful real answer may be observed in normal telemetry.

## Rollback

Set `AKSARA_ORCAROUTER_LAYER2=false` (or remove `ORCAROUTER_COST_APPROVED`) and redeploy. Existing fallback behavior remains unchanged.

## Verification

Run existing Aksara tests after merging and verify both disabled and enabled configurations in Netlify. A true end-to-end OrcaRouter request requires an API key and explicit cost authorization.
