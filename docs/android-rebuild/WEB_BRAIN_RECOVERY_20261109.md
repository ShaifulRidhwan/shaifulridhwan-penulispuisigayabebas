# Android Web Brain recovery: initial findings (incomplete)

Baseline: Android rebuild `5ce71b4ff093691c5bf3b43549e3f4f7878b4466`. This is a preliminary source trace, not a complete audit or parity certification. CI run 42546948063: backend smoke, web audit, build and unit tests passed; emulator job failed. PRs 272–274 were merged into the Android branch; PRs 275–276 remain open and are excluded.

## Request path

Web `bilik-antara.html` builds its request from `contextHistory()`, thought mode, summary, ideas, privacy controls and attachments; the stream endpoint `netlify/functions/bilik-antara-stream.mjs` calls the handler in `netlify/functions/bilik-antara.js`. That handler composes `bilik-antara-brain.js` and `bilik-antara-identity.js` with intent/cognitive planning, research workflow, tools, context and `aksara-provider-router.js`. The browser also resolves a follow-up URL from earlier user messages. Server routing, reasoning and tools depend on configuration and actual provider support.

Android `ChatViewModel.send` constructs its own history and summary via `ContextPolicy`, and sends to `ChatApi` (NDJSON stream with a JSON fallback only on unsupported route). The same server can execute its own intelligence modules, but this alone does not prove the browser and Android send equivalent input. Android Live instead uses `LiveVoiceClient` and the token broker, with prompt assets generated from Web Brain/Identity/Voice Core; it is a separate Gemini Live session, not the text backend's tool pipeline.

| Capability | Web source | Android source | Known gap / verification |
| --- | --- | --- | --- |
| Identity and reasoning | Brain, Identity and server handler | Server for Chat; generated assets in Voice | Shared components exist; comparative real-model behavior not tested |
| Context | HTML `contextHistory`, URL-follow-up resolution, session utilities | `ContextPolicy`, `SessionContextStore` | Different selection and no equivalent prior-URL rewrite found; long-context parity unverified |
| Ideas / debate ledger | HTML sends `ideas.slice(-8)` | `ChatViewModel` sends empty `thoughtLedger` | Previous debate ledger is not carried into Android requests |
| Research / tools / sources | handler, `aksara-research-workflow.js`, provider router | `ChatApi` parses metadata and HTTPS sources | Shared backend is not evidence of equivalent execution; live Android tests outstanding |
| Fallback consent | HTML `contextFallback` checkbox initially unchecked | Was hard-coded true in `ChatViewModel`; now false | Text documents and opted-in memory cannot be sent to Chat fallback without a consent UI. Server summarization is a separate path and may use a fallback for conversation history; this change does not cover it. |
| Chat to Voice | Web Voice Core V3 | `VoiceContent` supplies bounded recent Chat as setup context | Source path exists; real audio follow-up not verified |
| Voice to Chat | Web Voice Core V3 | `LiveVoiceClient` keeps completed transcripts in memory only | No transfer into Chat archive; two-way continuity not implemented |
| Sessions | Web session utilities | `SessionStore`, `SessionMerge`, `SessionContextStore` | Encrypted archive and summary exist; process death, multiple sessions and end-to-end voice tests remain unverified |
| Attachments | Web attachments and handler | `AttachmentReader`, `DocxTextExtractor`, `ChatViewModel` | End-to-end interpretation and metadata parity unverified |
| Provider transparency | handler returns provider/model/tools | `ChatApi`, `ChatViewModel` | Provider and metadata parsed; persistence and display across history require further review |

The privacy change limits the main Chat request's `contextFallback` flag only. A mocked backend regression `node --test --test-name-pattern='private context without consent' scripts/test-aksara-reliability.cjs` passes against the existing backend contract; it is not an Android, live-provider, or summarization-path test. Real device, real tool invocation, voice audio, side-by-side intelligence evaluation and the complete capability audit remain open.

## Follow-up checkpoint

- `ContextPolicy.selectHistory` now attempts to retain the latest user URL for explicit URL follow-ups within the backend's 18-turn window. The full turn must fit the existing history budget; the JVM regression is pending CI and is not a live research test.
- Android now explicitly denies summary fallback, and the branch's backend handler respects an explicit denial while preserving legacy behavior when omitted. Mocked tests cover both paths. **The Android app uses the production Netlify backend, which does not receive this branch change until separately deployed; the summary privacy fix is not effective in production yet.** Do not infer that no conversation history can be sent to another provider.
- The experimental native image CI path filter no longer watches Chat, Voice, or brain assets. It still runs for native source, Studio and Gradle changes or manual dispatch. A workflow configuration change alone no longer triggers that job; use manual dispatch to validate it.

## Voice-to-Chat checkpoint

`LiveVoiceClient` now hands completed nonempty transcript turns to `ChatViewModel`, which appends them to the current Chat and persists them in the encrypted archive. An interrupted model transcript is cleared, and drifted output is not handed to Chat. Archive writes are serialized. Voice setup captures the Chat context at entry, avoiding a fresh socket setup when a completed voice turn updates Chat. Unit tests cover transcript filtering; an emulator instrumentation test checks handoff into selected Chat context and encrypted archive reopening. These are synthetic transcripts, not a physical Live audio or reconnect test. Transcript accumulation remains bounded at 2,800 characters per side, and transcription may be missing; it does not establish complete audio transcript integrity.

## Session thought ledger

The NDJSON adapter now reads the backend's `thoughtLedger` entries, and the request sends the latest eight session ideas like the Web. At most twelve deduplicated entries are stored alongside the encrypted session summary; clearing the current session or changing its first message resets the ledger. This is conversation context, not opt-in personal memory; `memoryEnabled` remains false by default. Real model generation of ledger entries, multi-session isolation and restart behavior remain to be validated beyond unit and encrypted-store tests.
