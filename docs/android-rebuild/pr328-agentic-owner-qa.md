# PR #328 · AKSARA AGENTIC ABSOLUTE CORE V1 · Owner QA


## Protected Netlify backend preview · mandatory before live device QA

**CI status at implementation:** Backend contracts and local mock ToolLoopAgent/DeepAgents tests pass (13/13). These are NOT live provider/Netlify confirmations.

### One-time owner connection (never paste credentials in ChatGPT or in repository files)
1. In GitHub repository **Settings > Secrets and variables > Actions**, add **NETLIFY_AUTH_TOKEN** (Netlify Personal Access Token) and **NETLIFY_SITE_ID** (Netlify Project ID). CI does not expose their values.
2. In Netlify project **Environment variables**, assign to **Deploy Previews / Functions**:
   - `AKSARA_AGENT_OWNER_KEY`: one long, random 40-256 character URL-safe token. Generate with `python3 -c "import secrets; print(secrets.token_urlsafe(48))"` on your device; copy to Netlify yourself. **Never commit it or send it in chat.**
   - `AKSARA_AGENT_ENABLED=true` only after the owner key has been set.
   - At least one FREE tool-capable provider: `OPENROUTER_API_KEY` (restricted to `openrouter/free`) or `GROQ_API_KEY` with `GROQ_FREE_CONFIRMED=true`. Never allow paid-mode auto fallback.
3. Open GitHub Actions workflow **AKSARA Agentic Netlify Backend Preview** for the PR branch, and run workflow manually. Future backend commits also trigger it.
4. Workflow deploys a **functions-only draft** using Netlify CLI; it does **not** deploy to production. Expected alias: `https://aksara-agentic-pr328--shaifulridhwan-penulispuisigayabebas.netlify.app`.
5. Check `/.netlify/functions/aksara-agentic` on that preview URL. Expect `ownerAuthRequired: true`, `enabled: true`, and `readyForOwnerMission: true`. A GET status response alone is not evidence the LLM ran.
6. The PR328 Android owner APK routes ONLY Agent missions to that isolated Netlify preview. Normal Bilik Antara Chat stays on production Netlify. Paste the *same private token* into the Agentic Mission password field **on your device**, not into chat. It is never bundled or saved by the APK.

### Honest limitations
- The Netlify preview deploy workflow intentionally skips deployment if GitHub Netlify credentials are not configured. A green workflow in that situation means the gate worked, **not that a preview was published**.
- Netlify Blobs provides strong reads, but lacks atomic compare-and-swap. Daily reservations are a **best-effort shared quota**, not a strict distributed transaction. Owner authentication and upstream free provider quotas are mandatory.
- Android Henti disconnects the phone request. The server may keep processing until its own timeout; it is not an end-to-end cross-instance cancellation guarantee.
- DeepAgents currently has request-local virtual task state. This is not cross-request durable resume.
- No credentials are printed by the endpoint; do not put owner token or API key in issue comments, Actions logs, Android strings or screenshots.
- Owner QA and live tool-calling tests must finish before PR #328 is merged.

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
