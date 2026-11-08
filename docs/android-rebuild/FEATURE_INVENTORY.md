# AKSARA Android native — feature coverage inventory

Checkpoint: native feature integration, beginning after UI-first v1 preview. This document distinguishes actual implementation from planned work. No screen is called complete merely because it renders.

| Feature in Bilik Antara / ecosystem | Native status | Verification requirement |
| --- | --- | --- |
| Chat, streaming, markdown, multi-provider status | Existing implementation | Real-device streaming, session recovery and provider failure QA |
| Voice Chat / Gemini Live + native 3D avatar | Existing partial implementation | Real mic/provider session, audio state, speaker/mute, animation and phone GPU |
| Liquid Glass, rounded screen insets, dialog/navigation | Existing visual foundation | Human review plus matching screenshot captures |
| Code Engine: JavaScript | Implemented in isolated runtime; manual self-test wired | Execute sample and arbitrary sandboxed code, error/timeout recovery |
| Code Engine: SQLite | Implemented in isolated runtime; manual self-test wired | Query, timeout and isolation tests |
| Code Engine: Android shell | Implemented in isolated runtime; manual self-test wired | Command execution and process cancellation (not Linux userland) |
| Code Engine: Python, HTML/CSS, TS, C++ | NOT IMPLEMENTED natively | Real bundled compiler/runtime required, no fake green status |
| Terminal and Code Workspace | Existing native editor/console | Keyboard, command output, sandbox and cancellation QA |
| Perpustakaan AKSARA original poetry | New native offline asset and reader/search | Asset schema and on-device reader QA |
| Novel Antara Cahaya dan Gelap | New bundled verbatim source and section reader | Compare all section/paragraph counts, reader scrolling & state |
| Studio Antara FLUX Cloud | New native HTTP client/UI, same Netlify Studio endpoint | Real successful inference, quotas, model/ratio, save-to-gallery QA |
| Studio SD-Turbo offline | NOT IMPLEMENTED | Compatible quantized model, GPU backend, RAM/performance, offline inference proof |
| Studio OVH Beta | New client option to existing backend | Backend is best-effort; do not claim availability without actual generation |
| Pusat Rujukan / Wikipedia / URLs | Chat-backed native tools; actual prompt routes | Grounded sources and successful URL reads by existing backend |
| Pusat Rujukan / Calculator | Local JS sandbox execution | Real expression and injection tests |
| Prestasi A.I. | Native memory/PSS & provider status UI | On-device measurement, no synthetic counters |
| Sesi & Sejarah | Existing encrypted archive restore & screen clearing | Rotation/restoration, data loss/rekey tests |
| Lampiran | Existing system document picker, media payload bounds | Supported MIME + backend validation |
| Security Lab | New passive HTTPS header analyzer | Permitted public endpoints; no exploit/scanner functionality |
| Game Aksara | NOT IMPLEMENTED (3D avatar preview is NOT a game) | Actual game asset rig, gameplay controls, GPU/performance QA |
| Linux userland/Termux-like | NOT IMPLEMENTED (Android sh is NOT a distro) | ABI/runtime, executable filesystem and Android sandbox architecture |
| Privacy and settings | Existing encrypted session UI | Settings actions, backup/restore, privacy disclosures |
| Model management, diagnosis, news/research | Backend chat tools exist; native dedicated UI incomplete | Contract inventory and realistic native integrations |

What this milestone does:
- Retain the established Liquid Glass native Compose shell.
- Route existing Portal items to concrete native implementations instead of placeholder messages.
- Bundle the project's original literary data into the APK for offline reading.
- Connect Studio to a real existing API without bundling secret provider keys.
- Provide runtime health statuses from actual execution, not nominally listed language names.
- Preserve the original PR and branch. No Google Play preparation.

What it does not do:
- It does NOT claim 100% pixel parity, a verified SD-Turbo offline model, Termux/Linux userland, full 3D gameplay or all-language compilation.
- It does NOT claim the cloud backend successfully generated an image until actually tested end-to-end.
- It does NOT replace normal QA with a green compile check.

Next engineering work: device-run functional test, finish UI regressions, full-screen native Studio/reader navigation, per-file attachment types, export/restore of archived sessions, richer code runtimes, isolated Linux and 3D game engine, offline model compatibility tests.
