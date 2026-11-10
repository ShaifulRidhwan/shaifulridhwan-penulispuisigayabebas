# Native premium components

Activated in the existing app and verified on API35 x86_64 in run 42745809439,
implementation ff00c941ee36a4c093b2d2f577c61c731c3c73b6. See STATUS.md for limits.

Arena materials, piece silhouettes and Queen portrait are original procedural
vectors/textures. No temporary sprites or external artwork are used. Sound effects
are original PCM synthesis, reproducible with chess-audio/generate.py. The renderer
reuses a 1024px board plane, 512px original-piece textures, paths, shaders and hit-test
buffers. Every original gradient, silhouette, shadow and effect is retained.
Animations consume committed snapshots and cannot authorize or delay chess moves.

QueenVoice uses offline Malay Android TTS. Actual start/completion callbacks are
recorded in evidence/chess-voice-playback.txt. Missing voices have explicit status
and subtitle fallback; that unavailable-device path is not independently verified
by the successful-voice emulator test. It owns audio focus, effects, cancellation
and shutdown, without borrowing Gemini Live. Physical audio routing and voice
naturalness are unverified. Aoede narration is not implemented. Push-to-talk uses
on-device SpeechRecognizer only and requests permission on explicit user action;
physical Malay recognition remains unverified.

Replay leaves the authoritative session intact. Post-game review re-searches actual
positions and reports centipawn loss only when both searches reach depth >=14;
it does not fabricate accuracy percentages or brilliant labels. Search is bounded,
cancellable and stops for severe thermal state. Opt-in RivalryMemory keeps at most
50 local game records and can reference their actual results, without cloud upload
or a hidden change to engine strength. Comprehensive behavioral profiling remains
outside the delivered basic memory implementation.
