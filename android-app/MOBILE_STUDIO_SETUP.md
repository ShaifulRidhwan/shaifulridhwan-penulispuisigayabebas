# AKSARA Studio Android · Owner-only QA activation

This document applies to the `aksara-android` development branch. The Android UI and server adapters are staged but **not deployed in the current production `main`**.

## What this provides

Two native-only HTTPS endpoints on Netlify Functions:

- `/.netlify/functions/studio-android` for image generation.
- `/.netlify/functions/studio-enhance-android` for AI prompt enhancement.

Each endpoint requires `Authorization: Bearer <private owner QA token>`. The server validates its SHA-256 hash with constant-time comparison. On success, it calls the existing exact Studio handler, models and Netlify Blobs quota store. The web's own Studio endpoints retain their Origin checks. **The API keys for Groq, Cloudflare and other AI vendors remain server-only.**

## Owner-private setup (requires explicit deployment approval)

1. Prepare a high-entropy random secret on a trusted local computer, **never in this chat**. Example: `openssl rand -hex 32`.
2. Obtain its SHA-256 hash locally without a newline: `printf '%s' "$AKSARA_QA_TOKEN" | sha256sum`. Do not add the *raw token* as a Netlify variable.
3. In the authorized Netlify environment, set only `AKSARA_MOBILE_STUDIO_TOKEN_SHA256` to the 64-character lowercase hex digest.
4. Review and deploy the Android-only adapter functions and updated `studio-http.js` from the reviewed branch through an approved deployment process, **not by blindly merging experimental Android changes into the protected production main**.
5. Enter the original random QA token into the app's Studio field for the current screen session. It is not persisted and is discarded on leaving the page.
6. Verify positive generation and enhancement, invalid bearer 401, absent token 401, unconfigured endpoint 503, web origin check remains 403, 429 quota budget enforcement, 404 before deployment, and cancellation/timeout. Revoke by changing/removing the hash.

### Very important security boundaries

- This is for **one trusted owner testing their own Studio**. A shared public secret is not per-user authentication and cannot securely scale to other users.
- Never hardcode tokens into Kotlin, GitHub, screenshots, README or Netlify static HTML. The model providers' API keys must never leave server-side environment variables.
- Never forge a web Origin header or expose a permanent Gemini API key to the APK.
- Never change the existing Studio website Origin restriction to simply accept missing Origin.
- The QA token is entered by a user and lives transiently in Compose state. It may be present in HTTPS request memory while an operation runs. It is not a guarantee against malware on a compromised device.
- For public launch use authenticated user identities + verified device/app integrity + server-side authorization and shared durable rate limits, and require a release-signed APK. Keep owner and public quotas separate.

## CI

The Android branch's GitHub Actions workflow uses `node --test android-app/test/mobile-studio-auth.test.cjs` to validate the token verifier and that plain browser-less requests still fail the website-only handler. CI never invokes a real provider or consumes real Studio quota.
