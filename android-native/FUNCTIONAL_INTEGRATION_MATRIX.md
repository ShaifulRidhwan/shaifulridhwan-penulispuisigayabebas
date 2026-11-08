# AKSARA Android: functional bridge checkpoint

Scope: rebuild/aksara-android-native-v1, PR #271. This document records implemented source paths and *validation status*, never claims live-provider functionality from a compile alone. UI frozen. SD-Turbo and unfinished Game Engine excluded.

| Web capability | Existing web implementation | Android implementation | Verification requirement |
| --- | --- | --- | --- |
| AI and streaming | netlify/functions/bilik-antara.js, bilik-antara-stream.mjs | app/core/network/ChatApi.kt, feature/chat/ChatViewModel.kt | Actual backend streaming reply; unit HTTP fixture is not live proof |
| CAHAYA/GELAP | bilik-antara-modes.js | ChatViewModel.kt sends thoughtMode | Compare distinct real replies |
| Search, sources | aksara-web-search.js, main handler | ChatApi.kt parses server sources, chat bubbles render links | Live current query with valid cited URLs |
| Encrypted sessions | browser sessions and server context | core/storage/SessionStore.kt, feature/chat/SessionMerge.kt | Reopen app, clear display, restore archive; new JVM tests cover merge |
| Document intelligence | bilik-antara-attachments.js, document handler | core/platform/AttachmentReader.kt, DocxTextExtractor.kt | DOCX XML tests; full Android picker-to-model test still required |
| Gemini Live | bilik-antara-voice-core-v3.js, live-token | engine/voice/LiveVoiceClient.kt | Physical-device audible output, mic interrupt, speaker controls |
| Studio Cloud | netlify/functions/studio-image.mjs | feature/studio/StudioContent.kt | Real image generation/save, provider credentials required |
| JS, SQLite, Android shell | bilik-antara-code-runtime.js, terminal-core.js | engine/runtime/RuntimeService.kt | Isolated engine execution tests (emulator); no Linux equivalence |
| Public knowledge/tools | knowledge-hub.js, safe tools | feature/tools/NativeToolsContent.kt | Live retrieval, deterministic calculation, passive headers |
| Library/novel | karya-index.json, novel content | feature/library/LibraryContent.kt | Launch, read and offline asset test |
| Python/TS/C++ web runtimes | bilik-antara-code-runtime.js, code-engine.html | Scoped WebView with bundled web runtime scripts, CDN-loaded toolchains | Native WebView actual JS execution smoke + device tests for Python/TS/C++ still required |
| Linux userland | Experimental web terminal paths | Android isolated shell only | Linux is NOT integrated/verified |

The existing Android UI, navigation and visual assets were not redesigned as part of this bridge checkpoint. This is an intermediate engineering checkpoint, not a parity certification.
