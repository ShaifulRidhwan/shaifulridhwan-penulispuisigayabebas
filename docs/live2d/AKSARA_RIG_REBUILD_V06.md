# AKSARA Live2D Rig Rebuild v0.6 · Source and acceptance gate

**STATUS: ART SOURCE CREATED · NEW CUBISM RIG NOT BUILT OR VERIFIED**

## Design lock

Approved raster illustration: dark-fantasy woman with black/blue long hair, golden sun crown on the left, silver-blue moon crown on the right, and ornate black-and-gold/blue gown. Do **not** replace with cartoon/vector art, a stock anime character, a static composited portrait pretending to be animated, or a simple mouth-on-image overlay.

## Diagnosed failure in experimental v0.5

The previous automatic PSD separation and PSD2Live export produced jagged cutouts and texture seams during face/eyelid/mouth changes. Successful exports of `.moc3`, WebGL startup, and 60 FPS checks did **not** prove quality of anatomy, hidden painting, or keyform deformation. A flattened original portrait **cannot** be made into a professional rig merely by polygon masking, texture enlargement, or generic deformation.

## Work produced in v0.6

A separate source handoff package has been generated outside this repository from the approved 1086 × 1448 illustration:

- 23 independent raster layer sources in a layered Photoshop PSD (eyes, lids, irises, brows, lips, one coherent face, rear/front hair, neck, dress and celestial ornaments).
- Original design reference, individual alpha PNGs with offsets, a composited reconstruction check and a +3px offset/occlusion check.
- A reproducible build script for **art separation only** and a list of identified weaknesses.

The package is supplied as a conversation attachment. It is **not** automatically pushed to GitHub, and is not a finished `.cmo3` or `.moc3`.

## Actual Cubism Editor work required before any new model export

1. Repaint hidden skin behind both eyes, inner mouth and eyelids. For lips, author closed, half-open and open mouth drawings with cheeks/philtrum transition; opacity-swapping a black ellipse is unacceptable.
2. Repaint the *behind-face* hair and neck around both jaw edges. The current automatic art-source preview still has gaps here. Fix them before any deformation.
3. Bind all facial pieces to ONE head rotation deformer. Keyform left/right and up/down head transforms explicitly, including ear/neck/ponytail attachment.
4. Create true mesh eyelid 0/50/100% poses, eyebrow movement, eye tracking and consistent cheek response. No static eye layer may show through blink.
5. Rig hair root and moon/sun crowns to head (different secondary physics to tips only). Ensure no independent sprite drifts off the portrait.
6. Export `.moc3` and `.model3.json` only after visual inspection inside Cubism Editor.

## Pass criteria (all mandatory)

- Neutral pose looks like the approved original.
- For slow ±4° head motion: **zero black triangles, zero exposed alpha holes**, no duplicate face/eyes/hair and no detached jaw.
- Blink: eye completely closed without old iris visible, with smooth eyelid arcs and no blurred skin patch.
- Speech: 4 viseme-like mouth poses do not float above or detach from cheek/jaw.
- Sun/moon crowns and earring chains remain anchored.
- 10–15 s mobile and desktop recordings manually inspected. Playback must also be tested with live Aoede (not simulation only).
- No merge into `main` before owner visual approval and Live2D AI/chatbot distribution licence review.

## Protection of existing Voice Chat

This branch inherits experimental v0.5 code for reference; the original Voice Chat/Gemini Live transport, Aoede, controls, and main branch remain unchanged. No auto-generated rig should replace the existing one without these visual quality gates.

**Important:** This document is a truthful handoff/status file. It does not imply that the new art has been hand-repainted or that a production-grade Cubism rig has been completed.
