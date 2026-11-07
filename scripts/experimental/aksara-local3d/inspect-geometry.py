"""Render genuine reconstructed geometry from several angles in Blender CPU."""
import bpy
import json
import math
import sys
from pathlib import Path
from mathutils import Vector, Matrix

args = sys.argv[sys.argv.index('--') + 1:]
model_path, output_path = map(Path, args[:2])
mode = args[2] if len(args) > 2 else 'triposr'
output_path.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(model_path.resolve()))
roots = [o for o in bpy.context.scene.objects if o.parent is None]
frame = bpy.data.objects.new('TripoSR_Z_UP', None)
bpy.context.collection.objects.link(frame)
for obj in roots:
    obj.parent = frame
frame.rotation_euler.x = -math.pi / 2 if mode == 'triposr' else 0
bpy.context.view_layer.update()
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
for obj in meshes:
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    # Trimesh's GLB has COLOR_0 but no material. Bind that existing data.
    if not obj.data.materials and obj.data.color_attributes:
        material = bpy.data.materials.new('Reconstructed vertex colors')
        material.use_nodes = True
        nodes = material.node_tree.nodes
        shader = nodes.get('Principled BSDF')
        color = nodes.new('ShaderNodeVertexColor')
        color.layer_name = obj.data.color_attributes[0].name
        material.node_tree.links.new(color.outputs['Color'], shader.inputs['Base Color'])
        shader.inputs['Roughness'].default_value = .65
        obj.data.materials.append(material)
corners = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
low = Vector([min(v[i] for v in corners) for i in range(3)])
high = Vector([max(v[i] for v in corners) for i in range(3)])
center = (low + high) / 2
size = high - low

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.resolution_x = 640
scene.render.resolution_y = 768
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.12, .14, .19, 1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .7
scene.view_settings.view_transform = 'AgX'

def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()

def area(name, position, energy, color, scale):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.color, data.shape, data.size = energy, color, 'DISK', scale
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = center + Vector(position)
    aim(obj, center)

span = max(size)
area('Soft key', (-2 * span, -1.6 * span, 1.8 * span), 120 * span**2, (1, .87, .73), 2 * span)
area('Fill', (0, 2 * span, .7 * span), 60 * span**2, (.65, .76, 1), 2 * span)
area('Rim', (1.2 * span, 0, span), 90 * span**2, (.7, .8, 1), span)
data = bpy.data.cameras.new('Inspection camera')
camera = bpy.data.objects.new('Inspection camera', data)
scene.collection.objects.link(camera)
scene.camera = camera
data.type = 'ORTHO'
data.ortho_scale = max(size.z * 1.22, size.y * 1.5, size.x * 1.4)
data.clip_start = .001
data.clip_end = 1000

for label, angle in [('front', 0), ('quarter', 45), ('profile', 90), ('back', 180)]:
    radians = math.radians(angle)
    offset = (math.cos(radians) * span * 3, math.sin(radians) * span * 3, .025 * span)
    if mode == 'hunyuan':
        offset = (math.sin(radians) * span * 3, -math.cos(radians) * span * 3, .025 * span)
    camera.location = center + Vector(offset)
    aim(camera, center)
    scene.render.filepath = str((output_path / f'{label}.png').resolve())
    bpy.ops.render.render(write_still=True)
    print('RENDERED', label, flush=True)

scene['asset_status'] = 'unapproved reconstruction; no rig, no facial deformations'
bpy.ops.wm.save_as_mainfile(filepath=str((output_path / 'aksara-reconstruction-unapproved.blend').resolve()))
(output_path / 'inspection.json').write_text(json.dumps({
    'bounds': [list(low), list(high)], 'extents': list(size),
    'meshObjects': len(meshes), 'vertices': sum(len(o.data.vertices) for o in meshes),
    'polygons': sum(len(o.data.polygons) for o in meshes),
    'rigged': any(m.type == 'ARMATURE' for o in meshes for m in o.modifiers),
    'visualApproval': False,
}, indent=2))
