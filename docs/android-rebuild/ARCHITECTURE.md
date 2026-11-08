# Native rebuild architecture

The application renders its primary UI with Compose. There is no WebView, TWA, PWA container, embedded HTML UI or web route used as the main application. The web repository and its deployments are unchanged.

- `app/core/design`: extracted tokens, original image/font resources, native text and sampled backdrop blur with Haze. Blur is applied to captured background content, not to the foreground text.
- `app/core/network`: OkHttp NDJSON and JSON adapter for the existing same-origin public backend contracts. API keys stay server-side. Ephemeral Voice tokens are kept only in memory.
- `app/core/storage`: AES-GCM file storage with Android Keystore, atomic writes, backup disabled and bounded history. An unreadable original session is preserved rather than overwritten.
- `app/core/platform`: Android Storage Access Framework and bounded binary/text attachment handling.
- `app/feature/chat`: Flow/ViewModel state, interruption preservation, Markdown, original local identity/journey content and explicit restore of saved conversation.
- `engine/runtime`: lazy bound Android isolated-process service for Rhino JavaScript, platform SQLite queries and the actual Android `/system/bin/sh`. It inherits neither application private-file access nor application network permission. Execution/output budgets prevent unbounded processes. An Android shell is not a full Linux distribution or a PTY.
- `engine/voice`: lazy Gemini Live WebSocket/AudioRecord/AudioTrack integration using the original token broker, returned model and locked Aoede voice. Native audio focus, echo cancellation where available, microphone/speaker controls, bounded playback and lifecycle shutdown are implemented. It does not yet reproduce every web recovery/tool/preference behavior.
- `visual-tests`: measured browser references, instrumented native screenshots and per-component SSIM/MAE comparison with side-by-side and heatmap artifacts.

# Addendum constraints

There is no artificial APK size ceiling. Original assets and runtime capabilities may justify a large installation. Expensive modules initialize only when invoked. The initial minSdk is 31 so the supported UI always has native RenderEffect backdrop rendering. Lower Android versions are not silently given an opaque substitute.

Full Linux userland, native 3D Game Aksara, the 3D voice avatar, Python/TypeScript/C++ native runtimes and isolated Security Lab workflows remain separate integration work. They have not been replaced by simulations, browser wrappers, decorative green statuses or claims of completion. Their implementation must follow primary UI acceptance, per the addendum's priority order.

No foreground microphone service is created: voice stops when the app leaves the foreground. No idle engine or background inference loop runs at startup. Final performance acceptance requires the measured emulator/device evidence; storage size is not a proxy for RAM use or startup performance.
