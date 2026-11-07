# AKSARA: actual RM0 local CPU reconstruction results

Date: 2026-11-08. Experimental branch only. No production changes or merge.

## Outcome

**A local route successfully produced genuine 3D GLB geometry without user
login, ZeroGPU quota or a paid inference API. It did not produce the requested
finished premium AKSARA character.**

Portable Blender 4.3.2 is now installed and a Cycles CPU render was verified.
The initial audit's unavailable-Blender limitation has therefore been resolved.
Model execution uses CPU PyTorch 2.6.0 on this host, with 8 inference threads.
Code, weights and dependencies were downloaded from public upstream sources;
no credentials were entered and no paid generation was submitted.

Implementation and pinned environments are in
`scripts/experimental/aksara-local3d/`. Source weight file hashes are recorded
there. Multi-gigabyte dependency/model downloads are not committed.

## Runs actually completed

| Run | Actual output | Measured time | Assessment |
| --- | --- | --- | --- |
| TripoSR CPU, grid 256 | GLB v2, 74,240 vertices, 148,224 triangles, 2,967,552 bytes; learned vertex colors; no UV texture set | Model load 18.757 s; input preparation 18.180 s; inference 11.319 s; extraction 22.517 s | Rejected: soft face/eyes, fused hair/cloth, malformed crown details. |
| Hunyuan mini Turbo sampler, BF16 CPU | Saved real shape latent, seed 1987, five diffusion steps | Model load 27.565 s; conditioning/sampling 203.216 s | A latent is not a character or mesh. |
| Initial Hunyuan mesh decode | 866,441 vertices, 2,068,168 triangles; no materials/textures/rig | Decode 188.007 s | Rejected: extensive holes/fragmentation. The experimental decoder did not match the official Turbo VAE replacement path and used BF16 surface values. |
| Corrected matching Turbo VAE, float32 CPU decode | 958,122 vertices, 2,237,008 triangles; no textures/rig | VAE load plus decode 87.527 s | Rendered from front, quarter, profile and back. Still rejected: fragmented hair/crown, inaccurate detail and incomplete face/eye construction. The correction does not establish visual acceptance. |

The initial unmatched Hunyuan decoder is not shipped as the normal source path.
The sampler now saves a latent and exits; `decode-hunyuan-cpu.py` runs a separate
process with the matching `hunyuan3d-vae-v2-mini-turbo` decoder and float32
surface evaluation. This also releases sampler memory before reconstruction.

## Geometry repair experiment

A separate, explicitly unapproved candidate applies volumetric remeshing,
gentle surface smoothing and an approximately 300,000-triangle inspection
budget. This changes small features and must be inspected against both the raw
mesh and the reference. It is not automatic recovery of the original character
and it does not supply missing eye/lip topology, separate hair, or a skeleton.
Final repair candidate: **149,382 vertices and 299,902 triangles**. It was rendered from all four views and still rejected: fragmented/fused hair, inaccurate face/eye/crown detail and no functional anatomical controls. Run metadata records those counts.

## Verified and unverified

- Exported GLBs have real 3D depth. TripoSR vertices were finite and its face
  indices valid. Neither result is a plane carrying the reference artwork.
- Actual geometry was imported and rendered in Blender CPU from four views.
  Editable Blender inspection scenes were saved. These are geometry renders,
  not screenshots of a working animated Voice avatar.
- Raw outputs are not watertight. The initial Hunyuan output had 1,250 mesh
  components. High triangle counts did not establish coherent topology.
- The reference is an upper-body portrait. These reconstructions are busts,
  not approved full-body gown designs.
- No facial blendshapes, mouth interior, functional eyeballs/eyelids, hair or
  gown controls, accessory physics, skeletal motion or lip-sync was built.
- No new animated preview was deployed. No Android/WebGL FPS, device audio or
  real Gemini Live regression was measured for these candidates.
- Existing Voice baseline tests previously passed 41/41. Production runtime
  files remain unchanged; that baseline is not visual acceptance of these meshes.

## Remaining work

The cost/access blocker has a demonstrated local alternative. The remaining
blocker is **character asset quality**: controlled anatomical topology,
separate detailed eyes/lids/lips and mouth cavity, rebuilt hair volumes and
strands, modeled gown and celestial ornaments, authored UV/PBR materials and
then the complete deformation rig. Automatic reconstruction output cannot be
represented as those finished assets.

Keep every candidate unapproved and experimental. Do not merge or replace the
live avatar with these meshes.
