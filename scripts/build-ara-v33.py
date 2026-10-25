import json,struct,sys
from pathlib import Path
import numpy as np
src,dst=sys.argv[1:3]
data=Path(src).read_bytes();assert data[:4]==b'glTF'
n=struct.unpack_from('<I',data,12)[0];j=json.loads(data[20:20+n]);p=20+n
b=bytearray(data[p+8:p+8+struct.unpack_from('<I',data,p)[0]])
def align():
 while len(b)%4:b.append(0)
def accessor_data(idx):
 a=j['accessors'][idx];v=j['bufferViews'][a['bufferView']]
 types={5126:np.dtype('<f4'),5125:np.dtype('<u4'),5123:np.dtype('<u2'),5121:np.dtype('u1')}
 dims={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}
 typ=types[a['componentType']];d=dims[a['type']]
 offset=v.get('byteOffset',0)+a.get('byteOffset',0)
 stride=v.get('byteStride',d*typ.itemsize)
 if stride==d*typ.itemsize:return np.frombuffer(b,dtype=typ,count=a['count']*d,offset=offset).reshape((-1,d)).copy()
 return np.ndarray((a['count'],d),dtype=typ,buffer=b,offset=offset,strides=(stride,typ.itemsize)).copy()
def add_accessor(arr,component,typ,target):
 align();off=len(b);raw=arr.tobytes();b.extend(raw)
 vi=len(j['bufferViews']);j['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':len(raw),'target':target})
 a={'bufferView':vi,'componentType':component,'count':len(arr),'type':typ}
 if typ=='VEC3' and component==5126:
  a['min']=arr.min(axis=0).tolist();a['max']=arr.max(axis=0).tolist()
 ai=len(j['accessors']);j['accessors'].append(a);return ai
def mat(name,color,metal,rough,em=None,fade=False):
 d={'name':name,'pbrMetallicRoughness':{'baseColorFactor':color,'metallicFactor':metal,'roughnessFactor':rough},'doubleSided':True}
 if em:d['emissiveFactor']=em
 if fade:d['alphaMode']='BLEND';d['alphaCutoff']=0.0
 j['materials'].append(d);return len(j['materials'])-1
graphite=mat('ARA_V33_GRAPHITE',[.038,.078,.108,1],.72,.3,fade=True)
titanium=mat('ARA_V33_TITANIUM',[.17,.27,.33,1],.8,.24,fade=True)
cyan=mat('ARA_V33_CYAN',[.02,.7,.78,1],.22,.32,[.02,.52,.67],fade=True)
# The overlay is copied from the ACTUAL skinned source mesh. Original
# JOINTS_0, WEIGHTS_0, UVs and normals are retained; the new shell follows
# skinning and contours instead of floating as flat geometric rectangles.
def overlay(mesh_id,name,select,material,offset=.45,opacity=None):
 node_id=next(i for i,node in enumerate(j['nodes']) if node.get('mesh')==mesh_id)
 prim=j['meshes'][mesh_id]['primitives'][0]
 attrs=prim['attributes'];pos=accessor_data(attrs['POSITION'])
 faces=accessor_data(prim['indices']).flatten().reshape(-1,3)
 ctr=pos[faces].mean(axis=1)
 keep=select(ctr)
 selected=faces[keep]
 if len(selected)==0:raise ValueError(name+' selected zero triangles')
 # Copy the original position accessor, nudged slightly outward along its
 # real vertex normals; everything else including skin weights is shared.
 normals=accessor_data(attrs['NORMAL'])
 moved=(pos+normals*offset).astype('<f4')
 newpos=add_accessor(moved,5126,'VEC3',34962)
 newidx=add_accessor(selected.astype('<u4').reshape(-1,1),5125,'SCALAR',34963)
 newattrs=dict(attrs);newattrs['POSITION']=newpos
 if opacity is not None:
  a=np.clip(opacity(pos),0,1).astype('<f4')
  # Feather mesh edges rather than showing jagged triangles.
  colors=np.ones((len(pos),4),dtype='<f4');colors[:,3]=a
  newattrs['COLOR_0']=add_accessor(colors,5126,'VEC4',34962)
 mesh=len(j['meshes']);j['meshes'].append({'name':name,'primitives':[{'attributes':newattrs,'indices':newidx,'material':material}]})
 old=j['nodes'][node_id]
 newnode={'name':name,'mesh':mesh}
 if 'skin' in old:newnode['skin']=old['skin']
 for k in ('translation','rotation','scale','matrix'):
  if k in old:newnode[k]=old[k]
 ni=len(j['nodes']);j['nodes'].append(newnode)
 # Put the overlay beside the source mesh under the same parent.
 parent=next((i for i,node in enumerate(j['nodes'][:ni]) if node_id in node.get('children',[])),None)
 if parent is None:
  for scene in j.get('scenes',[]):
   if node_id in scene.get('nodes',[]):scene['nodes'].append(ni);break
 else:j['nodes'][parent]['children'].append(ni)
 print(name,'faces',len(selected))
# Soft falloff makes armor follow the actual face/shoulder curvature
# without polygon-cut edges. Keep face, eyes, lips and central forehead clear.
def smoothstep(a,b,x):
 t=np.clip((x-a)/(b-a),0,1)
 return t*t*(3-2*t)
def face_alpha(p):
 x,y,z=p.T
 return smoothstep(-5.2,-8.8,x)*smoothstep(154,161,y)*(1-smoothstep(172,177,y))*smoothstep(-1,6,z)
def shoulder_alpha(p):
 x,y,z=p.T;ax=np.abs(x)
 return smoothstep(10,17,ax)*(1-smoothstep(25,31,ax))*smoothstep(132,140,y)*(1-smoothstep(147,152,y))*smoothstep(-5,2,z)
def chest_alpha(p):
 x,y,z=p.T;ax=np.abs(x)
 return (1-smoothstep(10,17,ax))*smoothstep(111,118,y)*(1-smoothstep(134,141,y))*smoothstep(3,11,z)
def half_face_alpha(p):
 x,y,z=p.T
 return smoothstep(0,-4,x)*smoothstep(153,157,y)*(1-smoothstep(174,177,y))*smoothstep(-4,0,z)
def circuit_alpha(p):
 x,y,z=p.T
 return smoothstep(-3,-7,x)*smoothstep(158,161,y)*(1-smoothstep(171,174,y))*smoothstep(-3,2,z)*(np.abs(np.sin(y*1.5+x*.7))>.90)
overlay(1,'ARA_ANDROID_HALF_FACE',lambda c:(c[:,0]<-1.2)&(c[:,1]>154)&(c[:,1]<177)&(c[:,2]>-2),titanium,.37,half_face_alpha)
overlay(1,'ARA_ANDROID_FACE_CIRCUIT',lambda c:(c[:,0]<-4)&(c[:,1]>158)&(c[:,1]<174)&(c[:,2]>-2),cyan,.6,circuit_alpha)
overlay(3,'ARA_ANDROID_SHOULDERS',lambda c:(abs(c[:,0])>10)&(abs(c[:,0])<31)&(c[:,1]>132)&(c[:,1]<152)&(c[:,2]>-5),titanium,.26,shoulder_alpha)
overlay(7,'ARA_ANDROID_CHEST_ARMOR',lambda c:(abs(c[:,0])<17)&(c[:,1]>111)&(c[:,1]<141)&(c[:,2]>3),graphite,.23,chest_alpha)

# Reveal the cybernetic temple without hiding the rest of the hair.
for mi,m in enumerate(j['meshes']):
 if not any(word in m.get('name','') for word in ('Hair','Bang_')):continue
 for prim in m.get('primitives',[]):
  if 'POSITION' not in prim['attributes'] or 'indices' not in prim:continue
  pts=accessor_data(prim['attributes']['POSITION'])
  faces=accessor_data(prim['indices']).flatten().reshape(-1,3)
  centers=pts[faces].mean(axis=1)
  keep=~((centers[:,0]<-6)&(centers[:,1]>150)&(centers[:,2]>0))
  if not keep.all():
   prim['indices']=add_accessor(faces[keep].astype('<u4').reshape(-1,1),5125,'SCALAR',34963)
   print('Ara hair temple clearance:',m.get('name'),int((~keep).sum()),'triangles')
# Real garment material correction: baked into GLB so VTK and browser agree.
# Replaces the original camisole texture with opaque carbon armor.
garment_material=j['meshes'][7]['primitives'][0]['material']
j['materials'][garment_material]={
 'name':'ARA_CARBON_SUIT',
 'pbrMetallicRoughness':{'baseColorFactor':[.018,.045,.065,1],
 'metallicFactor':.38,'roughnessFactor':.68},
 'doubleSided':True
}
# Reduce specular blowout seen in the actual rendered QA frame.
for material in j['materials']:
 if material.get('name','').startswith('ARA_V33_'):
  pbr=material['pbrMetallicRoughness']
  pbr['metallicFactor']=.35;pbr['roughnessFactor']=.72
  if 'TITANIUM' in material['name']:pbr['baseColorFactor']=[.08,.16,.23,1]
  if 'GRAPHITE' in material['name']:pbr['baseColorFactor']=[.025,.05,.07,.96]
  material['alphaMode']='BLEND'
align();j['buffers'][0]['byteLength']=len(b)
raw=json.dumps(j,separators=(',',':'),allow_nan=False).encode();raw+=b' '*((-len(raw))%4)
out=struct.pack('<4sII',b'glTF',2,12+8+len(raw)+8+len(b))+struct.pack('<I4s',len(raw),b'JSON')+raw+struct.pack('<I4s',len(b),b'BIN\x00')+b
Path(dst).write_bytes(out)
print('ARA v33 conformal armor ready:',len(out),'bytes')
