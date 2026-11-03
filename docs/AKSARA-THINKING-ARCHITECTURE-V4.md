# Thinking Mode 4.0: Cahaya & Gelap

## Why
The user observed that CAHAYA could reply too briefly even after explicit requests to "jelaskan lagi" or "explain lebih detail". The pre-V4 request path called depth selection multiple times and could optionally cap simple low-effort outputs. A short question must not imply a short answer.

## Unified planning
- Use a single request-local `ThinkingV4.planRequest`, retaining the existing V3 depth heuristics and the established effective model effort. Model effort (Low/Medium/High) is **independent** of answer depth (Ringkas/Berisi/Mendalam).
- Default is **Berisi**, not Ringkas, for genuine explanations. Explicit "jawab ringkas" remains respected; "jelaskan lagi" / "lebih detail" triggers Mendalam and asks for *new* information, with a nonbinding 4,400-token ceiling floor.
- Existing `AKSARA_V6_RESPONSE_EFFICIENCY` opt-in output cap applies only to explicitly Ringkas tasks. No forced paid/free-tier additional LLM call.
- Both modes continue to share source classifications, history-based corrections, anti-sycophancy and user privacy. GELAP verifies the strength of objections instead of manufacturing disagreement; CAHAYA gives genuinely sufficient explanations.
- Deterministic completeness diagnostics can flag an answer as `needs_review`, but do **not** claim factual accuracy or secretly retry and spend provider quota.
- No changes to Voice Live, Gemini key pool, provider fallback, user memory, Code Engine or Studio.

## Offline validation
`npm run test:aksara-thinking-v4`, `npm run test:aksara-platform` and `npm run benchmark:aksara:thinking-v4`.
Benchmarks enumerate 58 existing cases plus detail-followup regressions in both modes. Offline plans do **not** grade model intelligence or factual accuracy.

## Live comparison (opt-in only)
Use `AKSARA_THINKING_V3_EVAL_URL=https://.../.netlify/functions/bilik-antara node scripts/aksara-thinking-benchmark-v4.cjs --live --confirm-quota --count=3`.
The existing pair harness uses 2 requests per prompt and requires the same model/provider and independent human quality assessment. It should **not** be run automatically in CI.

## Manual acceptance prompts
1. CAHAYA: "Kenapa manusia takut berubah?" then "jelaskan lebih detail". The second response must add mechanisms, examples and implications.
2. CAHAYA: "Apa itu DNS? Jawab ringkas." Must remain short and accurate.
3. GELAP: "Uji hujah bahawa popular bermakna benar." Must not disagree without evidence.
4. Switch between modes and ask "maksud aku bukan begitu". Correct facts should be preserved.
5. Ask for sources with no verified external tool. Must not invent links.
6. React with "haa" after a long explanation. It must not trigger another essay.

CI green is necessary but does not establish production answer quality. Verify after the Netlify main deployment.
