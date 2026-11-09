# P0 Fasa 2: Web Brain ownership & Android contract

Status: Android native integration. No parallel duplicate reasoning/router service is deployed.

| Intelligence capability | Authoritative owner | Android wire / responsibility |
|---|---|---|
| Identity, CAHAYA/GELAP, prompt/response policy | Web backend `bilik-antara.js`, `bilik-antara-modes.js`, and identity modules | Send `thoughtMode`; no Chat-side system prompt |
| Context Manager, decisions, correction handling | Web `aksara-context-manager.js` + `aksara-context-consistency-v6.js` | Bounded 24-row transport selection; server selects final relevant context |
| Intelligence, Thinking V3/V4, reasoning level | Web `aksara-intelligence-v5.js`, `aksara-thinking-v4.js` | Stream actual answer; never choose model/reasoning in Kotlin |
| Multi-provider, model registry, fallback & recovery | Web `aksara-provider-router.js`, hybrid policy, recovery V6 | One Netlify origin, surface actual provider/model; no Android-owned provider bypass |
| Research, search, URL, knowledge and skills | Web research/workflow, safe tools, knowledge engine | Send question and references; show source links only when returned |
| Evidence / quality / hallucination guard | Web evidence audit, quality evidence V6, structured output | Parse evidence metadata conservatively, no fabricated page proof |
| Sessions, optional memory, summaries, thought ledger | Web summary endpoint plus encrypted Android session context | Explicit `contextFallback=false`, memory OFF unless opted in |
| Document, image, video, audio | Web document/vision intelligence + Gemini Files | Android picker/receipts and media continuity; backend interprets |
| Live Voice Aoede, language and audio | Canonical Web-derived Voice brain asset plus Gemini Live | Native AudioRecord/Track, duplex Bluetooth routing and recoveries |
| Voice tool calling and real audio hardware validation | Not yet verified as equivalent | No false full parity claim; needs physical-device end-to-end tests |

## Fasa 2 implementation
- `WebBrainBridge.kt` centralizes summary/chat payload generation and fallback/memory defaults.
- `ChatViewModel.kt` delegates to the bridge; it no longer independently builds two policy payloads.
- `WebBrainBridgeTest.kt` verifies ownership boundaries, 24-row cap, media receipts, summary privacy, and opt-in notes.
- Existing `ChatApi.kt`, `ContextPolicy.kt`, `LiveVoiceClient.kt` and canonical voice assets are reused, not rebuilt.

## Release gates
Actual production backend smoke + reproducible APK + JVM tests + emulator smoke and physical Bluetooth + real model outcomes should be evaluated separately. A passing APK build is not evidence of live Voice audio, full Web parity, or safe fallback deployments.
