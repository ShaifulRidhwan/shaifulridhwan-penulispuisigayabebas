import bpy,bmesh,os,json,math
from mathutils import Vector
import argparse
from pathlib import Path
parser=argparse.ArgumentParser(description='Export and render the actual AKSARA GLBs from the packed Blender source')
parser.add_argument('--blend',required=True);parser.add_argument('--out-dir',required=True)
args=parser.parse_args(__import__('sys').argv[__import__('sys').argv.index('--')+1:])
OUT=str(Path(args.out_dir).resolve());Path(OUT).mkdir(parents=True,exist_ok=True);ASSET=OUT
bpy.ops.wm.open_mainfile(filepath=str(Path(args.blend).resolve()))
scene=bpy.context.scene;visible=[o for o in scene.objects if o.type=='MESH' and not o.hide_render]
# Export copies, preserving all individually editable locks and ornaments in the .blend.
groups={}
for o in visible:
 name=o.name
 if name.startswith('Eye '):key='Eye.L' if name.endswith('0') else 'Eye.R'
 elif name.startswith('Hair '):key='Hair'
 elif name.startswith('Sun '):key='Crown.Sun'
 elif name.startswith('Moon '):key='Crown.Moon'
 elif name.startswith('Crown '):key='Crown.Chain'
 elif name.startswith('Earring '):key='Earrings'
 elif name.startswith(('Gown ','Collar ','Shoulder ')):key='Gown.Ornaments'
 else:key='Head.Neck.Shoulders'
 groups.setdefault(key,[]).append(o)
exports=[]
dg=bpy.context.evaluated_depsgraph_get()
for name,objs in groups.items():
 copies=[]
 for o in objs:
  evaluated=o.evaluated_get(dg);me=bpy.data.meshes.new_from_object(evaluated,depsgraph=dg);copy=bpy.data.objects.new('Export.'+o.name,me);scene.collection.objects.link(copy);copy.matrix_world=o.matrix_world.copy();copies.append(copy)
 bpy.ops.object.select_all(action='DESELECT')
 for o in copies:o.select_set(True)
 bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();joined=bpy.context.object;joined.name=name;exports.append(joined)
for o in visible:o.hide_render=True;o.hide_set(True)
bpy.ops.object.select_all(action='DESELECT')
for o in exports:o.select_set(True)
bpy.context.view_layer.objects.active=exports[0]
bpy.ops.export_scene.gltf(filepath=ASSET+'/aksara-v2.glb',export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False,export_apply=True)
# A second real GLB exposes the underlying modeled geometry without the reference texture.
clay=bpy.data.materials.new('Geometry inspection clay');clay.use_nodes=True;clay.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.27,.29,.34,1);clay.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.72
for o in exports:
 o.data.materials.clear();o.data.materials.append(clay)
 for ca in list(o.data.color_attributes):o.data.color_attributes.remove(ca)
 for p in o.data.polygons:p.material_index=0
bpy.ops.export_scene.gltf(filepath=ASSET+'/aksara-v2-clay.glb',export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False,export_apply=True)
scene.render.resolution_x=760;scene.render.resolution_y=900;scene.cycles.samples=16
for name,angle in [('front',0),('quarter',35),('profile',90),('back',180)]:
 a=math.radians(angle);c=scene.camera;c.location=(5*math.sin(a),-5*math.cos(a),.005);c.rotation_euler=(Vector((0,0,.005))-c.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=OUT+'/clay-'+name+'.png';bpy.ops.render.render(write_still=True)
stats={'status':'UNAPPROVED','rig':False,'animations':False,'productionVoiceModified':False,'editableObjects':len(visible),'exportObjects':len(exports),'vertices':sum(len(o.data.vertices)for o in exports),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons)for o in exports),'faceTexture':'Single-view projection from AI-cleaned approved reference; not multi-view PBR albedo','remaining':['Facial likeness and eyelid refinement','Hair stiffness, root/cap intersections and tip grouping','Crown detail and attachments','Provisional projected texture on face and gown; embedded lighting and side stretching','Full body, arms and gown absent','No facial blendshapes, armature, weights or physics','No Voice integration or measured FPS']}
with open(OUT+'/model-report.json','w')as f:json.dump(stats,f,indent=2)
print(json.dumps(stats),flush=True)
