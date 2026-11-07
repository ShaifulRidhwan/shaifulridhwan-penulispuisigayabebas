# AKSARA Voice premium 3D rebuild: P0 blocked

Date: 2026-11-08 (Asia/Kuala_Lumpur)

**This is an audit, not a completed character or a working avatar preview.**
No production files have been changed. Do not merge this experiment.

## Evidence inspected

| Source | Inspected revision / evidence | Finding |
| --- | --- | --- |
| `main` | `b2b98f78f328cb2227bc06de8a9d37aa6e821e3f`, 356 tracked files | No tracked `.blend`, `.glb`, `.gltf`, `.fbx`, `.obj`, `.vrm` or `.psd` assets. |
| PR #263 | `ec33aa2363e6d1011a05255d384e77be5f3680e2`; PR description; PSD generator; asset inventory | Contains Cubism assets, not a volumetric 3D character. Its history records an opaque full-portrait layer overlapping moving facial/hair layers. The PSD generator derives masks from flattened art; this does not reconstruct 3D anatomy. |
| PR #264 | `20c67f56e9546cfc99779fcd13e5d7ef6891b7ae`; PR description; asset inventory | Layered-source experiment explicitly reports jaw/hair occlusion gaps and unfinished manual rigging. No 3D model. |
| PR #265 | `1446366033f9f6573a8059b2aaca581d50bebb33`; patch; skeletal controller | Drives real humanoid bones but loads an external Ready Player Me brunette example. It does not build AKSARA's mesh, face, hair, dress or ornaments. No hair/cloth/accessory simulation is implemented in that controller. |
| Attached `94041.mp4` | H.264 576 x 1024, 30 fps, duration about 22.57 s; sampled frames across the clip | Shows Blender pose controls, dense face/hair controls and coherent posed/rendered motion of a different character. A screen recording supplies neither that character's geometry nor its bone weights, shape keys, constraints or physics implementation. Exact simulation details cannot be established from the recording. |
| Attached `93932.png` | 710 x 1536 Voice Chat composition | Approved visible identity: black/navy long hair, amber eyes, fitted dark high collar, gold trim, chest sun/moon emblem, asymmetric celestial crown, star earrings, warm left light and cool right light. This is a UI screenshot rather than a texture set or full-body turnaround. |

## Actual P0 blocker

The available references are enough to describe the visible artistic direction.
They are not an editable 3D asset. Reconstructing hidden surfaces from one view
is possible as an artistic interpretation, but that interpretation has not been
modeled or approved here. A single image is not inherently impossible to model.

In this execution environment, neither the Blender executable nor Python `bpy`
is installed. The connected tools do not currently supply a character modeling
or image-to-3D operation callable in this session. Installing Blender alone would not create the detailed
mesh, topology, textures or facial deformations. No attempt is being represented
as a finished premium character.

Discovery found **fal**. The user subsequently connected it, and plugin discovery
now confirms `installed: true`. Its official API documents image-to-3D generation
and a separate humanoid rigging endpoint. Rechecking the available action
registry and cloud skill catalog still exposed no callable fal generation
operation in this session. No generation request was sent. This is an action
availability limitation, not evidence that the user's connection failed.
These capabilities offer a possible mesh starting point, not proof of identity
fidelity, facial blendshapes, independent hair/cloth physics or final quality.
The exact operations exposed by its ChatGPT connection remain unavailable here.
Browser access is a possible fallback requiring the user's approval under the
browser-access rules; it has not been initiated.

## Inputs still needed versus assets still to create

The user is not being asked to supply a finished character as a substitute for
the requested build. There are two distinct requirements:

| Requirement | Purpose / current status |
| --- | --- |
| Access to a usable character modeling pipeline | The immediate execution blocker. An image-to-3D connection could provide an initial mesh for inspection; further editing and rigging tools are still needed if its output is inadequate. |
| Clean high-resolution approved portrait, without UI | Preferable reference for eye, face, hairline, crown and material details. The attached screenshot remains the identity reference until replaced. |
| Full-body front, profile and back design | Currently unspecified. The lower gown, side/back crown, rear hair volume and obscured shoulder/body anatomy need to be designed and approved, rather than claimed as recovered facts. A turnaround helps but is not a prerequisite to attempting a rough reconstruction. |
| Editable coherent 3D geometry | Still to create: dimensional head/neck/shoulders/body, eyes with eyelids, lips with a mouth cavity, separate hair masses, gown, trim and ornaments. No image cards replacing the face/body. |
| UVs and materials | Still to create: skin/eye/lip detail, hair strands, embroidery, metallic trim and blue gems; base color, normal and material channels appropriate to each surface. Do not bake the screenshot's UI or fixed cinematic highlights into facial textures. |
| Complete deformation rig | Still to create: weighted skeleton, facial shape keys, eyes/lids/jaw controls, hair and gown chains/collision setup, anchored sun/moon and earring motion. Names alone do not establish working deformation. |
| Exported runtime assets | Still to create: character GLB with skinning/morphs, documented control mapping, motion clips and runtime secondary-motion configuration. Editable Blender source is not available. |

## Reuse and discard decisions

- Reuse the existing Gemini Live transport, Aoede selection, microphone,
  speaker, mute, end-call, volume, language and Thinking Mode controls.
- Reuse `window.AksaraVoiceAudio.analyser` as a read-only playback source.
  In `bilik-antara-voice.js`, scheduled buffer sources feed the analyser,
  which feeds the volume gain and destination. It measures pre-volume output,
  not microphone input and not post-volume audible loudness. At volume zero,
  a future adapter must deliberately choose whether to show silent speech.
- Replace frame-dependent fixed-factor lip smoothing with elapsed-time
  attack/release smoothing when implementing the new adapter. Silence,
  interruption, analyser replacement and disposal need explicit coverage.
- Treat #265's additive bone-controller concept as reusable only after mapping
  and deformation checks against the actual new skeleton. Do not import its
  unrelated model, simulated speech demo or Ready Player Me-specific framing.
- Discard cropped-image layers, accessory sprites, static portrait backplates
  and procedural mouth overlays as approaches to the requested 3D character.
- Do not infer phonemes from amplitude or a spectral ratio. No phoneme-aligned
  data source was established in this audit.
- Preserve authored material properties. The existing avatar renderer applies
  common roughness/metalness values to meshes; that treatment is inappropriate
  for a new character's individually authored skin, hair, cloth and metal.

## Verification actually run

Command at the audited `main` revision:

```sh
node --test tests/aksara-voice-v3.test.cjs tests/aksara-voice-3d-ui-experiment.test.cjs
```

Result: **41 tests passed, 0 failed, 0 skipped**. These are existing Node
regression tests, including source assertions. They do not verify real Gemini
audio, device permissions, visual quality, rendering speed or Android behavior.
No runtime source was modified in this branch.

## Acceptance and deliverable status

| Deliverable | Current verified status |
| --- | --- |
| Experimental branch and draft PR | Audit-only branch; PR link is supplied at handoff. |
| Actual animated AKSARA preview URL | Not produced; no substitute demo deployed. |
| Character GLB / editable Blender project | Not produced. |
| Rig, facial deformations and motion assets | Not produced. |
| Integrated premium character in Voice Chat | Not implemented. |
| Desktop/mobile screenshots of the new character | Not produced. Reference frames are not output screenshots. |
| New-character animation demonstration | Not produced. The supplied video is not our demonstration. |
| New-character FPS / GPU / memory results | Not measured; no character exists to benchmark. |
| Real Android / Gemini Live lip-sync | Not tested. |

P0 must pass visible identity review in front, three-quarter and profile views
before P1-P4 can be accepted. Then inspect extreme blink/jaw/head/shoulder
poses; head/hair/gown/ornament continuity; speech interruption and silence;
listening/thinking/speaking transitions; lifecycle cleanup; and real desktop
and Android rendering. Record frame-time distributions, draw calls, triangles,
texture/memory budget and the actual test device. A 60 fps target is not a test
result. No Battery Mode is proposed.

## Primary technical references

- https://threejs.org/docs/pages/GLTFLoader.html
- https://threejs.org/docs/pages/AnimationMixer.html
- https://docs.blender.org/manual/en/4.4/addons/import_export/scene_gltf2.html
- https://fal.ai/models/fal-ai/meshy/v6/image-to-3d/api
- https://fal.ai/models/fal-ai/meshy/rigging/api

No automatic body-rig claim should be treated as evidence of a complete facial,
hair, cloth or ornament rig. Visual approval remains required; no merge.
