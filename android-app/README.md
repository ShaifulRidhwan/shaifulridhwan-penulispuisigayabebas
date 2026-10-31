# AKSARA A.I. · Android Native (v0.2.0)

Kotlin + Jetpack Compose Android client for AKSARA Core. This is **not** a WebView or PWA wrapper.

## Implemented

- Native Bilik Antara chat UI, CAHAYA/GELAP selection, dark glass styling.
- **NDJSON streaming** via existing `bilik-antara-stream.mjs` endpoint, with final `done.reply` treated as authoritative (prevents duplicated streamed text).
- Stop button cancels active client request; incomplete partial response is labeled and excluded from future AI context.
- Native Markdown subset: bold, italic, headings, inline code, fenced code blocks, quotes, lists and visibly displayed link URLs. No HTML interpretation.
- Private local chat history in Android SharedPreferences, bounded to recent 80 messages. Optional saving in top-right menu; disabling clears saved conversation immediately. Backups disabled in manifest.
- Smart scroll-to-latest, hides welcome banner during chats, smaller bubbles, realistic status after reply.
- Native Studio and Novel tabs are **not implemented yet**; current screens explicitly say so.
- Model API keys remain on the backend.

## Build

GitHub Actions workflow `AKSARA Android Debug APK` runs unit tests and Gradle `:app:assembleDebug` on branch `aksara-android`, then publishes artifact `AKSARA-Android-debug`. This is a **debug APK** intended for testing only.

Local requirements: JDK 17, Android SDK 36, Gradle 8.13.

## API protocol

POST `/.netlify/functions/bilik-antara-stream` with JSON body containing `question`, `thoughtMode`, `history` and forward-compatible `clientPlatform: android`. Server emits newline-delimited JSON frames of `start`, `delta`, `done` and `error`. On completion, `done.reply` is the canonical complete answer. A separate JSON endpoint receives `{"probe":true}` to indicate backend configuration, not proof of live model availability.

Existing backend may still give website-specific instructions; `clientPlatform` is not yet consumed by its deployed handler. Client UI separately documents where Android controls are. Avoid changing Netlify Functions until their mobile-client contract, rate limiting, authentication, and deployments are reviewed.

Android app uses native HTTPS and does not send browser Origin. CORS and absence of Origin are **not authentication**. Server-side protection is mandatory before public release.

## Pending / limitations

- Sessions are local-only, not synchronized with the website; raw text is stored locally (not additionally encrypted) in the Android app sandbox when saving is enabled.
- Streaming needs device verification for network interruptions, long replies, and Android background behavior.
- Native Gemini Live Voice (token endpoint currently checks the browser Origin), Studio image generation, Novel reader, image attachments, and richer Markdown link handling are future work.
- Full identity/platform-aware server prompts, accessibility audit, secure app signing and Play Store review are not yet complete.

## Branch isolation

Everything Android-specific lives under `android-app/` and `.github/workflows/aksara-android.yml`. No web production modification or Netlify deployment is required for this APK build.
