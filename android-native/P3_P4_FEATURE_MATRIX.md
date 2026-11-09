# AKSARA Android Native P3 & P4 implementation matrix

Scope: user screenshots #40–58; UI groups are named exactly as specified.
All server intelligence remains controlled by canonical Netlify Bilik Antara.
Android does NOT create a second provider router, execute arbitrary shell commands or auto-share private data.

## P3: Advanced Intelligence

| ID | Feature | Status | Evidence / limits |
|---|---|---|---|
| 40 | Task Planner | Existing Web Brain; new native read-only plan preview | Local preview shows explicit substeps without claiming execution |
| 41 | Tool Executor | Existing Web SafeTools + Function Calling | Backend validates tool schema and reports toolsUsed; no arbitrary native execution |
| 42 | Answer Verifier | Existing backend review/evidence audit; Android displays reported result | Source links are not proof that a claim is true |
| 43 | Model Capability Registry | New Android live provider/model and capability metadata from providerStatus | Configured does not imply inferencing succeeded; exact context window not fabricated |
| 44 | Multi-model Verification | Existing selective backend review; Android parses reviewApplied | No second call is automatically added by the app |
| 45 | Adaptive Context Compression | Existing encrypted summary + 24-message transport window | Continuity and summarization fallbacks remain consent-restricted |
| 46 | Knowledge Graph | New limited local co-mention topic associations | Does not claim a semantic knowledge graph or prove relationships |
| 47 | Personalization | Canonical Web identity, modes, optional encrypted memory, Voice style | Memory remains OFF by default |
| 48 | Research Workflow | Existing Netlify research and citation tools, with actual researchStatus metadata | No invented source citations or page-read claims |
| 49 | Evaluation Engine | JVM P3/P4 regression tests + backend live smoke | A measured cross-model reasoning/accuracy benchmark remains outstanding |

## P4: Privacy, Settings, Android stability

| ID | Feature | Status | Evidence / limits |
|---|---|---|---|
| 50 | Privacy Dashboard | New Settings: session counts, export/import, opt-in notes, confirm delete | Delete applies to Chat, summaries, memory, drafts only; not Studio or remote records |
| 51 | Permission Manager | Android runtime mic/Bluetooth permissions + new Settings status and OS permission screen | Picker follows OS media/document permissions |
| 52 | Secure Local Database | Existing Android Keystore AES-GCM + AtomicFile session/context; new AES-GCM drafts | Room migration not introduced to avoid destabilizing encrypted existing archives |
| 53 | Offline Task Queue | New encrypted bounded manually resumed draft queue | No auto-replay of non-idempotent AI requests. WorkManager not yet used |
| 54 | Prompt Injection Defense | Existing backend untrusted-document boundary, safe tool allowlist and data-only context | Model resistance cannot be proven by a JVM passing unit test |
| 55 | Agent Permission Gate | User presses Send; extra explicit approval before large Gemini Files upload, export via SAF, confirm before deletion | No silent destructive native tool execution |
| 56 | Observability | New local aggregate request success/error counters, live provider/model/evidence status | Does not log or upload prompt contents |
| 57 | Performance Manager | UI device RAM heap, battery and battery-saver state; bounded media/queue | Thermal, thread and sustained network throttling still require physical QA |
| 58 | Regression & Release Gate | Existing JVM, live backend, Web audit, emulator instrumentation and 98% mismatch report | Physical Bluetooth, device-specific performance and 98% visual similarity not automatically certified |

## Settings IA

1. Kecerdasan & Model
2. Chat & Lampiran
3. Voice & Audio
4. Memori & Privasi
5. Tools & Research
6. Sistem & Diagnostik

## Privacy controls

- Opt-in memory notes only, stored encrypted; export JSON is explicitly plaintext.
- Large remote upload requires explicit user approval; metadata inspection errors fail closed.
- Draft queue stores only text in a separate encrypted file, max 20 and 2400 chars each.
- Clearing Chat does not assert erasure of provider-side records, Studio history or offline models.
- No new hidden background automation or shadow duplicate intelligence engine.

## Release

CI build/test/emulator results and on-device audio/privacy QA must be recorded against the exact merged commit and APK artifact. Never substitute an earlier P2 artifact or invent an APK download URL.
