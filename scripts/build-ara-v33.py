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
def mat(name,color,metal,rough,em=None):
 d={'name':name,'pbrMetallicRoughness':{'baseColorFactor':color,'metallicFactor':metal,'roughnessFactor':rough},'doubleSided':True}
 if em:d['emissiveFactor']=em
 j['materials'].append(d);return len(j['materials'])-1
graphite=mat('ARA_V33_GRAPHITE',[.038,.078,.108,1],.72,.3)
titanium=mat('ARA_V33_TITANIUM',[.17,.27,.33,1],.8,.24)
cyan=mat('ARA_V33_CYAN',[.02,.7,.78,1],.22,.32,[.02,.52,.67])
# The overlay is copied from the ACTUAL skinned source mesh. Original
# JOINTS_0, WEIGHTS_0, UVs and normals are retained; the new shell follows
# skinning and contours instead of floating as flat geometric rectangles.
def overlay(mesh_id,name,select,material,offset=.45):
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
overlay(1,'ARA_ANDROID_FACE_SIDE',lambda c:(c[:,0]<-7)&(c[:,1]>157)&(c[:,1]<174)&(c[:,2]>0),titanium,.42)
overlay(1,'ARA_ANDROID_FACE_TRACE',lambda c:(c[:,0]<-7.4)&(c[:,1]>160)&(c[:,1]<172)&(c[:,2]>0),cyan,.62)
overlay(3,'ARA_ANDROID_SHOULDERS',lambda c:(abs(c[:,0])>13)&(abs(c[:,0])<28)&(c[:,1]>135)&(c[:,1]<149)&(c[:,2]>-1),titanium,.72)
overlay(3,'ARA_ANDROID_SHOULDER_TRIM',lambda c:(abs(c[:,0])>15)&(abs(c[:,0])<26)&(c[:,1]>144)&(c[:,1]<149)&(c[:,2]>0),cyan,.94)
overlay(2,'ARA_ANDROID_NECK',lambda c:(abs(c[:,0])<10)&(c[:,1]>136)&(c[:,1]<149)&(c[:,2]>3),graphite,.5)
overlay(7,'ARA_ANDROID_CHEST_ARMOR',lambda c:(abs(c[:,0])<14)&(c[:,1]>115)&(c[:,1]<137)&(c[:,2]>8),graphite,.65)
overlay(7,'ARA_ANDROID_CHEST_LIGHT',lambda c:(abs(c[:,0])<1.8)&(c[:,1]>118)&(c[:,1]<134)&(c[:,2]>12),cyan,.88)
align();j['buffers'][0]['byteLength']=len(b)
raw=json.dumps(j,separators=(',',':'),allow_nan=False).encode();raw+=b' '*((-len(raw))%4)
out=struct.pack('<4sII',b'glTF',2,12+8+len(raw)+8+len(b))+struct.pack('<I4s',len(raw),b'JSON')+raw+struct.pack('<I4s',len(b),b'BIN\x00')+b
Path(dst).write_bytes(out)
print('ARA v33 conformal armor ready:',len(out),'bytes')
