# AKSARA large-media and compact dialogs · 4 November 2026

## Delivered
- Attachment modal no longer shows the static 3.85 MB / permission paragraph below the buttons. Live recording/progress/errors remain accessible via the same hidden-by-default status region.
- Code Engine modal loses its outdated explanatory footer, but preserves its explicit AI-execution permission checkbox, active Off/Armed/Running status and stop control. Code Engine header, Refresh and actions remain, with runtime list scrolling independently on mobile.
- Accepted **raw source** file sizes: JPEG/PNG/WebP/GIF images up to **64,000,000 bytes** and MP4/WebM video up to **128,000,000 bytes**. Browser video frame extraction samples up to four representative points into bounded JPEGs; short clips yield two frames. Progress and cancellation are supported.
- All original source files remain private in the browser tab, and are not automatically uploaded. After the user presses Send, **only** compressed images or sampled frames are attached to the request. Photo preview and raw video preview use object URLs that are revoked when cleared.
- Video item metadata records sampled-frame count, duration, visualOnly=true, audioAnalyzed=false and rawUploaded=false. Chat context explicitly discloses that full footage/audio was *not* inspected. The interface also shows a persistent warning when staging a sampled video.
- Netlify chat request stays under the original 3.85 MB aggregate media budget and 5.35 MB JSON front-end budget. No changes to backend, Gemini pool, provider routing, Voice Live, memory, Studio or Code Engine sandbox.

## What this does not claim
This is not complete 128 MB video ingestion or audio transcription. Representative-frame analysis can miss movement, speech and details between frames. Unsupported mobile codecs or seek operations must fail with an honest message. Large 64 MB images might fail local decode on low-memory devices and are not promised to fit on every Android browser.

## Future raw cloud-archive architecture (not switched on)
Netlify's synchronous buffered Function payload limit is 6 MB, so raw files cannot be uploaded with one Function request. Native Netlify Blobs is server-side and offers no signed direct browser upload; a production resumable chunk endpoint would require strong authentication, per-owner quotas, chunk integrity, upload sessions with short expiry, cleanup of aborted parts, and a separate storage budget. Never expose an unrestricted anonymous raw upload API on this public web app. Until such a protected store is configured and tested, no raw uploads are attempted. The local preprocessing path is the working default.

## Validation
`node --test tests/aksara-large-media.test.cjs` for boundaries and a simulated 128 MB video source, existing smart-attachments tests, browser audit, runtime health and full CI. Confirm real device decoding on Android after Netlify deploy.
