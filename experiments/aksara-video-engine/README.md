# AKSARA Video Engine v0.1 — isolated experiment

Status: EXPERIMENTAL. No production integration, no live inference validated.

## Goal
Convert a user-provided image into three sequential 4.5-second Wan 2.2 I2V clips (13.5 seconds total) with a target API cost of RM0. Do not claim this is achievable until tested.

## Gate-based validation
1. Verify the exact upstream Hugging Face Space, its current public API schema, license, uptime and allowed automation; never assume NiftyVid's historical endpoint is still valid.
2. Run a **single** 4.5-second job with a consented test image. Record queue time, actual GPU time, output duration, resolution, aspect ratio, success/failure and any quotas. Never place Hugging Face tokens in source, logs or frontend.
3. Only if stage 2 succeeds, test frame extraction and one second clip. Ensure final-frame-to-first-frame continuity.
4. Only if stage 3 succeeds, test three sequential clips. Stop on rate limits or service errors; do not bypass quotas, rotate accounts or evade limits.
5. Concatenate via a compatible media pipeline, verify MP4 duration with ffprobe, and check for artifacts and abrupt cuts.
6. Assess accessibility, storage cleanup, abuse protection, privacy, provider terms, error handling and usage costs before proposing any production integration.

## Architecture candidate (not implemented)
Studio Antara (image upload) -> isolated Cloudflare Worker -> authorized Space API -> async job state -> final frame extraction -> next clip -> MP4 assembly -> download.

The Worker must enforce image size/type, user authorization, per-user quota, request timeout, cancellation, and safe handling of remote output URLs. Avoid exposing a public unrestricted proxy.

## Acceptance criteria
- 3 verified generated I2V clips, each 4.5 seconds (not zoom/pan of a static image).
- Combined MP4 plays and reports approximately 13.5 seconds.
- No charges incurred, no violation of upstream terms, no credential leaks.
- Existing Studio Antara and other production routes unchanged.

## Stop conditions
- Space is unavailable or disallows intended API use.
- Quota cannot support three jobs.
- Any paid billing requirement.
- Missing content moderation / access controls.
- No stable way to join clips.

## Current status
Branch created; research/implementation and live tests pending. No video generation has been executed.
