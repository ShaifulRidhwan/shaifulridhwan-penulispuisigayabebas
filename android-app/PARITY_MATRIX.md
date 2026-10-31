# Bilik Antara Web → AKSARA Android Native (parity inventory)

Source baseline: main branch, 2026-10-31.
Native baseline: aksara-android v0.4.0.
Target milestone: v0.7.0 rich-native chat plus continued visual/functional parity.

## Implemented in native

- Kotlin/Compose only (no WebView). Original web artwork imported as Android drawable resources.
- Shared AKSARA Core, same Netlify Bilik Antara NDJSON streaming, CAHAYA/GELAP, provider routing, fallback behavior and model personality from the SERVER, not copied API keys.
- Text chat, streamed Markdown, stop/regenerate/manual retry, clipboard, elapsed response and per-turn local time.
- Default starters "Siapa Aku", "The Coder Poet", "Apa itu Puisi Gaya Bebas".
- Mode dialog, native feature hub, 4-provider live status endpoint with honest ready/online/offline display.
- Session create/switch/rename/pin/search/delete, local backups JSON (export/import), v0.2 migration, local opt-out.
- Separate user-authored memory notes with enable/disable, opt-in fallback controls, manual server-backed context summary, local workspace editor/export and per-device performance counters.
- Native Android file picker: images/jpeg/png/webp/gif, PDF, audio/mpeg/wav/mp4/ogg/webm, video/mp4/webm, txt/md/csv, up to 3 attachments / 3.4MB combined; all sent as approved fields to existing backend. Media bytes exist only for a pending request and are not stored in chat history.
- Turn-based native voice recognition and Android TTS, on-demand permission, stops on background.
- Native offline original 8-part Antara Cahaya dan Gelap reader with saved progress and settings; original cover art restored.
- Studio: exact web presets/models/ratios and quality chooser, native prompt refinement, request/preview/save image implementation; **only authorized on a private QA backend after separate Netlify deployment**.
- Native answer sources and brief server disclaimer from final NDJSON response, HTTPS links displayed in chat and persisted per session.
- **v0.7:** render click-through HTTPS Markdown links, native tables, horizontal scrolling and copying of code blocks, headings and safe quotes. No remote HTML execution.
- **v0.7:** sample and decode pending image attachments off the main thread; show private thumbnails before sending. Multiple attachments remain request-only.

## Shared server-side features inherited automatically

AKSARA Brain / identity, Provider Router, Context Manager 2.0, semantic-lite Knowledge Engine, Safe Tool Execution, Wikipedia research workflow, routing fallback, privacy shield and model-specific thinking use the SAME backend endpoint as the web. Server deployments are shared: modifying model routing does not require app rebuild. Native sends optional memory/context/media fields using exact deployed contract.

## NOT equivalent yet (must NOT claim 100%)

- **Gemini Live** full duplex audio and **3D avatar**: the web uses temporary tokens, Google Live WebSocket, audio worklet and Three.js. Android currently has OS STT/TTS turn-taking only. Requires a protected mobile broker, model authorization, native audio pipeline and 3D engine.
- **Studio generation production activation**: website-only Origin checks stay enforced; Android-specific owner QA adapter and token validation are implemented **only in this development branch**. Model authorization, shared quotas, per-session secret entry and preview are built, but the backend is not deployed or configured. Public release requires real per-user authentication and abuse controls.
- **Exact pixel/motion parity**: CSS, DOM, gradients, Three.js and viewport layout cannot be directly transplanted into Compose. The imported images and recreated layouts approximate original identity; typography, avatar, glass and animations require visual QA at multiple densities.
- **Full JS chat rendering**: citations, HTTPS links, Markdown tables and code blocks are now native, but complex research diagrams, inline remote-media players, generated review cards and rich visualizations still need dedicated Compose renderers. No arbitrary HTML.
- **Full offline catalog**: only the owner's original is packaged; other copyrighted/rights-specific novels link to publishers/approved sources.
- **Cross-device storage**: local-only notes/sessions/metrics. No sync or permanent server-side personal memory.
- **Public release security**: no durable signer secrets configured, no secure mobile identity/auth/rate limits for privileged tools, device accessibility/battery profiling pending.

## Strict rules

Never call site-only Studio endpoints with forged Origin. Never package provider keys, model credentials or signing private keys in APK/repo. Never silently enable the user-private fallback or auto-upload attachments. No changes to production main unless explicitly authorized and separately reviewed. QA pass requires compiler + JUnit + real-device smoke results, not screenshot similarity.

## Suggested verified follow-up tests

1. Install upgrade; check local data not deleted (signing may prevent upgrade).
2. Check welcome art/header/start prompts, both thinking modes, long text streaming and retry.
3. Check modal 4-provider statuses and semantic knowledge questions (providerStatus uses inference occasionally).
4. Attach images, PDF, TXT and audio under size limit and verify any unsupported media produces a clear error.
5. Enable/disable local memory and fallback options; confirm memos are never sent when disabled.
6. Test multiple sessions, pins, JSON export/import and opt-out; no backups or server sync claimed.
7. Navigate Studio/Novel/Voice and background app; verify no stuck microphone.
8. Verify Android time-only tags, no GPS access, and original book art.

## Parity verification rule (v0.7)

One web feature is only marked **working** when (1) native code exists, (2) tests compile and pass, (3) its backend contract is authorized and deployed where needed, and (4) a real-device functional test confirms interaction. Imported images or visual similarity alone are not functional parity.

For the remaining high-impact gaps, prioritize:
1. Native authenticated Gemini Live token broker + native duplex audio, without copying secrets or spoofing web Origin.
2. Native animated 3D avatar engine with original model/assets, tested across device performance tiers.
3. Studio mobile backend production activation only after protected identity, durable quotas and owner approval.
4. Rich server result cards/diagrams and visual snapshot comparisons at multiple phone sizes.
5. Durable release signing, accessibility and robust cross-device storage policy.
