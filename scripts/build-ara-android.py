import json,struct,sys,math
from pathlib import Path
src,dst=sys.argv[1:3]
data=Path(src).read_bytes()
assert data[:4]==b'glTF'
n=struct.unpack_from('<I',data,12)[0];j=json.loads(data[20:20+n]);p=20+n
b=bytearray(data[p+8:p+8+struct.unpack_from('<I',data,p)[0]])
while len(b)%4:b.append(0)
head=next(i for i,x in enumerate(j['nodes']) if x.get('name','').startswith('CC_Base_Head_'))
def mat(name,c,met=.85,rough=.24,em=None):
 x={'name':name,'pbrMetallicRoughness':{'baseColorFactor':c,'metallicFactor':met,'roughnessFactor':rough},'doubleSided':True}
 if em:x['emissiveFactor']=em
 j['materials'].append(x);return len(j['materials'])-1
metal=mat('ARA_TITANIUM',[.06,.13,.2,1]);dark=mat('ARA_CARBON',[.012,.03,.05,1])
cyan=mat('ARA_CYAN',[.03,.7,.9,1],.1,.3,[.05,.55,.75]);silver=mat('ARA_CHROME',[.28,.39,.5,1])
def mesh(name,vs,fs,m):
 flat=[q for v in vs for q in v];off=len(b);raw=struct.pack('<%sf'%len(flat),*flat);b.extend(raw)
 while len(b)%4:b.append(0)
 vi=len(j['bufferViews']);j['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':len(raw),'target':34962})
 a=len(j['accessors']);j['accessors'].append({'bufferView':vi,'componentType':5126,'count':len(vs),'type':'VEC3','min':[min(v[k] for v in vs) for k in range(3)],'max':[max(v[k] for v in vs) for k in range(3)]})
 ids=[q for f in fs for q in f];off=len(b);raw=struct.pack('<%sI'%len(ids),*ids);b.extend(raw)
 while len(b)%4:b.append(0)
 vi=len(j['bufferViews']);j['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':len(raw),'target':34963})
 ai=len(j['accessors']);j['accessors'].append({'bufferView':vi,'componentType':5125,'count':len(ids),'type':'SCALAR'})
 mi=len(j['meshes']);j['meshes'].append({'name':name,'primitives':[{'attributes':{'POSITION':a},'indices':ai,'material':m}]})
 ni=len(j['nodes']);j['nodes'].append({'name':name,'mesh':mi});j['nodes'][head].setdefault('children',[]).append(ni)
# Head bone local frame: x is left/right, y is height, z is depth.
# The previous v28 shell crossed the central face. This version uses the
# outer LEFT temple only and puts the ear device OUTSIDE the hair silhouette.
def temple_shell(name, a0, a1, y0, y1, m, radius=1.0):
 vs=[];fs=[];nu=18;nv=18
 for i in range(nv+1):
  y=y0+(y1-y0)*i/nv
  taper=max(.78,math.sqrt(max(.45,1-((y-10.5)/21)**2)))
  for k in range(nu+1):
   a=a0+(a1-a0)*k/nu
   vs.append((-.8+10.7*radius*taper*math.cos(a),y,10.7*radius*taper*math.sin(a)))
 for i in range(nv):
  for k in range(nu):
   v=i*(nu+1)+k;z=v+nu+1;fs.extend([(v,z,v+1),(v+1,z,z+1)])
 mesh(name,vs,fs,m)
def ear_ring(name,outer,inner,m,x=-13.2,y=9.7,z=-.6):
 vs=[];fs=[];n=48
 for i in range(n):
  t=2*math.pi*i/n
  for r in (outer,inner):
   vs.append((x,y+math.cos(t)*r,z+math.sin(t)*r))
 for i in range(n):
  v=i*2;zv=((i+1)%n)*2;fs.extend([(v,v+1,zv),(zv,v+1,zv+1)])
 mesh(name,vs,fs,m)
# A narrow armored band along the left side of the skull, NOT the forehead.
temple_shell('ARA_ANDROID_SIDE_PANEL',2.48,3.55,5,22,metal,1.08)
temple_shell('ARA_ANDROID_SIDE_SEAM',2.47,2.51,7,21,cyan,1.105)
temple_shell('ARA_ANDROID_REAR_PANEL',3.55,3.85,6,21,dark,1.09)
# Concentric emitter on the exterior side of the head.
ear_ring('ARA_ANDROID_EAR_FRAME',4.1,3.25,silver)
ear_ring('ARA_ANDROID_EAR_CYAN',2.85,2.48,cyan,x=-13.5)
ear_ring('ARA_ANDROID_EAR_CORE',1.55,.95,dark,x=-13.8)
j['buffers'][0]['byteLength']=len(b);raw=json.dumps(j,separators=(',',':')).encode();raw+=b' '*((-len(raw))%4)
out=struct.pack('<4sII',b'glTF',2,12+8+len(raw)+8+len(b))+struct.pack('<I4s',len(raw),b'JSON')+raw+struct.pack('<I4s',len(b),b'BIN\x00')+b
Path(dst).write_bytes(out)
print('ARA android model v29: left-side temple and external ear:,len(data),'->',len(out),'head bone',head)
