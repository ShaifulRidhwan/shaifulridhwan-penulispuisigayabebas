# AKSARA Android · Gemini Live integration security gate

Version: v0.4.0. Status: **NOT enabled in the Android APK**.

The v0.4.0 Voice tab uses native Android speech recognition and Android TextToSpeech, sending recognized text to the existing AKSARA Core streaming chat API. This enables turn-based Voice Chat while respecting the deployed production controls. It is **not** the Google Gemini Live duplex audio service.

## Why Live is not exposed yet

The existing `netlify/functions/bilik-antara-live-token.js` endpoint intentionally requires the exact web Origin. A native APK is not a browser. Forging that Origin header, embedding the Gemini API key, or weakening the endpoint to trust missing Origin headers would expose the owner's API quota to abuse. None of those approaches is permitted.

## Production-ready proposal for Live

1. Android authenticates the user with an explicitly supported login mechanism. Do not rely on obscurity, a hardcoded app token, an Origin header, or an unverified package name.
2. The Android client obtains an app/device attestation token with a fresh server nonce (for supported Google Play builds, Play Integrity may be suitable). The backend validates integrity, signing certificate digest, nonce freshness, package identity, and attestation response with the vendor. Support a clear fallback / opt-out when attestation is unavailable, without exposing privileged endpoints.
3. The backend performs server-side user rate limiting, daily quota accounting and abuse detection. Redis / durable storage, not only per-instance in-memory Maps, should enforce these budgets.
4. A dedicated authenticated mobile token broker obtains a **one-use, short-lived Gemini Live ephemeral token** after authorization. It never returns the permanent Gemini API key. Restrict to appropriate Live models and minimal TTL, log only non-sensitive operational diagnostics.
5. Android connects to Google's Live API over authenticated TLS using the temporary token. Audio and transcripts require explicit permissions and readable privacy disclosures. Disconnect on background, revoked permission or network failure.
6. Test end-to-end with two devices, expired/replayed tokens, incorrect attestation, invalid user session, high concurrency, quota exhaustion and connection interruptions.
7. Preserve the existing web Origin checks. Deploy the mobile broker only after a signed release configuration and compatible backend changes are reviewed.

## Current v0.4 voice privacy

- Microphone use begins only after user action and runtime permission. No always-on recording.
- The OS speech recognition engine may perform processing using a provider service or remote servers, depending on device settings. The APK does not guarantee offline recognition.
- Aksara receives recognized **text** through its existing backend, then system TTS speaks the response. The APK does not save raw microphone recordings.
- Voice switches off on leaving the page or when Android sends the app to the background; all recognition and TTS objects are released.
- Users can disable automatic reading of answers or stop playing audio.
- These features use the same active local chat session as text chat, including the user's local conversation-saving preference.

## Signing

Persistent signing is configured by the repository's `android-app/RELEASE_SIGNING.md`. The current GitHub Actions debug artifact may be signed with a different transient runner key between builds. It is not a substitute for a durable, privately held release signing key.
