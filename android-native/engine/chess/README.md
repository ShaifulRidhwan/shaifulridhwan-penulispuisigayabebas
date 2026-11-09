# AKSARA chess foundation

Pure Java module, isolated from Chat, Voice, Studio and the existing Phaser game.
Not yet wired into the application: Checkpoint A needs Android runtime proof.

`ChessSession` validates UCI against generated legal moves, exports SAN PGN,
tracks claims separately from automatic draws, preserves history in versioned
local saves and rejects stale search results using a monotonic revision plus FEN.
The caller owns pause/clock/persistence and decides whether undo is permitted.
`canClaimWith` validates an intended-move claim without playing it.

`UciEngine` serializes full-strength search off the UI thread, bounds threads/hash
and thinking time, validates Stockfish 19 identity and validates bestmove against
legal moves. Use `cancel()` on restart, undo, exit or background; pass returned
revision/FEN to `applyEngine`. Close the engine when its owner is destroyed.
Scores are side-to-move-relative, not White-relative. Bound scores are discarded
as dialogue evidence. There is no LLM move selection or fallback weak engine.
Create a new driver/process after close or engine failure.

Run `:engine:chess:test` from the Android Gradle root. Set
`AKSARA_STOCKFISH_HOST=/absolute/path/to/stockfish` to enable real host engine
integration tests; otherwise JUnit marks that test skipped. Android instrumentation
is still required and cannot be replaced by this host test.

Known gaps: arbitrary dead positions involving blocked pawns are not adjudicated;
FEN validation is currently structural plus king count, not complete reachability
validation; restored local saves are trusted for declared claim/agreement results;
no clock, Android packaging, UI, voice or app dependency is included yet. API 31
compatibility/desugaring of the Java 17 API surface must be checked at integration.
