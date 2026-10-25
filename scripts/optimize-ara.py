import sys,struct,json,io
from PIL import Image
src,dst=sys.argv[1:3]
with open(src,'rb') as f:raw=f.read()
assert raw[:4]==b'glTF'
jlen,jtype=struct.unpack_from('<II',raw,12)
j=json.loads(raw[20:20+jlen]);p=20+jlen
blen,btype=struct.unpack_from('<II',raw,p)
binary=memoryview(raw)[p+8:p+8+blen]
image_views={im['bufferView']:i for i,im in enumerate(j.get('images',[])) if 'bufferView' in im}
replaced={}
for vi,ii in image_views.items():
 v=j['bufferViews'][vi];blob=bytes(binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])
 try:
  im=Image.open(io.BytesIO(blob));im.load()
  maxdim=1536 if ii in (2,4) else 1024
  if max(im.size)>maxdim:im.thumbnail((maxdim,maxdim),Image.Resampling.LANCZOS)
  out=io.BytesIO()
  if im.mode in ('RGBA','LA') or ('transparency' in im.info):
   im.save(out,format='PNG',optimize=True,compress_level=6);mime='image/png'
  else:
   im.convert('RGB').save(out,format='JPEG',quality=82,optimize=True,subsampling=0);mime='image/jpeg'
  if len(out.getvalue())<len(blob):
   replaced[vi]=out.getvalue();j['images'][ii]['mimeType']=mime
 except Exception as e:print('Skip texture',ii,str(e)[:100])
for m in j.get('materials',[]):
 ext=m.get('extensions',{}).pop('KHR_materials_pbrSpecularGlossiness',None)
 if ext is not None:
  gloss=ext.get('glossinessFactor',.5)
  pbr={'baseColorFactor':ext.get('diffuseFactor',[1,1,1,1]),'metallicFactor':0,'roughnessFactor':max(.12,min(1,1-gloss))}
  if 'diffuseTexture' in ext:pbr['baseColorTexture']=ext['diffuseTexture']
  m['pbrMetallicRoughness']=pbr
  if not m['extensions']:m.pop('extensions',None)
j['extensionsUsed']=[e for e in j.get('extensionsUsed',[]) if e!='KHR_materials_pbrSpecularGlossiness']
if not j['extensionsUsed']:j.pop('extensionsUsed',None)
j['extensionsRequired']=[e for e in j.get('extensionsRequired',[]) if e!='KHR_materials_pbrSpecularGlossiness']
if not j['extensionsRequired']:j.pop('extensionsRequired',None)
newbin=bytearray()
for i,v in enumerate(j['bufferViews']):
 blob=replaced.get(i)
 if blob is None:blob=binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
 v['byteOffset']=len(newbin);v['byteLength']=len(blob)
 newbin.extend(blob)
 while len(newbin)%4:newbin.append(0)
j['buffers'][0]['byteLength']=len(newbin)
jb=json.dumps(j,separators=(',',':'),ensure_ascii=False).encode('utf-8')
jb+=b' '*((-len(jb))%4)
size=12+8+len(jb)+8+len(newbin)
with open(dst,'wb') as f:
 f.write(struct.pack('<4sII',b'glTF',2,size))
 f.write(struct.pack('<I4s',len(jb),b'JSON'));f.write(jb)
 f.write(struct.pack('<I4s',len(newbin),b'BIN\\x00'.replace(b'\\x00',bytes([0]))));f.write(newbin)
print('Ara optimized',len(raw),'to',size,'bytes; textures',len(replaced))
