# AKSARA Android Gemini Live · private owner QA (v0.9)

**Development status:** native Android UI/transport and server broker implementation are staged in `aksara-android`. The broker has NOT been deployed to Netlify production `main` and the API call will fail safely until configured. Do not expose this private QA flow to the public.

## Activation

1. Keep the existing site-only `bilik-antara-live-token.js` Origin requirements unchanged.
2. Review the new `netlify/functions/lib/aksara-mobile-live-broker.js` and `netlify/functions/bilik-antara-live-android.mjs` from the protected development branch.
3. Authorize a separate backend deployment of the audited mobile broker. Do not accidentally merge unrelated Android experiments into `main`.
4. The backend needs the existing Google `GEMINI_API_KEY` and a strong owner token SHA-256 in `AKSARA_MOBILE_STUDIO_TOKEN_SHA256` (currently shared with private Studio QA).
5. Prepare a random private owner token (32-128 characters, Base64URL-safe) on a trusted local device; set the **SHA-256 digest only** as the Netlify variable. Never paste the original token into repository files, APK, screenshots or public chat.
6. Open Android Voice > Gemini Live · Ujian Pemilik, grant the microphone permission, enter the private token and connect. The token lives only in ephemeral Compose state and HTTPS request memory. Google receives one-use Live auth credentials, not the owner token.
7. Validate real-device audio input/output, response transcription, audio mute, speaker mute, app background cleanup and quota limit. Check invalid tokens 401, missing configuration 503, quota limit 429 and browser Origin unchanged. If unavailable, use the existing turn-based native voice without bypassing security.

## What is still pending

- Public users require real user authentication, app attestation and account-bound durable quotas, rather than a single shared owner QA secret.
- Automatic Google session renewal/resumption and sophisticated interrupt/barge-in handling.
- Correct release signing, Google Play distribution compliance, latency/battery measurement and third-party speech privacy checks.
- Fully synchronized 3D visemes/expression rig matching the original web character.
- Third-party 3D example asset has a **CC BY-NC 4.0** non-commercial license and attribution. The debug build references the pinned remote model; no GLB is bundled. Replace with legally licensed original model for public/commercial use.
