# AKSARA Android Native · v0.8.0

Native Kotlin + Jetpack Compose app, not a webview or Capacitor wrapper.
Repository: ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas, branch `aksara-android`.

## Native glass redesign (v0.8.0)

- Rebuilt the web's dark charcoal, warm-gold and ivory visual tokens instead of the earlier opaque blue/purple cards.
- **Real native GPU blur of the ORIGINAL static background image under glass panels** (Android 12/API 31+). The clipped sampled wallpaper mirrors panel position, with a translucent gradient and amber hairline, not just a solid transparent rectangle.
- Frosted panels installed in the header, bottom navigation, entire chat area, Voice answer panel, and Studio panels. Background wallpaper is significantly more visible; current controls still work.
- Background chat scene is additionally blurred when sessions, providers or feature overlays appear.
- **Technical limit:** Compose RenderEffect blurs the wallpaper layer, not arbitrary live dynamic content behind each panel. On Android API 26–30 the surface-blur API is unavailable, so a translucent fallback is used. Perfect DOM/CSS pixel parity is not claimed until screenshot tests on the same density and device.
- Gemini Live, the 3D character and mobile Studio production access are separate backend, graphics, licensing and authentication work, not bypassed by this visual update.

## Native message and attachment parity (v0.7.0)

- Real, clickable **HTTPS links** in model Markdown. Non-HTTPS, malformed and user-info-bearing links are never clickable. No embedded HTML or WebView.
- Native **Markdown tables** (horizontal scroll), **code blocks** (language label, horizontal scroll, copy code), headings, bullets, quotations and dividers. Bounds protect against pathological model responses.
- Native **image attachment thumbnails before sending**, decoded at reduced resolution off the UI thread for smooth scrolling. User can remove pending attachment. Raw media is not stored in conversation history.
- JUnit regression tests for Markdown code/table parsing, untrusted link handling, and image thumbnail downsampling.
- All Android Compose components retain the app's original artwork, session handling and model/Studio/Voice wiring from v0.6.
- This is functional progress toward parity, **NOT proof of identical CSS pixels or all web features**. Production backend Studio and full Gemini Live remain separately gated; see parity matrix.

## Native parity: Studio and source references (v0.6.0)

- Native Studio image generation client and safe preview: all 11 original web presets, 3 models, 5 ratios where supported, 3 quality choices, Klein seed, image decoding and save to a user-selected document.
- Native prompt refinement via the same Studio backend, with an explicit review/edit before replacing the original prompt.
- Dedicated server-side **owner-only QA** API adapters for Studio generation and prompt refinement, protected by a high-entropy bearer token validated by a SHA-256 hash held in Netlify environment. These route through the existing Studio quotas and provider implementation.
- **Not yet active in production:** mobile Studio endpoints are staged on `aksara-android`, not deployed to `main`. A private token hash must be set and backend deployment approved. No token is bundled or persisted in the app. This is private owner QA only, not public app authentication.
- Real server-returned answer citations/HTTPS sources and disclaimer are displayed as native reference buttons and stored with chat history.
- Tests include Studio model contract, source URL safety, mobile bearer authorization and website-only Origin protection.

See `MOBILE_STUDIO_SETUP.md` for secure activation. Gemini Live duplex + 3D avatar remain in `ANDROID_LIVE_SECURITY.md`, not falsely labeled complete.

## Bilik Antara native parity foundation (v0.5.0)

- Original Bilik Antara background, avatar art, brand and novel cover packaged as native resources; no WebView.
- Native Ciri & Fungsi hub, live 4-provider status, web-aligned default starters and Thinking Mode selector.
- Attachment picker supporting allowed images, PDFs, short audio/video and text (size-capped per shared server contract).
- Opt-in memory notes, explicit fallback permissions, server-backed manual context summary, session pin/JSON backup import/export, native draft workspace, performance metrics.
- Per-message local time display. Original web identity and model-router behavior inherited from the backend.

**Full 100% equivalence is NOT yet claimed.** See `PARITY_MATRIX.md` for precise implemented/pending scope, especially Gemini Live and Studio authorization.

## Delivered in v0.4.0

- **Native Voice tab:** Tap-to-speak Malay speech recognition using Android SpeechRecognizer, text sent to the same multi-AI backend chat, completed answers played through Android TextToSpeech. User explicitly starts each listening turn, and can stop either microphone or audio output.
- Visible listening/processing/speaking states, live transcript preview, automatic turn-based speech reply, replay and mute. Respects the currently selected CAHAYA/GELAP mode and active chat session.
- Microphone permission requested only when the user taps the mic. Recognition and playback stop on navigation away or when app backgrounds. No raw mic recording stored by AKSARA. The OS speech recognition service may process audio through third-party infrastructure.
- Android SpeechRecognizer checks and TTS locale fallback; test coverage for plain-text speech formatting.
- **Important: this is TURN-BASED Android speech + Aksara Core, not Google Gemini Live real-time duplex audio.** Gemini Live still needs a server-side, authenticated mobile ephemeral-token broker and native realtime audio client.

## Delivered in v0.3.0

- Text chat with **streaming NDJSON** from the existing Netlify AKSARA Core, CAHAYA/GELAP modes, stop, and manual retry on failed/incomplete messages.
- Native Markdown display; copy assistant or user messages; regenerate the most recent completed answer.
- Conversation collection: create, rename, search by title/content, switch, delete, independent CAHAYA/GELAP mode per session.
- Migrates saved v0.2 conversation to v0.3 workspace upon in-place upgrade when signing permits; local app storage, with an explicit saving OFF option.
- Practical UI polish: translucent cards, updated header/navigation, stable message IDs, scroll-to-latest control, lighter welcome animation, capped streaming UI refresh (~12 fps).
- Native Android speech-to-text **dictation** using a compatible installed recognizer. This does NOT claim Gemini Voice Live.
- Native Studio **prompt composer** and style/ratio presets. **Image generation is blocked pending a legitimate Android backend integration**; it is not represented as working.
- Native novel reader for the owner's *Antara Cahaya dan Gelap*: 8 parts packaged as text-only, offline, reading position per chapter, font size and light/dark mode. Other linked books open their original websites in an external browser. No WebView.
- Android client sends `clientPlatform: "android"`. A server-side platform guide is staged in the Android branch, **not deployed to Netlify production**, so existing production responses may still mention web controls.

## Architecture

```
Android Kotlin UI -> AksaraApi (HTTPS + NDJSON) -> existing Netlify Functions -> AI providers
Android local ChatStore (bounded JSON SharedPreferences, no cloud sync)
Android assets/antara_cahaya_dan_gelap.json (offline original novel)
```

Secrets for Gemini, Groq and image providers must NEVER be embedded into the APK. Backend currently uses browser-origin constraints for Studio and Live tokens. The APK must not forge Origin headers, ship provider keys, or bypass those checks.

## Debug / QA builds

GitHub Actions: `AKSARA Android Debug APK`, branch `aksara-android`.
The workflow runs JUnit tests, Gradle compile and publishes `AKSARA-Android-debug`. JDK 17, Android SDK 36, Gradle 8.13.

A debug APK built on a new GitHub runner may use a different debug certificate than older builds. To keep Android app data across updates long term, configure **persistent release signing** (see `RELEASE_SIGNING.md`).

## Signing readiness

The workflow supports optional signed QA release APKs after four encrypted repository secrets are supplied. No signing private key is checked into git. Until the secrets are configured, signed QA builds are **not** produced and cannot be claimed to be ready.

## Known limits and follow-up

- **Gemini Voice Live** (full duplex) requires a secure mobile token broker and native realtime audio client; not yet integrated. See `ANDROID_LIVE_SECURITY.md`.
- **Studio generation** has native client and staged owner-only mobile backend, but remains unavailable in production until the owner safely configures the server hash and approves deployment. This owner QA flow is not suitable for public distribution.
- Native reader is available offline for the owner's original book. External catalog titles are links, not offline copied books.
- Local session storage is bounded to 12 sessions × 70 turns; do not rely on it as cloud backup. Current storage uses Android app-private SharedPreferences, **not additional encryption**. No Web sync or server-side memory.
- Existing public chat endpoint needs server-side abuse controls and an explicit mobile-client authentication policy before public distribution.
- Regeneration or manual retry may trigger a second upstream request and consume a model quota.
- `main` (production web) is intentionally unchanged; server UI contract staging stays only on this Android branch until explicitly approved for web deployment.
- Screen-reader accessibility, battery profiling, release QA, Play Store policies, secure sign-off and more device sizes need validation.

## First device smoke test

1. Install APK from a trusted workflow artifact.
2. Create two sessions, rename/search/switch, close and reopen app.
3. Test streaming, stopping, manually retrying a failed reply, and regenerating a final answer.
4. Test CAHAYA/GELAP per session and Markdown formatting.
5. Test the dictation button using a speech recognizer installed on the device.
6. Open the Novel tab, read the offline original and resume after app restart.
7. Studio presets/image preview can be tested only with authorized owner QA endpoint deployed; absent backend should report a clear error.
8. Confirm the saved-session opt-out purges conversation data.
