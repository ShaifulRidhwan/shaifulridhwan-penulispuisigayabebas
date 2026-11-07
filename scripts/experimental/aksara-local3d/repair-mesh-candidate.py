"""Create a non-destructive repair *candidate* from an unapproved mesh.

Voxel reconstruction changes small details. It must be compared visually with
the reference and raw mesh and is never automatically accepted as the character.
"""
import bpy
import json
import sys
from pathlib import Path

src, dest = map(Path, sys.argv[sys.argv.index('--')+1:][:2])
dest.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(src.resolve()))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
bpy.ops.object.join()
obj=bpy.context.object
bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
before={'vertices':len(obj.data.vertices),'faces':len(obj.data.polygons)}
obj.data.remesh_voxel_size=max(obj.dimensions)/300
obj.data.remesh_voxel_adaptivity=0
bpy.ops.object.voxel_remesh()
smooth=obj.modifiers.new('Gentle surface repair','SMOOTH')
smooth.factor=.45
smooth.iterations=3
bpy.ops.object.modifier_apply(modifier=smooth.name)
obj.data.calc_loop_triangles()
triangle_count=len(obj.data.loop_triangles)
if triangle_count>300000:
    reduce=obj.modifiers.new('Inspection triangle budget','DECIMATE')
    reduce.ratio=300000/triangle_count
    reduce.use_collapse_triangulate=True
    bpy.ops.object.modifier_apply(modifier=reduce.name)
for face in obj.data.polygons:face.use_smooth=True
obj.name='AKSARA_unapproved_repaired_candidate'
obj['status']='Unapproved: repair may alter identity details. No rig.'
bpy.ops.export_scene.gltf(filepath=str((dest/'aksara-repaired-unapproved.glb').resolve()),
                          export_format='GLB',use_selection=True)
(dest/'repair-metadata.json').write_text(json.dumps({'before':before,
    'after':{'vertices':len(obj.data.vertices),'faces':len(obj.data.polygons)},
    'voxelSize':float(obj.data.remesh_voxel_size),'visualApproval':False,
    'warning':'Voxel repair changes details; manual identity review required.'},indent=2))
