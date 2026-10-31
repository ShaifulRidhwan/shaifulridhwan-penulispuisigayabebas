# AKSARA | OrcaRouter vs OpenRouter A/B Lab

**Status:** test harness implemented on PR #123. No live A/B result exists until real provider requests succeed.

## Hypothesis

OrcaRouter's free routing (which may select DeepSeek) could provide better Malaysian-Malay language consistency, reasoning and context retention than OpenRouter's dynamic free-model pool. This is an **unproven** hypothesis.

## Equal test conditions

- Six fully synthetic test cases: Malaysian colloquial Malay, aporia, entropy, JavaScript null access, multi-turn IndexedDB context, and AKSARA's CAHAYA/GELAP identity.
- One shared system instruction, identical prompt and any conversation history; max 550 completion tokens per response.
- Both providers use only their `/free` aliases, without switching to a paid model.
- Request order alternates by case to reduce first-provider ordering bias.
- Record actual model name returned, latency, any HTTP failure, keyword coverage and possible Indonesian dialect markers.

## Executing

- **Offline, zero quota:** `npm run benchmark:aksara` runs contract self-tests only. No live calls and no winner.
- **Live API comparison:** `npm run benchmark:aksara:live` makes 12 bounded API calls (6 per provider) **only if** both `ORCAROUTER_API_KEY` and `OPENROUTER_API_KEY` are securely available as environment variables. API keys currently held only by Netlify are **not** automatically available to GitHub Actions.
- Optional report: set `AKSARA_BENCHMARK_REPORT` to a local JSON path. Protect this report: it contains synthetic prompts and provider replies. Never commit API keys or unreviewed reports.
- Do not place API keys in PR comments, public repository files, browser JavaScript or user-facing frontend.

## Evaluation rubric

For each generated answer, manually rate **1–5** on:

1. Bahasa Melayu Malaysia naturalness: local vocabulary and syntax; mark Indonesian-specific words or unnatural register.
2. Factual correctness: scientific/philosophical/technical answers must be accurate.
3. Identity and voice: AKSARA tone, CAHAYA/GELAP policy, no unsupported capabilities.
4. Context retention: recognizes the IndexedDB option without inventing missing history.
5. Usefulness: concise enough but answers the question completely.

Automatic keyword coverage and dialect-marker counts are **diagnostic hints, not human language-quality scores**. One single response is not proof of a lasting winner. If live A/B results suggest a winner, repeat on a second date to observe model-pool changes and quotas.

## Safety and compatibility

Do not merge an experiment to production merely because mocked routing tests pass. Live A/B needs API keys and actual requests; GitHub CI cannot access Netlify-only environment variables. PR #123 remains a draft until release checks and actual production behavior are reviewed. Keep OpenRouter image processing opt-in.
