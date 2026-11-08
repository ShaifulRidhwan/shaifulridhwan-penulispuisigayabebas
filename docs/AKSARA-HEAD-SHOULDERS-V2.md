# AKSARA v2 — UNAPPROVED head and shoulder study

This is a real modeled bust, not a finished premium character. It has no armature,
blendshapes, animation, hair physics or Voice integration. Do not merge into main.

## Produced
- A continuous quad surface for head, neck and shoulders.
- Cut eye sockets with connected lid rims; separate eye globes and amber irises.
- Swept volumetric hair locks, scalp and strand ridges.
- Separate sun, crescent, forehead chain, hanging gems and gown ornaments.
- Color and clay GLBs, each 312,380 triangles; nine grouped export meshes.
- Editable Blender 4.3.2 scene with 338 individually editable visible mesh objects.
  Source reconstruction remains hidden for reference. Textures are packed.

The facial relief is a parametric reconstruction guided by the earlier scan and
approved artwork. Facial and gown color use a single front reference projection.
This is NOT a finished multi-view PBR texture set. The back is a provisional design.

## Remaining visual defects
- Face proportions and expression differ from the approved artwork; eyelids need work.
- Hair remains too uniform/stiff, with root/cap intersections and grouped tips.
- Crown filigree/attachments remain simplified.
- Baked lighting, stretched side textures and some overlapping gown motifs remain.
- This is a bust: arms, hands and the full flowing gown are absent.
- No production rig, weights, facial blendshapes, secondary motion or animation.
- No real-time FPS, physical Android test or Gemini Live acceptance claim.

## Verification
GLBs parsed: finite attributes, valid triangle indices, embedded images and buffers.
Color file: 9,290,200 bytes, 27 primitives; clay: 7,800,524 bytes, 9 primitives.
No skins or animations in either file. Clay exports contain no images or colors.
Actual Blender CPU renders checked at front, 35°, profile and back. The exported
color GLB was imported into a fresh Blender scene and rendered independently.
Portable build script executed successfully in Blender. Voice baseline: 41/41
Node tests pass on the existing experimental checkout; production files unchanged.
Cloud-browser GPU rendering and mobile performance remain unverified.

## Editable source
Open AKSARA-head-shoulders-v2-UNAPPROVED.blend in Blender 4.3.2.
The source scene preserves individual hair locks and metal details. GLBs group
these meshes for export; shader/light appearance can differ by renderer.

Rebuild (Blender 4.3.2 binary):
    blender -b --python build-v2.py -- --input-glb aksara-mesh-v1.glb --face-reference aksara-face-clean-source.png --out-dir rebuild
Export:
    blender -b --python export-v2.py -- --blend AKSARA-head-shoulders-v2-UNAPPROVED.blend --out-dir exported

## Texture preparation
Remove only the thin loose hair strands across the bare forehead, eyes, nose and cheeks, and the small gold chain/pendant on bare forehead. Preserve exact framing, aspect ratio, feature positions and identity. Keep other hair, large sun/moon accessories, clothing and backdrop. Used the built-in image editing tool on the approved reference; output is a provisional projection texture, not a new character preview.

## Private experimental review

https://aksara-3d-mesh-review.vinousgazelle2.chatgpt.site

The viewer offers color, clay geometry and the prior candidate. The source ZIP and GLBs are downloadable there. The Site's source repository retains binary assets; this GitHub branch retains construction and export scripts. Audience remains owner-private.
