# AKSARA native Android mobile backend · code review (owner private QA)

This PR is intentionally backend-only. It does NOT deploy the web or change
public Bilik Antara behavior until deliberately merged/released.

## Added / changed
- Dedicated Android owner-QA mobile Studio image and prompt-refinement routes.
- Dedicated Android owner-QA Gemini Live ephemeral-token route.
- Shared high-entropy bearer-token validator that checks server-stored SHA-256
  using a timing-safe comparison; tokens are never embedded into Android.
- Netlify Blobs daily and short-window token issuance quotas for mobile Live.
- `studio-http.js` accepts an internally verified Android request **only when
  a trusted server-side adapter sets `__verifiedAndroid===true`**. This marker
  cannot be transmitted directly in a public browser body to the handler.
- Existing public website Origin checks remain active, including the
  independent web Gemini Live token endpoint.

## Before production deploy
1. Review every changed file, the isolated CI and permitted model list.
2. Configure the Netlify server-side variables `GEMINI_API_KEY`,
   `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, etc. as for the web.
3. Generate an original high-entropy 32–128 character Base64URL-safe owner
   QA token LOCALLY and store **only its SHA-256 hex digest** as
   `AKSARA_MOBILE_STUDIO_TOKEN_SHA256` in Netlify. Never publish or commit
   the raw token.
4. Confirm functions deploy through the Netlify site that actually serves
   the Android API. Probe invalid token 401, absent configuration 503,
   over-quota 429, normal website Origin gate 403, valid owner usage 200.
5. Use ONLY for one trusted developer's private QA. For public Android
   distribution, replace the shared bearer with account authentication,
   app attestation, user-specific quotas, revocation and durable audit logs.
6. Confirm Studio quotas remain enforced by the existing Netlify Blobs store.
7. A Gemini Live ephemeral token is valid for one connection and expires soon;
   no permanent Google API key leaves the server.

## Feature gates
All endpoints fail closed when the QA secret is missing or invalid.
Until this review is merged and deployed, Android will report that its mobile
backend is not available. That behavior is deliberate, not a request to
bypass web access controls.

## Excluded
- Android UI and 3D demo source (in separate `aksara-android` branch).
- Permanent provider key in APK, browser Origin spoofing or relaxed CORS.
- Distribution-ready user authentication or license grants for external GLB.
