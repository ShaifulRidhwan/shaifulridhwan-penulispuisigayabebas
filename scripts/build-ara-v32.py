import json,struct,sys,math
from pathlib import Path
import numpy as np
src,dst=sys.argv[1:3];data=Path(src).read_bytes();assert data[:4]==b'glTF'
n=struct.unpack_from('<I',data,12)[0];j=json.loads(data[20:20+n]);p=20+n
b=bytearray(data[p+8:p+8+struct.unpack_from('<I',data,p)[0]])
while len(b)%4:b.append(0)
parents={c:i for i,v in enumerate(j['nodes']) for c in v.get('children',[])}
def local(i):
 v=j['nodes'][i]
 if 'matrix' in v:return np.array(v['matrix']).reshape((4,4),order='F')
 x,y,z,w=v.get('rotation',[0,0,0,1]);s=v.get('scale',[1,1,1])
 R=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
 m=np.eye(4);m[:3,:3]=R@np.diag(s);m[:3,3]=v.get('translation',[0,0,0]);return m
cache={}
def world(i):
 if i not in cache:cache[i]=(world(parents[i]) if i in parents else np.eye(4))@local(i)
 return cache[i]
def bone(name):return next(i for i,v in enumerate(j['nodes']) if v.get('name','').startswith(name))
head=bone('CC_Base_Head_');spine=bone('CC_Base_Spine02_')
def material(name,color,metal=.8,rough=.3,em=None):
 d={'name':name,'pbrMetallicRoughness':{'baseColorFactor':color,'metallicFactor':metal,'roughnessFactor':rough},'doubleSided':True}
 if em:d['emissiveFactor']=em
 j['materials'].append(d);return len(j['materials'])-1
carbon=material('ARA_CARBON_ARMOR',[.025,.05,.07,1]);titanium=material('ARA_TITANIUM_ARMOR',[.13,.22,.28,1]);silver=material('ARA_CHROME',[.36,.5,.57,1]);cyan=material('ARA_CYAN_EMITTER',[.04,.64,.79,1],.1,.32,[.03,.48,.66])
# Original mesh positions are in the scaled mesh-local frame. Convert through
# actual mesh world matrix, then into the corresponding animated bone frame.
meshframe=world(next(i for i,v in enumerate(j['nodes']) if v.get('mesh')==1))
def add(name,vertices,triangles,mat,boneid):
 inv=np.linalg.inv(world(boneid))@meshframe
 verts=np.asarray(vertices,dtype=np.float32);verts=(np.column_stack((verts,np.ones(len(verts))))@inv.T)[:,:3].astype('<f4')
 def accessor(raw,target,component,count,typ,limits=None):
  off=len(b);b.extend(raw)
  while len(b)%4:b.append(0)
  vi=len(j['bufferViews']);j['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':len(raw),'target':target})
  a={'bufferView':vi,'componentType':component,'count':count,'type':typ}
  if limits:a['min'],a['max']=limits
  ai=len(j['accessors']);j['accessors'].append(a);return ai
 pos=accessor(verts.tobytes(),34962,5126,len(verts),'VEC3',(verts.min(0).tolist(),verts.max(0).tolist()))
 faces=np.asarray(triangles,dtype='<u4').flatten();idx=accessor(faces.tobytes(),34963,5125,len(faces),'SCALAR')
 mi=len(j['meshes']);j['meshes'].append({'name':name,'primitives':[{'attributes':{'POSITION':pos},'indices':idx,'material':mat}]})
 ni=len(j['nodes']);j['nodes'].append({'name':name,'mesh':mi});j['nodes'][boneid].setdefault('children',[]).append(ni)
def quad(name,pts,mat,bn):add(name,pts,[(0,1,2),(0,2,3)],mat,bn)
def ring(name,x,y,z,rx,ry,thickness,mat,bn):
 vs=[];fs=[];N=40
 for i in range(N):
  a=2*math.pi*i/N
  for t in (1,1-thickness):vs.append((x+rx*t*math.cos(a),y+ry*t*math.sin(a),z))
 for i in range(N):
  k=2*i;q=2*((i+1)%N);fs.extend([(k,k+1,q),(q,k+1,q+1)])
 add(name,vs,fs,mat,bn)
quad('ARA_ANDROID_TEMPLE',[(-11.4,172.5,10.2),(-8.8,174,11.4),(-9.1,158.2,12.5),(-11.4,157.3,11.5)],titanium,head)
quad('ARA_ANDROID_TEMPLE_LIGHT',[(-11.5,171.5,10.55),(-11.0,171.8,10.85),(-11.0,158.7,12.3),(-11.5,158.5,12.1)],cyan,head)
ring('ARA_ANDROID_EAR_RING',-11.4,159.8,12.8,3.3,4,.24,silver,head)
ring('ARA_ANDROID_EAR_LIGHT',-11.4,159.8,13,2.2,2.7,.18,cyan,head)
for side in (-1,1):
 tag='L' if side<0 else 'R'
 def P(x,y,z):return (side*x,y,z)
 quad('ARA_ANDROID_SHOULDER_'+tag,[P(9.5,146.5,7.8),P(22.8,143.8,4.6),P(22,137.8,13.5),P(10.3,139.5,16.5)],titanium,spine)
 quad('ARA_ANDROID_SHOULDER_LIGHT_'+tag,[P(10.2,146.6,8.4),P(22.2,144.2,5),P(22,143.5,5.9),P(10.2,145.8,9.5)],cyan,spine)
 quad('ARA_ANDROID_COLLAR_'+tag,[P(5,147.4,11),P(11.2,145.4,12.2),P(10.6,138.8,16.2),P(5.5,141.3,16.5)],carbon,spine)
 quad('ARA_ANDROID_COLLAR_LIGHT_'+tag,[P(5.3,146.8,11.8),P(10.6,144.9,12.8),P(10.6,144.2,13.3),P(5.3,146.1,12.5)],cyan,spine)
quad('ARA_ANDROID_NECK',[(-4.3,146.8,11.2),(4.3,146.8,11.2),(5.5,137.5,16.1),(-5.5,137.5,16.1)],carbon,spine)
quad('ARA_ANDROID_BREASTPLATE',[(-9.3,136,17.6),(9.3,136,17.6),(10,115,19.1),(-10,115,19.1)],carbon,spine)
quad('ARA_ANDROID_CORE_LIGHT',[(-1.1,134,18),(1.1,134,18),(1.1,120,19.6),(-1.1,120,19.6)],cyan,spine)
j['buffers'][0]['byteLength']=len(b)
raw=json.dumps(j,separators=(',',':'),allow_nan=False).encode();raw+=b' '*((-len(raw))%4)
out=struct.pack('<4sII',b'glTF',2,12+8+len(raw)+8+len(b))+struct.pack('<I4s',len(raw),b'JSON')+raw+struct.pack('<I4s',len(b),b'BIN\x00')+b
Path(dst).write_bytes(out)
print('Ara v32 armor:',len(j['meshes']),'meshes',len(out),'bytes')
