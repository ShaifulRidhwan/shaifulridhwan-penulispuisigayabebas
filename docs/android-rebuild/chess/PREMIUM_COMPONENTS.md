# Activated premium candidate

Checkpoint A passed on API35 in GitHub run 42734184090 at source 8f5f0b8.
The premium renderer, portrait, narration, analysis, replay and opt-in memory are
now activated in ChessActivity. Their own Android regression remains required.

Arena materials, piece silhouettes and Queen portrait are original procedural
vectors/textures. No temporary sprites or downloaded artwork are used. Sound
effects are original PCM synthesis, reproducible with chess-audio/generate.py.
Piece paths, shaders, textures, board coordinates and legal targets are reused.
Animations consume committed immutable snapshots; they cannot authorize moves.

QueenVoice uses only offline Malay Android TTS voices. Missing voices produce
clear status/subtitle fallback. It owns transient audio focus, effects, utterance
cancellation and shutdown; it never borrows Gemini Live. Gender/naturalness depend
on the installed voice. Aoede narrative TTS is not implemented. Push-to-talk uses
on-device SpeechRecognizer only, with explicit runtime permission on user input.
There is no cloud game-history, narration or microphone endpoint in this module.

Replay never changes the authoritative session. Post-game analysis re-searches
actual positions and reports centipawn loss only if both completed searches have
depth >=14; no made-up accuracy percentage or unsupported brilliant label is used.
The analysis is resource bounded, cancellable and stops for severe thermal state.
RivalryMemory defaults to disabled and keeps at most 50 local game records if
enabled. It does not claim remembered encounters or secretly weaken the engine.
