# Android intelligence gap closure: source-grounded audit

Repository: ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas
Development branch: rebuild/aksara-android-native-v1
PR: #271 (Draft, must remain unmerged)
Date: 2026-11-08

This report distinguishes SOURCE-PRESENT, WIRED, SOURCE-GATED, TESTED and LIVE-VERIFIED. A JavaScript import does not establish live production configuration, model success or source retrieval.

## Authoritative backend dependency graph

Bilik Antara HTML -> Netlify/Cloudflare proxy endpoints -> netlify/functions/bilik-antara.js -> server router and request-local AI modules. Android Compose -> ChatApi.kt -> the SAME backend contracts. Do not duplicate provider policies or package API keys.

| Web capability/module | Path and actual condition | Android implementation or state |
|---|---|---|
| Context Manager 3.0 | aksara-context-manager.js; request-local history selection and corrections | ContextPolicy.kt selects bounded upstream history; server still selects |
| Intelligence V5 | aksara-intelligence-v5.js; backend helper | Reused on server |
| Context Consistency V6 | aksara-context-consistency-v6.js; imported and used by main handler | Reused on server |
| Thinking V3/V4 | aksara-thinking-v3.js and -v4.js; intent/mode planning | Android sends thoughtMode; backend decides reasoning |
| Response Efficiency V6 | aksara-response-efficiency-v6.js; response strategy | Reused on server |
| Recovery V6 | aksara-recovery-v6.js; error categories, retry-after guidance | Server available; full Android diagnostic display incomplete |
| Quality Evidence V6 | aksara-quality-evidence-v6.js via Model Registry; SOURCE-GATED by AKSARA_V6_QUALITY_ROUTER=true | Server only; live activation unknown |
| Telemetry V6 | aksara-telemetry-v6.js; disabled unless AKSARA_V6_TELEMETRY=true and approved Redis | No new mobile telemetry |
| Skills V1 | aksara-skills-v1.js; request-local eligible playbooks; AKSARA_SKILLS_ENABLED=false disables | Server only |
| Knowledge Engine | aksara-knowledge-engine.js; public index, request-local relevant context; AKSARA_DISABLE_KNOWLEDGE disables | Server only |
| Research Workflow | aksara-research-workflow.js; actual public research, gated | Server only, backend references passed through |
| Evidence Audit | aksara-evidence-audit.js; source and executed-tool evidence categories, not factual correctness | ChatApi.kt parses evidenceProfile.level |
| Hybrid Provider Policy | aksara-hybrid-policy.js; provider selection | Server only |
| Model Registry | aksara-model-registry.js via provider router | Server only |
| Gemini Text Pool | lib/gemini-text-pool.js; server-side multi-key slots, statuses, cooldown | Never package keys in APK |
| Structured Output | aksara-structured-output.js; JSON format and validation | ChatApi.kt parses outputFormat |
| Data Analysis | aksara-data-analysis.js; CSV/JSON processing | Android sends extracted documentText |
| Vision Diagnostics | aksara-vision-diagnostics.js; validates vision metadata | Android sends media bytes and MIME |
| Infrastructure Guards | aksara-infrastructure-guard.js | Backend only |
| Security Shield | aksara-security-shield.js; AI/tool/research/knowledge/review feature flags | No Android override |
| Prompt Optimization | aksara-prompt-optimizer.js | Backend only |
| Tool/capability manifest | aksara-capabilities.js; differentiates offered, called and executed | Android passes backend metadata, does not infer execution |
| Provider Router | aksara-provider-router.js; Gemini, Groq, Workers AI, OpenRouter | One backend authority, no local second router |
| Cloudflare REST | aksara-cloudflare-rest.js; server-side optional binding | No provider credentials in Android |
| Studio Antara | studio-image.mjs and shared handler | Native StudioGateway, real provider E2E pending |

Only source inspection establishes these code paths; deployment flags, upstream credentials, quotas and availability remain UNKNOWN until live tests.

## History and privacy equivalence

Web file bilik-antara.html compacts conversation context from 20 messages onward if at least 12 are not summarized, using the same summarize:true JSON API; the backend limits history to 24 rows with lib/aksara-transport.js. Web optional memory is disabled unless explicitly enabled and uses relevance selection.

Android implementation:
- ContextPolicy.kt: 24-message selection prioritizing recent exchanges and older corrections; threshold-compatible summary window; relevant saved-memory selection.
- SessionContextStore.kt: new encrypted context-v1.enc using Android Keystore AES-GCM; the original conversation.enc session archive remains untouched. No cross-device sync.
- ChatViewModel.kt: calls the backend summarize endpoint only when the conversation window is eligible, preserves old messages, sends actual summary, sends memoryNotes ONLY when the user enabled memory, logs summary failure without inventing success.
- AksaraOverlay.kt: settings in existing privacy overlay; memory OFF by default.
- AksaraScreen.kt: multiple staged attachments, explicit aggregate size limits, no silently dropped extras.
- ChatApi.kt: backend-provided toolsUsed, researchStatus, provider, model, outputFormat, evidence level and validated HTTPS source references.
- NativeToolsContent.kt: diagnostic display sourced from real responses, not configured capabilities.

## Functional acceptance and remaining gaps

| Capability | Source and Android bridge | Real execution / evidence requirement |
|---|---|---|
| Chat NDJSON | bilik-antara-stream.mjs -> ChatApi.kt | HTTP fixture tested previously; live Gemini/Groq/Workers/OpenRouter pending |
| Correction and context | Context Manager 3.0 -> ContextPolicy.kt | New deterministic JVM tests; backend multi-turn E2E pending |
| Summarization | bilik-antara.js summarize:true -> ChatViewModel.kt | New adapter; actual long-session/reopen test pending |
| Optional memory | SessionContextStore.kt | Explicit user settings; verify reboot + OFF semantics |
| Tools and sources | Evidence Audit -> ChatApi.kt | New NDJSON metadata test; live page-read vs snippet required |
| Multi-attachments | Web attachments -> Android SAF/AttachmentReader | DOCX test passed previously; real multimodal test pending |
| Browser Code Engine | Code runtime -> scoped WebView | Real JS worker passed emulator at previous commit; other languages not yet verified |
| Native Code | RuntimeService: JS, SQLite, Android shell | Five native emulator runtime/permission tests passed at previous commit |
| Voice | Live token broker -> LiveVoiceClient | Real phone audio/dialect/reconnect NOT VERIFIED |
| Studio | Studio Cloud API -> native StudioGateway | Real image generation and MediaStore save NOT VERIFIED |
| Linux | Experimental web -> Android shell | Not equivalent to Termux/Linux userland |
| HTML/CSS preview and workspaces | Web runtimes | Not yet equivalent |
| UI | Compose existing glass/navigation/portrait | Frozen except minimal control wiring; 98% visual target outstanding |
| Exclusions | SD-Turbo and unfinished Game Engine | Not modified |

Revalidate CI at the exact resulting commit SHA. A successful build is NOT complete operational parity. PR must remain Draft and unmerged; production web must not be modified.
