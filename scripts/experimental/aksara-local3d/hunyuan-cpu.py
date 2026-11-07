"""Unapproved geometry-only Hunyuan mini Turbo experiment on CPU."""
import argparse
import json
import sys
import time
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--repo', type=Path, required=True)
p.add_argument('--weights', type=Path, required=True)
p.add_argument('--image', type=Path, required=True)
p.add_argument('--output', type=Path, required=True)
a = p.parse_args()
sys.path.insert(0, str(a.repo.resolve()))
import numpy as np
import rembg
import torch
from PIL import Image
from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline

torch.set_num_threads(8)
torch.set_num_interop_threads(2)
# Keep the 1.9B combined checkpoint within this machine's RAM during loading.
torch.set_default_dtype(torch.bfloat16)
a.output.mkdir(parents=True, exist_ok=True)
t = time.monotonic()
print('LOAD_HUNYUAN_CPU_BFLOAT16', flush=True)
pipeline = Hunyuan3DDiTFlowMatchingPipeline.from_single_file(
    str(a.weights / 'model.fp16.safetensors'),
    str(a.weights / 'config.yaml'),
    use_safetensors=True, device='cpu', dtype=torch.bfloat16,
)
print('MODEL_LOADED_SECONDS', round(time.monotonic() - t, 3), flush=True)
session = rembg.new_session('u2net', providers=['CPUExecutionProvider'])
image = rembg.remove(Image.open(a.image).convert('RGB'), session=session)
image.save(a.output / 'input-with-alpha.png')

start = time.monotonic()
print('GENERATE_LATENT', flush=True)
latents = pipeline(image=image, num_inference_steps=5,
    generator=torch.Generator(device='cpu').manual_seed(1987),
    guidance_scale=5.0, output_type='latent')
torch.save(latents, a.output / 'shape-latent.pt')
sample_seconds = time.monotonic() - start
print('LATENT_SECONDS', round(sample_seconds, 3), flush=True)
metadata = {'status': 'latent-only-no-character-or-rig',
    'sourceRepository': 'https://github.com/Tencent-Hunyuan/Hunyuan3D-2',
    'sourceCommit': 'f8db63096c8282cb27354314d896feba5ba6ff8a',
    'model': 'tencent/Hunyuan3D-2mini/hunyuan3d-dit-v2-mini-turbo',
    'device': 'cpu', 'dtype': 'bfloat16', 'steps': 5,
    'sampleSeconds': round(sample_seconds,3),
    'hasMesh': False, 'hasTextures': False, 'hasRig': False,
    'nextStage': 'decode-hunyuan-cpu.py with the matching Turbo VAE in float32'}
(a.output/'latent-metadata.json').write_text(json.dumps(metadata,indent=2))
print(json.dumps(metadata),flush=True)
