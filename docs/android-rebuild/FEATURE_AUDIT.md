# Feature audit — acceptance is still open

Updated during implementation. A source implementation is not automatically a verified feature. This table must be reconciled with the latest successful workflow before release.

| Feature | Current classification | Evidence / limitation |
|---|---|---|
| Production baseline | Implemented and verified | Cloudflare production HTML equals the baseline build byte-for-byte; 360/390/412 web screenshots and computed-style JSON captured in run 42456898333. |
| Native Compose shell and initial chat | Implemented but unverified | Original artwork/fonts and measured geometry; native screenshot comparison is required. |
| Glass/blur primitives | Implemented but unverified | Haze samples actual content layers; saturation, gradients, clipping and shadow parity still require comparison. |
| Connection providers | Partially implemented | Real backend health contract probed; four provider rows. Per-key Gemini rows and all diagnostics are not yet reproduced. |
| Chat HTTP / NDJSON | Implemented but unverified | Unit tests and emulator integration must pass on final source. Live endpoint returned Gemini reply to 6×7; that response contained `start` and `done`, no token deltas. |
| Routing | Partially implemented | Delegated to existing server; native errors/cancellation are handled. Complete web auto-retry/cooldown behavior not yet reproduced. |
| Local identity / journey | Implemented but unverified | Original 30-step content is exported from the web source. Provider handoff follows explicit free-form messages. |
| Markdown | Implemented but unverified | Native Markwon TextView with DM Sans and tables. Full web formatting parity not yet measured. |
| Attachments | Partially implemented | SAF text, image/audio/video/PDF inline data. DOCX extraction, camera/recording, video sampling and large media preprocessing are outstanding. |
| Persistent sessions | Partially implemented | Encrypted local current conversation, explicit restore and clean welcome; multi-session archive search/import/export remains outstanding. |
| Voice audio | Implemented but unverified | Same broker, returned Gemini model, Aoede, real microphone/playback, mute/speaker/volume. No physical microphone/backend round trip verified. |
| Voice recovery / preferences | Partially implemented | Foreground lifecycle stops audio. Web resumption, extended tools, all dialect choices and renew/fallback logic remain outstanding. |
| Voice UI / 3D avatar | Partially implemented | Permission preflight and controls exist; active-screen parity and native avatar are not complete. |
| JavaScript | Partially implemented | Actual Rhino execution, no Java globals, instruction timeout unit tests passed in run 42457988436. Isolated Android execution requires emulator evidence. |
| SQL | Implemented but unverified | Native ephemeral SQLite query execution. Persistent database workspaces are outstanding. |
| Terminal | Partially implemented | Actual Android shell in isolated UID. Not a PTY, full project filesystem or full Linux userland. |
| Python / TypeScript / C++ | Blocked | Native engine packages and validated isolation have not been integrated. They are not marked Ready. |
| HTML/CSS preview | Blocked | No browser preview is disguised as native rendering. Proper isolated web-content preview is still outstanding. |
| Studio Antara | Blocked | Backend contract identified; native page and full UI/function integration remain outstanding. |
| Portal | Partially implemented | Native navigation and principal measured overlay; integrated destinations remain incomplete. |
| Knowledge / performance / privacy tools | Partially implemented | Basic privacy/connection disclosure only; full production tool interfaces are not complete. |
| Novel / library | Blocked | Native reader integration remains outstanding. |
| Linux userland | Blocked | Rootfs, native execution/PTY integration, licensing, updates and Android isolation must be implemented and tested. Android sh is not classified as this feature. |
| Game Aksara | Blocked | Native 3D engine, game assets, gameplay and lifecycle verification remain outstanding. |
| Security Lab | Blocked | Native isolated authorized test environments have not been implemented. |
| Visual regression | Partially implemented | Real web references, native capture tests and failing-on-mismatch comparison. No similarity score until paired captures exist. |
| Physical device QA | Blocked | No physical Android device attached. |
| APK installation / performance | Implemented but unverified | CI collects APK bytes, installed footprint, cold-start, PSS and crashes; values must come from an actual successful emulator run. |
