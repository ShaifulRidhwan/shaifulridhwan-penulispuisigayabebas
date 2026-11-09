# P1 Chatbox Premium (Android Native)

On top of P0 Web Brain without duplicating any backend reasoning, model routing or provider policies.

## Delivered code
- Edit an earlier user question to fork an independent conversation at that turn, preserving the original archived branch.
- Regenerate the latest completed assistant answer using its associated user question. Reject unavailable original attachments rather than replaying another question.
- Branch from any completed message; archive session boundaries are tracked with new IDs.
- Export/import conversations as JSON through the Android document picker. Import strictly validates file size, format and roles; it appends after validation, remapping IDs. JSON export is intentionally plaintext and excludes memory notes, raw attachment bytes, signed receipts and secrets.
- Last-response diagnostics expose provider, model, research/tool and evidence metadata only when the backend reported them; restored sessions cannot inherit stale diagnostics.
- Existing conversation and archive search, Markdown source links, Copy, provider health, media picker and stop button are reused.
- Regression tests for branch isolation, media safeguards, export/import boundaries, provider-name sanitation, and invalid files.

## Not yet certified
Physical-device Gemini Live and Bluetooth behavior, actual performance, full 98% visual parity and compatibility of every Android document provider. This APK should be treated as a debug build until those gates are verified.
