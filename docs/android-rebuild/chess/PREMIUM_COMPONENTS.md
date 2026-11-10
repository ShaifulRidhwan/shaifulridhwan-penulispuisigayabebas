# Isolated premium components (not active yet)

ArenaBoardView, QueenVoice and RivalryMemory are compiled source components.
They are not yet activated by ChessActivity: Checkpoint A touch acceptance must
pass first. No Checkpoint B/D completion is claimed by merely adding these files.

Arena materials and piece silhouettes are original procedural graphics in source.
No downloaded artwork or temporary sprites are used. Sound effects are original
PCM synthesis, reproducible with android-native/chess-audio/generate.py.

QueenVoice uses only offline Malay Android TTS voices. It reports missing voices,
falls back to subtitles, owns transient audio focus and shuts down on its owner's
lifecycle. Gender and perceived naturalness depend on the installed voice; Aoede
narrative TTS is not implemented and Gemini Live is not treated as a TTS endpoint.
No game data is sent to a voice/LLM endpoint. Planner tests reject shallow mate
claims and ordinary-move tactical inventions. RivalryMemory defaults to disabled
and keeps at most 50 local game records if enabled.
