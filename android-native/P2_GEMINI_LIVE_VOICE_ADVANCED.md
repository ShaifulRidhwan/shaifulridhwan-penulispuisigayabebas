# P2 Gemini Live Voice Advanced (items 26–39)

Corrected scope: P2 is native **Voice**, not generic Web research or XLSX analytics.

| # | Requested capability | Implementation and current evidence |
|---|---|---|
| 26 | Audio Device Selector | Android communication-device picker: automatic, Bluetooth, wired, USB, earpiece, speaker when available |
| 27 | Duplex Route Verification | P0 AudioRecord and AudioTrack observed-device checks preserved; mismatches surfaced instead of hidden |
| 28 | Hot-swap Audio | Device listener and explicit route selection without rebuilding the Gemini Live websocket |
| 29 | Audio Route Diagnostics | Real observed microphone/output labels; route choice and errors; capture format and effects state |
| 30 | Adaptive Audio Pipeline | PCM 16kHz capture uses 20ms wired / 40ms phone / 60ms Bluetooth frames; existing buffered PCM 24kHz playback |
| 31 | Voice Activity Detection | Bounded advisory microphone RMS level; Gemini Live server retains actual turn/endpoint detection |
| 32 | Echo & Noise Control | Existing Android AEC/NS processing; now reports effect availability. Headset/acoustic efficacy requires device QA |
| 33 | Barge-in | Existing Gemini interrupted callback plus explicit PTT hold cuts pending local audio |
| 34 | ASR Confidence Guard | Existing conservative transcript language/script checks. Gemini Live transcriptions supply no reliable numerical confidence |
| 35 | Malay Language Recovery | Existing ms-MY language/style lock and clean epoch-based reconnection on Portuguese, Spanish or script drift |
| 36 | Live Captions | Incoming and outgoing transcripts with CC show/hide; current text is provisional ASR, not certified accurate |
| 37 | Push-to-talk and Hands-free | PTT on/off with long-press capture gate, audioStreamEnd on release; hands-free remains default |
| 38 | Voice Session Recovery | Existing resumption handle, GoAway and bounded retry kept; temporary call focus loss now pauses/resumes audio |
| 39 | Voice Diagnostics & Tests | Added unit tests for frame sizing, capture gating and audio level, plus existing route/recovery tests |

No standalone second Voice engine. Canonical Web Voice Brain assets, Gemini Live broker, Chat/Voice continuity and Netlify production routing remain unchanged.

**Not certified by compilation:** actual Bluetooth 2-way audio, switching physical headsets mid-call, speech/noise separation, call interruption with OEM audio focus, reconnect on cellular/WiFi, end-to-end low latency, and Malay caption accuracy. A debug APK and emulator can confirm basic integration but cannot replace those device tests.
