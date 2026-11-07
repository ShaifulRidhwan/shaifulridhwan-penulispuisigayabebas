"""Decode a saved shape latent with the matching Turbo VAE in float32."""
import argparse
import json
import sys
import time
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--repo', type=Path, required=True)
p.add_argument('--vae', type=Path, required=True)
p.add_argument('--latent', type=Path, required=True)
p.add_argument('--output', type=Path, required=True)
a = p.parse_args()
sys.path.insert(0, str(a.repo.resolve()))
import torch
from hy3dgen.shapegen.models.autoencoders import ShapeVAE
from hy3dgen.shapegen.pipelines import export_to_trimesh

torch.set_num_threads(8)
torch.set_num_interop_threads(2)
torch.set_default_dtype(torch.float32)
a.output.mkdir(parents=True, exist_ok=True)
start = time.monotonic()
vae = ShapeVAE.from_single_file(str(a.vae/'model.fp16.safetensors'),
    str(a.vae/'config.yaml'), device='cpu', dtype=torch.float32, use_safetensors=True)
vae.eval()
vae.enable_flashvdm_decoder(enabled=True, topk_mode='merge', mc_algo='mc')
latents = torch.load(a.latent, map_location='cpu', weights_only=True).float()
print('TURBO_VAE_FLOAT32_READY', round(time.monotonic()-start,3), flush=True)
with torch.inference_mode():
    latent_features = vae(latents / vae.scale_factor)
    output = vae.latents2mesh(latent_features, bounds=1.01, mc_level=0.0,
                             num_chunks=4000, octree_resolution=256, enable_pbar=True)
    mesh = export_to_trimesh(output)[0]
if mesh is None:
    raise RuntimeError('No mesh was decoded')
mesh.export(a.output/'aksara-hunyuan-turbo-float32-unapproved.glb')
info = {'status':'unapproved-geometry-only-no-rig', 'device':'cpu',
    'decoder':'hunyuan3d-vae-v2-mini-turbo', 'decoderDtype':'float32',
    'latentSource':str(a.latent), 'seconds':round(time.monotonic()-start,3),
    'vertices':len(mesh.vertices), 'triangles':len(mesh.faces),
    'bounds':mesh.bounds.tolist(), 'extents':mesh.extents.tolist(),
    'hasTextures':False, 'hasRig':False, 'visualApproval':False}
(a.output/'metadata.json').write_text(json.dumps(info,indent=2))
print(json.dumps(info),flush=True)
