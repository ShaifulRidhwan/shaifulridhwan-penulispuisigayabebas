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
def shell(name,p0,p1,y0,y1,m,r=1):
 vs=[];fs=[];nu=20;nv=14
 for i in range(nv+1):
  y=y0+(y1-y0)*i/nv;t=math.sqrt(max(.08,1-((y-10.5)/14)**2))
  for k in range(nu+1):
   a=p0+(p1-p0)*k/nu;vs.append((-1.4+9*r*t*math.cos(a),y,10.4*r*t*math.sin(a)))
 for i in range(nv):
  for k in range(nu):
   a=i*(nu+1)+k;z=a+nu+1;fs.extend([(a,z,a+1),(a+1,z,z+1)])
 mesh(name,vs,fs,m)
def ring(name,rad,inner,m):
 vs=[];fs=[];n=48
 for i in range(n):
  t=2*math.pi*i/n
  for r in (rad,inner):vs.append((-.8+math.cos(t)*r,10.5+math.sin(t)*r,-10.8))
 for i in range(n):
  a=i*2;z=((i+1)%n)*2;fs.extend([(a,a+1,z),(z,a+1,z+1)])
 mesh(name,vs,fs,m)
shell('ARA_ANDROID_HELMET',-2.75,-1.3,3.5,22.5,metal,1.02)
shell('ARA_ANDROID_TEMPLE',-1.73,-1.22,6,18,dark,1.045)
shell('ARA_ANDROID_BACK',-3.18,-2.68,5,21,dark,1.018)
ring('ARA_ANDROID_EAR_RING',4.25,3.45,silver)
ring('ARA_ANDROID_EAR_GLOW',2.85,2.55,cyan)
ring('ARA_ANDROID_EAR_CORE',1.65,.95,metal)
shell('ARA_ANDROID_CIRCUIT',-2.09,-2.055,7,20,cyan,1.058)
shell('ARA_ANDROID_FOREHEAD_TRACE',-1.38,-1.36,14,20,cyan,1.06)
j['buffers'][0]['byteLength']=len(b);raw=json.dumps(j,separators=(',',':')).encode();raw+=b' '*((-len(raw))%4)
out=struct.pack('<4sII',b'glTF',2,12+8+len(raw)+8+len(b))+struct.pack('<I4s',len(raw),b'JSON')+raw+struct.pack('<I4s',len(b),b'BIN\x00')+b
Path(dst).write_bytes(out)
print('ARA android model:',len(data),'->',len(out),'head bone',head)
