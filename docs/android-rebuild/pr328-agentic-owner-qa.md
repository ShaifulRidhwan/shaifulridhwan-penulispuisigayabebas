# PR #328 · AKSARA AGENTIC ABSOLUTE CORE V1 · Owner QA

## Scope LOCK
- Android Native ONLY. No Bilik Antara Web UI changes.
- Vercel AI SDK 7 and DeepAgents.js live on Netlify, never inside the 740 MB-class Alpine APK.
- Existing Chat, Today, Linux, Voice, Studio, Novel and Perpustakaan stay functional and unmodified except Chat's compact Agent entry.
- Never merge until owner tests the full Linux APK on physical ARM64 Android.

## Backend runtime
- `GET /.netlify/functions/aksara-agentic` shows non-secret configuration and defaults to `enabled:false`.
- `AKSARA_AGENT_ENABLED=true` enables beta only after the owner explicitly reviews the public endpoint risk.
- `OPENROUTER_API_KEY` routes ONLY to `openrouter/free`.
- `GROQ_API_KEY` additionally requires `GROQ_FREE_CONFIRMED=true`.
- Optional Gemini requires `AKSARA_AGENT_GEMINI_FREE_CONFIRMED=true`.
- There is no fallback to a paid model; provider tool-call capability must be validated live.
- API is anonymous at present, with per-instance rate limiting only. **DO NOT ENABLE FOR PUBLIC ROLLOUT** before owner authorization and distributed budget gates.
- No persistent resume/checkpoint is claimed. DeepAgents only has task-local virtual context.
- No shell, root, real filesystem, credential reads, private memory, Novel/Perpustakaan or GitHub writes.

## CI acceptance
1. Agentic dependency lock synchronizes `package.json` and `package-lock.json`, then `npm ci` succeeds.
2. Agentic contract tests and syntax tests pass.
3. Android Gradle + Kotlin compiles without changes to Linux/PTY.
4. Owner APK is one signed installable `AKSARA-AGENTIC-ABSOLUTE-CORE-V1-FULL-LINUX-PR328-<sha>.apk`, >700 MB and <900 MB.
5. `zipalign`, `apksigner`, bundled Alpine manifest/checksum and native PRoot/PTY checks pass.
6. Build artifact and GPL PRoot source are published; no 240 MB substitute.

## Android owner QA checklist
1. Install the full APK. Open Chat and verify zero crash, wallpaper and Liquid Glass match prior version.
2. Swipe LEFT to Aksara Today. Confirm fixed five cards, no scroll, live data as available.
3. Swipe RIGHT to Aksara Linux. Verify Alpine startup, Enter, `python3 --version`, `git --version`, `aksara-fetch`; close/reopen.
4. Go to Chat and press **Agent** in conversation header. Verify compact dialog, Light / Balanced / Deep, consent unchecked initially.
5. With backend agent disabled, submit a permitted mission and confirm truthful `Agentic Core belum diaktifkan` error without Chat crash.
6. With explicit backend owner enable and free model configured, submit **Light** calculator/knowledge mission. Inspect engine/provider/tool trace.
7. Submit a **Deep** research mission. Require actual DeepAgents engine, sources and truthful partial/error states if provider lacks tool calling.
8. Press **Henti** during a long mission. Confirm Android stops network request and no UI freeze.
9. Toggle airplane mode mid-mission; confirm error reported as connection/backend failure, not fictitious Gemini Offline.
10. Return to ordinary Chat: multi-turn context, streaming, Stop, Retry, provider attribution all continue to work.
11. Screen off/on, multitask, rotate and restart, then reopen Agent. Verify no crash or persistent personal mission memory.
12. Confirm Linux and Novel/Perpustakaan remain untouched.

## Important
No claim of zero cost beyond actual upstream free quotas. No claim that CI passes or physical device QA is complete until source-backed artifacts and owner tests confirm it.
