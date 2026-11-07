"""Run the official TripoSR model locally on CPU and save inspectable geometry.

This is a reconstruction experiment, not a finished character/rig.
The upstream repository must be checked out at the revision in metadata.json.
"""
import argparse
import json
import sys
import time
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--repo', type=Path, required=True)
parser.add_argument('--weights', type=Path, required=True)
parser.add_argument('--image', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--resolution', type=int, default=256)
args = parser.parse_args()
sys.path.insert(0, str(args.repo.resolve()))

import numpy as np
import rembg
import torch
from PIL import Image
from tsr.system import TSR
from tsr.utils import remove_background, resize_foreground

torch.set_num_threads(8)
torch.set_num_interop_threads(2)
args.output.mkdir(parents=True, exist_ok=True)
timings = {}

def stage(label, fn):
    print(label, flush=True)
    start = time.monotonic()
    result = fn()
    timings[label] = round(time.monotonic() - start, 3)
    print(label, 'finished in', timings[label], 'seconds', flush=True)
    return result

model = stage('load model', lambda: TSR.from_pretrained(
    str(args.weights), config_name='config.yaml', weight_name='model.ckpt'))
model.eval().to('cpu')
model.renderer.set_chunk_size(8192)

def prepare():
    # Follow upstream's image preparation, not a custom portrait mesh trick.
    session = rembg.new_session('u2net', providers=['CPUExecutionProvider'])
    image = remove_background(Image.open(args.image), session)
    image = resize_foreground(image, 0.85)
    image = np.array(image).astype(np.float32) / 255.0
    image = image[:, :, :3] * image[:, :, 3:4] + (1 - image[:, :, 3:4]) * 0.5
    return Image.fromarray((image * 255).astype(np.uint8))

image = stage('prepare input', prepare)
image.save(args.output / 'model-input.png')
with torch.inference_mode():
    codes = stage('infer 3D field on CPU', lambda: model([image], device='cpu'))
    torch.save(codes, args.output / 'scene-codes.pt')
    mesh = stage('extract colored mesh', lambda: model.extract_mesh(
        codes, has_vertex_color=True, resolution=args.resolution)[0])
    mesh.export(args.output / 'aksara-reconstruction-unapproved.glb')

metadata = {
    'status': 'unapproved-reconstruction-not-a-finished-character',
    'sourceRepository': 'https://github.com/VAST-AI-Research/TripoSR',
    'sourceCommit': '107cefdc244c39106fa830359024f6a2f1c78871',
    'model': 'stabilityai/TripoSR',
    'device': 'cpu',
    'resolution': args.resolution,
    'vertices': len(mesh.vertices),
    'triangles': len(mesh.faces),
    'bounds': mesh.bounds.tolist(),
    'extents': mesh.extents.tolist(),
    'watertight': bool(mesh.is_watertight),
    'hasRig': False,
    'hasFacialBlendshapes': False,
    'timingsSeconds': timings,
}
(args.output / 'metadata.json').write_text(json.dumps(metadata, indent=2))
print(json.dumps(metadata), flush=True)
