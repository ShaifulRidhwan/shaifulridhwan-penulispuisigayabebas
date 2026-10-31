# AKSARA A.I. · Android Native (0.1.0)

Native Android client for the existing AKSARA Core. **Not a WebView / Capacitor wrapper.**

## Current scope

- Kotlin + Jetpack Compose native UI, Cahaya/Gelap chat modes and native navigation.
- Text chat via the existing Netlify `/.netlify/functions/bilik-antara` API.
- Backend probe distinguishes configured availability from a real successful reply.
- Studio and Novel are **explicit placeholders**, not claimed to be implemented.
- Session is held in memory only for this first milestone; clearing/restarting the app resets it.
- No Gemini/Groq/OpenRouter API keys are packaged in the APK.

## Build

GitHub Actions: branch `aksara-android` -> **AKSARA Android Debug APK** -> download the `AKSARA-Android-debug` artifact. The APK is a **debug build**, not a Play Store release.

Local (Android SDK + JDK 17 + Gradle 8.13):
```bash
cd android-app
gradle :app:assembleDebug
```

APK output: `android-app/app/build/outputs/apk/debug/app-debug.apk`.

## Backend contract (verified from repository source)

POST `https://shaifulridhwan-penulispuisigayabebas.netlify.app/.netlify/functions/bilik-antara`

Request:
```json
{"question":"Apa khabar?","thoughtMode":"cahaya","history":[]}
```

Response: `reply`, `provider`, `model` or `error`. Probe uses `{"probe":true}`. The existing server rejects foreign **browser Origin** headers; Android uses a native HTTP client, not browser CORS. **A missing Origin is not authentication.** Before public distribution, introduce appropriate server-side authentication/abuse controls and a deliberate mobile-client policy.

## Pending

- Full text streaming and cancellable requests.
- Persistent sessions, consent controls, cross-device memory.
- Native studio/image gallery and book reader.
- Native dictation and Gemini Live session flow; token endpoint currently requires the website Origin, so it must NOT be bypassed using a forged header.
- Production app signing / release / Play Store readiness.
- Emulator/device testing and accessibility review.

## Isolation

All Android implementation remains under `android-app/` and its dedicated GitHub Actions workflow. Do not merge the Android work into `main` or alter Netlify configs until reviewed.
