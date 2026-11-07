# AKSARA local CPU reconstruction experiments

These scripts attempt **actual dimensional mesh reconstruction**, locally, from
the approved reference. They do not call a paid inference API or a ZeroGPU demo.
They do **not** create a finished premium character, production rig or Voice UI.
Do not connect either unapproved result to production.

## Tested platform

- Linux x86-64, Python 3.12, 9 reported CPU cores, approximately 9.7 GiB RAM.
- CPU PyTorch 2.6.0 and torchvision 0.21.0.
- Portable Blender 4.3.2; background Cycles CPU rendering was actually verified.
- Hunyuan's CPU test uses BF16 to reduce memory; this host reports AVX512 BF16
  support. This is a test-specific port configuration, not a performance promise
  for all CPUs.
- A network connection is required to download public code/weights initially.
  The model inference runs locally. Neither a user login nor an inference
  service balance was used in these tests.

## Upstream sources

| Component | Pinned source |
| --- | --- |
| TripoSR | https://github.com/VAST-AI-Research/TripoSR at `107cefdc244c39106fa830359024f6a2f1c78871` |
| TorchMCubes | https://github.com/tatsy/torchmcubes at `a9ac95aa329957ba646e7bb057f825f5dfa77f38` |
| TripoSR weights | https://huggingface.co/stabilityai/TripoSR (`config.yaml`, `model.ckpt`) |
| Hunyuan3D-2 | https://github.com/Tencent-Hunyuan/Hunyuan3D-2 at `f8db63096c8282cb27354314d896feba5ba6ff8a` |
| Hunyuan mini Turbo weights | https://huggingface.co/tencent/Hunyuan3D-2mini/tree/main/hunyuan3d-dit-v2-mini-turbo (`config.yaml`, `model.fp16.safetensors`) |
| Hunyuan matching Turbo decoder | https://huggingface.co/tencent/Hunyuan3D-2mini/tree/main/hunyuan3d-vae-v2-mini-turbo (`config.yaml`, `model.fp16.safetensors`) |
| Blender | https://download.blender.org/release/Blender4.3/blender-4.3.2-linux-x64.tar.xz |

Upstream code and model licenses remain applicable. No vendor model/code is
being represented as authored by AKSARA. Weight revisions should be recorded
with file hashes when archiving a run; large checkpoints are not stored here.

## Running a reconstruction

Create separate Python environments for the two models. The two requirements
files record the environments used in the experiment. CPU Torch wheels come
from https://download.pytorch.org/whl/cpu. Build TorchMCubes with the actual
available compiler; this host required explicit CMake C/C++ compiler settings
because its inherited compiler name was unavailable:

```sh
uv pip install --python /absolute/tripo-env/bin/python --no-build-isolation \
  --config-setting cmake.define.CMAKE_CXX_COMPILER=/usr/bin/g++ \
  --config-setting cmake.define.CMAKE_C_COMPILER=/usr/bin/gcc \
  git+https://github.com/tatsy/torchmcubes.git@a9ac95aa329957ba646e7bb057f825f5dfa77f38
```

Run the TripoSR wrapper using local source and weights:

```sh
/absolute/tripo-env/bin/python -I -u triposr-cpu.py \
  --repo /absolute/TripoSR --weights /absolute/triposr-weights \
  --image /absolute/approved-art.webp --output /absolute/tripo-output \
  --resolution 256
```

Run the Hunyuan wrapper using its own environment:

```sh
/absolute/hunyuan-env/bin/python -I -u hunyuan-cpu.py \
  --repo /absolute/Hunyuan3D-2 --weights /absolute/hunyuan-mini-turbo-weights \
  --image /absolute/approved-art.webp --output /absolute/hunyuan-output

/absolute/hunyuan-env/bin/python -I -u decode-hunyuan-cpu.py \
  --repo /absolute/Hunyuan3D-2 --vae /absolute/hunyuan-mini-turbo-vae \
  --latent /absolute/hunyuan-output/shape-latent.pt \
  --output /absolute/hunyuan-decoded-output
```

The Hunyuan sampler exits after saving the latent. A separate decoder process
uses the **matching Turbo VAE** with float32 surface queries. This avoids
holding the diffusion model in RAM during decoding and avoids the initial
experiment's unmatched decoder/BF16 surface precision problem. That initial
mesh was visually rejected; its decoder path is not the default in this code.
Geometry-only output is not a
textured character. TripoSR outputs learned vertex colors, not a high-resolution
UV texture set. Neither wrapper adds bones, fake mouth overlays or unrelated
stock characters.

Inspect exported geometry with Blender:

```sh
/absolute/blender --background --factory-startup --python inspect-geometry.py \
  -- /absolute/candidate.glb /absolute/inspection-output triposr
```

Use `hunyuan` instead of `triposr` for the second coordinate convention; inspect
the actual camera orientation rather than treating a filename as proof of the
front view. The renderer binds existing vertex-color data when a GLB omits a
material, renders four static viewpoints, and saves an editable scene. This is
mesh inspection, not an animation or a functioning Voice avatar.

## Acceptance

TripoSR completed reconstruction and exported a real GLB: 74,240 vertices,
148,224 triangles, 2,967,552 bytes. Geometry was finite and face indices valid.
**Visual result rejected:** soft face/eyes, fused hair/clothing, malformed crown
details, no separate functional eyelids/jaw/eyes or full-body gown. Counts and
successful file exports do not override that result.

See the main audit and run metadata for the latest Hunyuan outcome. No source
runtime in Bilik Antara was changed by these experimental scripts. Existing
Voice baseline tests are not evidence of animation quality for these outputs.

The corrected matching Turbo VAE/float32 decode and the separate voxel/smoothing/decimation candidate also completed and were visually rejected. The repaired candidate is 149,382 vertices / 299,902 triangles. `repair-mesh-candidate.py` is an inspection experiment, not an accepted character-production step.
