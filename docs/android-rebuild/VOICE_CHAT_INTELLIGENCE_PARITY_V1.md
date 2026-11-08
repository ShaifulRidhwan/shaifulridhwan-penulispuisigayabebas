# AKSARA Android Brain Parity: Chat + Gemini Live Voice

Date: 2026-11-09. Target: development branch `rebuild/aksara-android-native-v1` (no merge into main).

## Source-grounded finding
Chat Android already sends NDJSON/JSON and the same `/.netlify/functions/bilik-antara` Netlify requests as Bilik Antara web. That backend owns Identity, Brain CORE, provider routing (Gemini, Groq, Workers AI, OpenRouter), Context Manager, Thinking V3/V4, research/tools, knowledge, evidence, response quality and quota policy. Do not embed the Node router or provider API keys in the APK. Live provider availability and server feature flags are independent checks.

The large mismatch was Gemini Live: Android used a separate, potentially stale `voice-identity.txt`; web used `bilik-antara-brain.js` CORE, VOICE_GUIDANCE, `bilik-antara-identity.js` RUNTIME_PROMPT/VOICE_CREATOR_PROMPT and `bilik-antara-voice-core-v3.js` replyGuidance, plus current chat and ephemeral Voice conversation history.

## Implemented bridge
- Generated two mode-specific native voice prompt assets from these **exact shared web modules** with `scripts/sync-android-voice-brain.cjs`. `--check` is a CI invariant: a change to web personality must be explicitly resynced to Android.
- Live setup sends those canonical persona/creator/voice instructions for Cahaya/Gelap, preserving Aoede and the user's selected speech style. It does not inherit the two-emoji text policy for spoken replies.
- Only the current in-app session's last 12 completed Chat turns, bounded to 4600 characters, are supplied as explicitly untrusted context DATA to Live. Conversation context selection is not user memory.
- Optional memory notes are supplied only when explicitly enabled, capped at 700 characters. A disabled memory option sends "tiada".
- Gemini Live input/output transcription is requested for quality and dialog recovery; bounded completed voice turns are kept **only in RAM**. Interrupted or drifted assistant utterances are not restored as trustworthy completed answers.
- On a resumed Live socket, use Google's session resumption. On a fresh socket without a valid resumption handle, supply bounded recent Voice dialogue as DATA so "lagi", "dia", "yang tadi" can retain the subject.
- Extended-thinking Live connection failures on eligible unsupported setup paths may request the backend's **standard Live model**, using the same token broker and quota. Authentication/authorization errors remain errors; no alternative credentials, hidden Cloudflare routing or model claims.
- The Netlify backend and Web Chat remain unchanged. New pure JVM voice tests cover transcript overlap, valid bounded JSON, correction/follow-up context and data-role filtering.

## Capability boundary
Shared intelligence instruction and context continuity do **not** make Live a multi-provider text router. Gemini Live has independent audio constraints and may not execute every Web Chat tool/research pipeline. Do not claim parity of browser search, citations, JSON, multi-attachments, live model access, output accuracy or all states without end-to-end tests.

## Acceptance gates
1. Canonical Brain sync check passes.
2. Android app and `engine:voice` unit tests pass.
3. Real emulator installation/voice start, backend token issuance and network recovery smoke pass.
4. Physical phone: live microphone, Aoede playback, short replies, long explanation, multiple "lagi" follow-ups, mid-session mode/style change, unexpected socket close, explicit Spanish translation then return to Malay, memory OFF and memory ON, interrupted AI, no transcript persistence.
5. Distinguish product quality and security findings from UI screenshot similarity (the historical 98% visual gate is separate).

No test harness can prove the LLM became "equally intelligent". This implementation aims for shared authoritative instructions and comparable context handling while surfacing unverified live capability honestly.
