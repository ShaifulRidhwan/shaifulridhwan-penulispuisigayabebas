# AKSARA P0–P3: Intelligence, routing, performance, regression

Implementation branch: feature/aksara-intelligence-p0-p3-20261111.
Canonical Android backend stays on Netlify. This milestone is not a
claim of GPT-6-equivalent reasoning or completed physical-device QA.

## P0 — Intelligence

- New request-local, Malay/English synonym-based context retrieval:
  netlify/functions/aksara-context-retrieval-v7.js.
- Existing Context Manager maintains recency, user corrections and chronology;
  new code limits transport to 24 history rows and 28,000 characters by default.
- Gemini may return up to two different public knowledge_search function calls.
  New bounded runner executes those existing local tools in one response round.
  No arbitrary web fetch, private memory, filesystem, paid models, model loop,
  API key access or additional external inference calls beyond the old one-round flow.
- Existing Quality Evidence V5/V6 and Thinking V4 remain authoritative.
  Human-graded model quality and deeper, general-purpose agent planning are NOT
  proven or provided by this patch. No persistent embeddings/vector memory added.
- Memory stays opt-in; Android Web Brain remains server-authoritative.

## P1 — Routing and recovery

- Existing 3+1 fallback priority, Gemini primary and Voice routing preserved.
- Repeated 0/408/5xx/transient errors for non-Gemini fallbacks now trigger
  instance-local circuit backoff: 15, 30, 60 and 120 seconds (capped).
- Single failure follows the original cooldown.
- Real 429/402 quotas, authentication and invalid model errors retain the
  existing provider rules. Never bypass a quota, rotate keys or enable paid tools.
- After visible streaming begins, fallback must never splice a new provider
  into the partial answer. No automatic resubmission of user requests.

## P2 — Performance validation

- Macrobenchmark adds six iterations of 10 keyboard open/close cycles, using
  a real chat composer on a real Android device. The test fails if missing.
- Previous cold-start, chat/dashboard frame tests and ART Baseline Profile
  generator are preserved. No synthetic or unmeasured performance gain claimed.
- Physical performance comparison script:
  node scripts/aksara-p0-p3-performance-gate.cjs --baseline=baseline.json --candidate=candidate.json --require-device
- Normalized JSON fields: source androidx.benchmark.macro; physical device
  model and integer SDK; benchmark variant; six or more iterations; ISO
  capturedAt; real commit SHA; coldStartMsP50; frameTimeMsP95; jankPercent.
- Comparison requires matching device and SDK, different SHAs and <=10%
  deterioration in all three numerical metrics.
- Retain raw device-generated Macrobenchmark JSON and Perfetto traces;
  metadata in a normalized summary alone is NOT authenticity proof.
- With no device files, status is UNMEASURED. Do not fake Baseline Profiles.

## P3 — Regression, CI and release acceptance

- New tests: context synonyms, correction/24-row preservation, backoff and
  quota separation, public-only multi-tool execution, truthful source levels,
  benchmark metadata validation and numeric regression detection.
- GitHub Action aksara-p0-p3-quality runs new Node tests, old Web Brain
  platform tests and Android performance preservation contracts.
- The existing Android workflow is also triggered by the modified Android
  Macrobenchmark source and must compile APK and run Kotlin tests.
- Required manual checks: original 3+1 provider response/metadata and voice,
  end-to-end Malay follow-ups, protected private attachments, CAHAYA/GELAP,
  knowledge_search results, IME 10x open/close, Bluetooth duplex, maps and games.
- Real-model quality requires graded samples rather than fabricated scores.
- Physical-device hardware QA and live AI evaluation cannot be certified from
  a source commit, static tests or an emulator alone.
- Keep the PR as draft and do not merge until CI is passing and QA is reviewed.

## Preservation and privacy

Do not alter Novel/Perpustakaan/Puisi UI, Studio, Voice Aoede, Chat/Today
Liquid Glass, existing user animations, games or existing app navigation.
No new paid service, forced permission, persistent memory or new environment
secret is introduced. The Netlify production site is NOT automatically
redeployed by these GitHub changes.
