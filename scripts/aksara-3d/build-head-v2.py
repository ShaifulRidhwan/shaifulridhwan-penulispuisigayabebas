import bpy, bmesh, math, random, json, os
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import tessellate_polygon
from math import sin,cos,pi
import argparse
from pathlib import Path
parser=argparse.ArgumentParser(description='Build the unapproved AKSARA head/shoulder study in Blender 4.3.2')
parser.add_argument('--input-glb',required=True)
parser.add_argument('--face-reference',required=True)
parser.add_argument('--out-dir',required=True)
args=parser.parse_args(__import__('sys').argv[__import__('sys').argv.index('--')+1:])
OUT=str(Path(args.out_dir).resolve());Path(OUT).mkdir(parents=True,exist_ok=True);random.seed(4106)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(Path(args.input_glb).resolve()))
source=[o for o in bpy.context.scene.objects if o.type=='MESH'][0]
bvh=BVHTree.FromObject(source,bpy.context.evaluated_depsgraph_get())
source.hide_render=True;source.hide_set(True);source.name='SOURCE · unapproved scan · hidden'
# Keep the source for reversible edits, but export only the rebuilt surfaces.
created=[]
def material(name,color,rough=.45,metal=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;return m
skin=material('Skin · provisional side albedo',(.48,.29,.235),.52)
face=material('Face · single-view reference projection · provisional',(.48,.29,.235),.5)
clean=bpy.data.images.load(str(Path(args.face_reference).resolve()));clean.pack()
tex=face.node_tree.nodes.new('ShaderNodeTexImage');tex.image=clean;tex.extension='EXTEND'
face.node_tree.links.new(tex.outputs['Color'],face.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
hairs=[]
for i in range(8):hairs.append(material('Hair · midnight strand %02d'%i,(.007+i*.001,.011+i*.0015,.022+i*.0028),.52+ i*.009))
velvet=material('Gown · navy velvet',(.009,.014,.033),.63)
gold=material('Celestial gold',(.67,.39,.095),.28,.82)
silver=material('Moon · cold silver',(.4,.57,.74),.28,.86)
sapphire=material('Sapphire',(.009,.09,.22),.17,.48)
clothfront=face.copy();clothfront.name='Gown · provisional front reference projection'
def mesh(name,verts,faces,mats,matids=None,project=False):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o)
 for m in mats:me.materials.append(m)
 for i,p in enumerate(me.polygons):p.use_smooth=True;p.material_index=matids[i] if matids else 0
 if project:
  uv=me.uv_layers.new(name='ReferenceProjection')
  for p in me.polygons:
   for li in p.loop_indices:
    v=me.vertices[me.loops[li].vertex_index].co;uv.data[li].uv=(.5+(v.x+.015)*.72,(v.z+.99)/1.947)
 created.append(o);return o
def lerp_keys(z,keys):
 if z<=keys[0][0]:return keys[0][1]
 for (a,x),(b,y) in zip(keys,keys[1:]):
  if z<=b:
   t=(z-a)/(b-a);t=t*t*(3-2*t);return x+(y-x)*t
 return keys[-1][1]
def smoothstep(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
# Continuous ring topology for torso, neck, jaw and cranium. The original face depth
# is retained on the forward surface; scalp and garment use separate geometry.
width=[(-1,.57),(-.85,.64),(-.65,.63),(-.48,.68),(-.38,.69),(-.28,.48),(-.19,.24),(-.08,.145),(0,.145),(.08,.185),(.18,.23),(.3,.26),(.45,.275),(.58,.29),(.7,.29),(.8,.265),(.9,.16),(.955,.003)]
frontdepth=[(-1,.32),(-.85,.43),(-.65,.47),(-.48,.37),(-.38,.31),(-.28,.30),(-.19,.30),(-.08,.31),(0,.405),(.08,.50),(.18,.545),(.3,.54),(.45,.515),(.6,.51),(.72,.44),(.85,.30),(.955,.02)]
backdepth=[(-1,.25),(-.65,.29),(-.38,.27),(-.19,.15),(-.08,.10),(0,.13),(.3,.27),(.5,.31),(.7,.29),(.85,.20),(.955,.02)]
N=256;zs=sorted(set([-1+1.955*j/183 for j in range(184)]+[.34+i*.0025 for i in range(45)]));R=len(zs);vs=[];fs=[];ids=[]
for j in range(R):
 z=zs[j];rx=lerp_keys(z,width);fd=lerp_keys(z,frontdepth);bd=lerp_keys(z,backdepth)
 for i in range(N):
  a=2*pi*i/N;x=rx*sin(a)-.008;y=-fd*max(0,cos(a))**(.32 if z>-.15 else .62) if cos(a)>0 else -bd*cos(a)
  if cos(a)>0:
   # Clean anatomical relief fitted to the reconstruction. Avoid retaining the
   # scan's stray hair/crown ridges as facial anatomy.
   if -.005<z<.53:
    nose=.043*math.exp(-((x+.012)/.045)**2-((z-.273)/.050)**2)+.018*math.exp(-((x+.012)/.027)**2-((z-.355)/.092)**2)
    alae=.014*(math.exp(-((x+.047)/.022)**2-((z-.245)/.022)**2)+math.exp(-((x-.026)/.022)**2-((z-.245)/.022)**2))
    lips=.006*math.exp(-((x+.010)/.092)**4-((z-.147)/.028)**2)
    cheeks=.012*math.exp(-((abs(x+.01)-.145)/.065)**2-((z-.28)/.10)**2)
    eye_socket=.012*math.exp(-((abs(x+.005)-.13)/.067)**2-((z-.393)/.035)**2)
    y+=(-nose-alae-lips-cheeks+eye_socket)*smoothstep(.0,.045,z)*smoothstep(.10,.6,cos(a))
   # Woven clothing folds and a continuous fitted bust, rather than attached primitives.
   if z<-.23:
    b=math.exp(-((z+.73)/.2)**2)*math.exp(-((abs(x)-.25)/.19)**2)
    y-=.065*b*max(0,cos(a))**3
    y-=.009*sin(20*x+9*z)*smoothstep(-.25,-.8,z)*max(0,cos(a))**2
  vs.append((x,y,z))
for j in range(R-1):
 z=(zs[j]+zs[j+1])/2
 for i in range(N):
  a=2*pi*(i+.5)/N;fs.append((j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i))
  ids.append((0 if cos(a)>.30 else 1) if z>-.045 else (2 if cos(a)>.35 else 3))
fs.append(tuple(range(N-1,-1,-1)));ids.append(3)
fs.append(tuple((R-1)*N+i for i in range(N)));ids.append(1)
# Eye openings are cut into the head surface. Boundary vertices form attached lids.
eye_specs=[(-.136,.394,.061,.017),(.126,.394,.058,.0165)]
kept=[];keptids=[]
for f,mid in zip(fs,ids):
 cx=sum(vs[k][0]for k in f)/len(f);cy=sum(vs[k][1]for k in f)/len(f);cz=sum(vs[k][2]for k in f)/len(f)
 cut=cy<-.35 and any(((cx-ex)/ew)**2+((cz-ez)/eh)**2<1 for ex,ez,ew,eh in eye_specs)
 if not cut:kept.append(f);keptids.append(mid)
fs,ids=kept,keptids
edges={}
for f in fs:
 for a,b in zip(f,f[1:]+f[:1]):
  edge=tuple(sorted((a,b)));edges[edge]=edges.get(edge,0)+1
adj={}
for (a,b),count in edges.items():
 if count==1:adj.setdefault(a,[]).append(b);adj.setdefault(b,[]).append(a)
unseen=set(adj);eye_centers=[]
while unseen:
 first=next(iter(unseen));loop=[first];unseen.remove(first);prev=None;cur=first
 while True:
  opts=[n for n in adj[cur]if n!=prev]
  nxt=next((n for n in opts if n in unseen),None)
  if nxt is None:break
  loop.append(nxt);unseen.remove(nxt);prev,cur=cur,nxt
 ex,ez,ew,eh=min(eye_specs,key=lambda q:abs(sum(vs[k][0]for k in loop)/len(loop)-q[0]))
 avg_y=sum(vs[k][1]for k in loop)/len(loop)
 eye_centers.append((ex,avg_y+.063,ez,ew))
 inner=[]
 for k in loop:
  x,y,z=vs[k];dx=(x-ex)/ew;dz=(z-ez)/eh;rr=math.sqrt(dx*dx+dz*dz);x=ex+ew*dx/rr;z=ez+eh*dz/rr
  vs[k]=(x,y,z);inner.append(len(vs));vs.append((ex+(x-ex)*.97,y+.012,ez+(z-ez)*.96))
 for i in range(len(loop)):
  j=(i+1)%len(loop);fs.append((loop[i],loop[j],inner[j],inner[i]));ids.append(0)
body=mesh('AKSARA · continuous head neck shoulders',vs,fs,[face,skin,clothfront,velvet],ids,True)
# Separate eyeballs and radially colored irises are actual geometry inside the sockets.
sclera=material('Eyes · warm sclera',(.31,.285,.25),.3)
iris_mat=material('Eyes · amber radial iris',(1,1,1),.23)
node=iris_mat.node_tree.nodes.new('ShaderNodeVertexColor');node.layer_name='IrisColor';iris_mat.node_tree.links.new(node.outputs['Color'],iris_mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
for side,(ex,ey,ez,ew) in enumerate(eye_centers):
 # Spheres sit behind the lid surface, so the lids occlude them naturally.
 bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=32,location=(ex,ey,ez));o=bpy.context.object;o.name='Eye · seated globe %d'%side;o.scale=(ew*1.19,.060,.060);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(sclera)
 for p in o.data.polygons:p.use_smooth=True
 created.append(o)
 verts=[];faces=[];colors=[];RR=12;SS=96;rad=.025
 for j in range(RR):
  rr=.00003+(rad-.00003)*j/(RR-1)
  for k in range(SS):
   a=2*pi*k/SS;x=rr*cos(a);z=rr*sin(a)+.003;y=ey-.060*math.sqrt(max(.01,1-(x/(ew*1.19))**2-(z/.060)**2))-.0007;verts.append((ex+x,y,ez+z))
   f=rr/rad;grain=.65+.35*sin(k*2.3+j*.7)*sin(k*.43)
   if f<.34:col=(.003,.002,.001,1)
   elif f>.90:col=(.025,.012,.003,1)
   else:col=(.38*grain,.17*grain,.026*grain,1)
   colors.append(col)
 for j in range(RR-1):
  for k in range(SS):faces.append((j*SS+k,j*SS+(k+1)%SS,(j+1)*SS+(k+1)%SS,(j+1)*SS+k))
 ir=mesh('Eye · amber iris and pupil %d'%side,verts,faces,[iris_mat]);ca=ir.data.color_attributes.new(name='IrisColor',type='FLOAT_COLOR',domain='POINT')
 for v,c in zip(ca.data,colors):v.color=c
# A separate scalp with a genuine hairline. Closed rear surface, no scan perforations.
vs=[];fs=[];K=96;L=28
for j in range(L):
 for i in range(K):
  th=2*pi*i/K;f=abs((th+pi)%(2*pi)-pi);end=1.0+.8*smoothstep(.10,1.25,f);la=.012+(end-.012)*j/(L-1)
  vs.append((.348*sin(la)*sin(th)-.008,-.02-.555*sin(la)*cos(th),.48+.49*cos(la)))
for j in range(L-1):
 for i in range(K):fs.append((j*K+i,j*K+(i+1)%K,(j+1)*K+(i+1)%K,(j+1)*K+i))
hair_front=face.copy();hair_front.name='Hair · reference front detail';hair_front.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.48
cap=mesh('Hair · fitted scalp',vs,fs,[hair_front,hairs[1]],[0 if sum(vs[k][1]for k in f)/len(f)<-.12 else 1 for f in fs],True)
# Swept elliptical locks. Each lock has volume and follows a long continuous path.
def sweep(name,points,width,depth,mat,sides=8,taper_ends=True):
 verts=[];faces=[];pts=[Vector(p) for p in points]
 for j,p in enumerate(pts):
  t=j/(len(pts)-1);tangent=(pts[min(j+1,len(pts)-1)]-pts[max(j-1,0)]).normalized()
  normal=Vector((p.x,p.y,.04));normal-=normal.dot(tangent)*tangent
  if normal.length<.001:normal=Vector((0,-1,0))
  normal.normalize();side=tangent.cross(normal).normalized();taper=((.75+.25*sin(pi*t))*(1-.985*smoothstep(.72,1,t))) if taper_ends else 1
  for k in range(sides):
   a=2*pi*k/sides;v=p+side*(width*taper*cos(a))+normal*(depth*taper*sin(a));verts.append(tuple(v))
 for j in range(len(pts)-1):
  for k in range(sides):faces.append((j*sides+k,j*sides+(k+1)%sides,(j+1)*sides+(k+1)%sides,(j+1)*sides+k))
 faces.append(tuple(range(sides-1,-1,-1)));faces.append(tuple((len(pts)-1)*sides+k for k in range(sides)))
 return mesh(name,verts,faces,[mat])
# Long hair fans around the crown. A front opening leaves face and neck visible.
for n in range(94):
 th=.80+(2*pi-1.6)*n/93+random.uniform(-.02,.02);phase=random.uniform(0,2*pi);points=[];end=random.uniform(-1.02,-.84)
 for j in range(48):
  t=j/47
  if t<.45:
   start=.08+.45*abs(cos(th));la=start+(1.55-start)*(t/.45);rad=sin(la);x=.36*rad*sin(th)*smoothstep(0,.30,t/.45);y=-.02-.565*rad*cos(th);z=.48+.495*cos(la)
  else:
   q=(t-.45)/.55;radx=.36+.27*sin(q*pi*.58);rady=.565-.10*q;x=radx*sin(th);y=-.02-rady*cos(th);z=.49+(end-.49)*q
   x+=.05*sin(phase*.15+q*8)*sin(pi*q);y+=.028*sin(phase*.2+q*8)*sin(pi*q)
  points.append((x-.008,y,z))
 sweep('Hair · flowing lock %03d'%n,points,random.uniform(.024,.042),random.uniform(.012,.023),hairs[n%8])
# Temple curtains establish the parted hairstyle and conceal the scalp edge.
for sign in [-1,1]:
 for n in range(15):
  q=n/14;pts=[]
  controls=[Vector((sign*.012-.008,-.16-.18*q,.48+.50*math.sqrt(1-((.16+.18*q)/.565)**2))),Vector((sign*(.16+.10*q)-.008,-.49-.05*q,.73-.05*q)),Vector((sign*(.29+.08*q)-.008,-.55+.04*q,.45-.11*q)),Vector((sign*(.37+.10*q)-.008,-.48+.04*q,-.91+.11*q))]
  for j in range(52):
   t=j/51;u=1-t;p=controls[0]*(u**3)+controls[1]*(3*u*u*t)+controls[2]*(3*u*t*t)+controls[3]*(t**3);p.x+=sign*.045*sin(t*8+n*.08)*sin(pi*t);p.y+=.025*sin(t*7+n*.1)*sin(pi*t);pts.append(tuple(p))
  sweep('Hair · temple %s %02d'%(sign,n),pts,.015,.011,hairs[(n+2)%8])
# Fine strand ridges give direction to the locks without noise or floating islands.
for n in range(100):
 th=.84+(2*pi-1.68)*n/99;pts=[];end=random.uniform(-1.01,-.87)
 for j in range(40):
  t=j/39
  if t<.44:
   la=.09+1.48*t/.44;x=.375*sin(la)*sin(th);y=-.02-.589*sin(la)*cos(th);z=.48+.508*cos(la)
  else:
   q=(t-.44)/.56;x=(.375+.27*sin(q*pi*.58))*sin(th)+.012*sin(q*9+n);y=-.02-(.589-.10*q)*cos(th);z=.48+(end-.48)*q
  pts.append((x-.008,y,z))
 sweep('Hair · strand ridge %03d'%n,pts,.0024,.0018,hairs[(n+4)%8],6)
# Eyelid margins and lashes are fixed to the modeled socket, not floating facial decals.
lash=material('Eyes · lash line',(.008,.005,.004),.65)
for side,(ex,ey,ez,ew) in enumerate(eye_centers):
 pts=[]
 for k in range(41):
  a=pi*k/40;x=ex+ew*cos(a);z=ez+.0168*sin(a);rx=lerp_keys(z,width);fd=lerp_keys(z,frontdepth);c=math.sqrt(max(.001,1-((x+.008)/rx)**2));yy=-fd*c**.32+.008*math.exp(-((abs(x+.005)-.13)/.067)**2-((z-.393)/.035)**2);pts.append((x,yy-.001,z))
 sweep('Eye · upper lid margin %d'%side,pts,.0018,.0015,lash,6,False)
# Curved metal filigree is actual 3D geometry, separate from the skin/hair textures.
def tube(name,points,radius,mat):return sweep(name,points,radius,radius,mat,8,False)
def ring(name,center,r1,r2,mat):
 x,y,z=center;pts=[(x+r1*cos(a),y,z+r1*sin(a))for a in [2*pi*i/96 for i in range(97)]];return tube(name,pts,r2,mat)
def jewel(name,center,sizes,mat):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=center);o=bpy.context.object;o.name=name;o.scale=sizes;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
 for p in o.data.polygons:p.use_smooth=True
 created.append(o);return o
def extrude(name,poly,depth,mat,bevel=.002):
 n=len(poly);verts=[(x,y+d,z)for d in [-depth/2,depth/2]for x,y,z in poly];faces=[]
 tris=tessellate_polygon([[Vector(v)for v in poly]])
 for tri in tris:
  inds=[v if isinstance(v,int) else min(range(n),key=lambda k:(Vector(poly[k])-v).length)for v in tri];faces.append(tuple(reversed(inds)));faces.append(tuple(k+n for k in inds))
 for k in range(n):faces.append((k,(k+1)%n,(k+1)%n+n,k+n))
 o=mesh(name,verts,faces,[mat]);mod=o.modifiers.new('Rounded metal edges','BEVEL');mod.width=bevel;mod.segments=2;return o
# Sun: layered embossed disc, alternating curved rays, gemstone and rings.
cx,cy,cz=-.358,-.51,.66
jewel('Sun · cabochon',(cx,cy-.018,cz),(.064,.025,.064),gold)
ring('Sun · inner bezel',(cx,cy-.024,cz),.073,.006,gold);ring('Sun · outer filigree',(cx,cy,cz),.093,.0035,gold)
for i in range(24):
 a=2*pi*i/24;length=.15 if i%2==0 else .119;w=.012 if i%2==0 else .009
 pts=[(cx+.085*cos(a)-w*sin(a),cy,cz+.085*sin(a)+w*cos(a)),(cx+length*cos(a+.025),cy-.007,cz+length*sin(a+.025)),(cx+.085*cos(a)+w*sin(a),cy,cz+.085*sin(a)-w*cos(a))]
 extrude('Sun · ray %02d'%i,pts,.012,gold,.002)
# Moon: true crescent cut profile with a rounded extruded rim.
cx,cy,cz=.328,-.515,.68;R=.135;r=.127;d=.060;xx=(R*R-r*r+d*d)/(2*d);aa=math.acos(xx/R);bb=math.acos((xx-d)/r)
poly=[]
for i in range(61):a=aa+(2*pi-2*aa)*i/60;poly.append((cx+R*cos(a),cy,cz+R*sin(a)))
for i in range(61):a=(2*pi-bb)-(2*pi-2*bb)*i/60;poly.append((cx+d+r*cos(a),cy,cz+r*sin(a)))
extrude('Moon · solid crescent',poly,.022,silver,.003)
for radius,off in [(R,0),(r,d)]:
 a0=aa if off==0 else bb;span=2*pi-2*a0;pts=[(cx+off+radius*cos(a0+span*i/60),cy-.014,cz+radius*sin(a0+span*i/60))for i in range(61)];tube('Moon · engraved edge',pts,.002,silver)
# Forehead chain: smooth catenary and independent pendant.
pts=[]
for i in range(65):
 x=-.35+.68*i/64;z=.635+.035*(abs(x)/.35)**1.8;y=-.59+.08*(abs(x)/.35)**1.6;pts.append((x,y,z))
tube('Crown · brow chain',pts,.004,gold)
for i,z in enumerate([.615,.568,.52]):
 x=-.008;y=-.61;w=.014 if i==0 else .009;poly=[(x,y,z+.025),(x+w,y-.004,z),(x,y,z-.025),(x-w,y-.004,z)];extrude('Crown · pendant %d'%i,poly,.008,gold,.0015)
# Earrings and lunar hanging stones follow the reference attachment points.
for sign in [-1,1]:
 x=sign*.285-.008;top=.22;y=-.29
 tube('Earring · chain %d'%sign,[(x,y,top),(x,y-.015,top-.09),(x,y-.018,top-.17)],.0028,gold)
 z=top-.12;pts=[(x,y-.02,z+.034),(x+.013,y-.02,z),(x,y-.02,z-.034),(x-.013,y-.02,z)];extrude('Earring · star %d'%sign,pts,.009,gold,.001)
for i in range(3):
 x=.31+.039*i;z=.53-.022*i;y=-.512
 tube('Moon · drop chain %d'%i,[(x,y,.60),(x,y,z-.06)],.0018,silver)
 extrude('Moon · sapphire drop %d'%i,[(x,y,z),(x+.010,y-.005,z-.03),(x,y,z-.065),(x-.010,y-.005,z-.03)],.012,sapphire,.001)
# Structured collar and embossed gown ornaments follow the actual 3D surface.
bodybvh=BVHTree.FromObject(body,bpy.context.evaluated_depsgraph_get())
def surface(x,z,offset=.005):
 loc,n,idx,dist=bodybvh.ray_cast(Vector((x,-2,z)),Vector((0,1,0)),3)
 return (x,loc.y-offset if loc else -.35,z)
def ornament(name,xz,r,mat):return tube(name,[surface(x,z,.007)for x,z in xz],r,mat)
def bezier2(p0,p1,p2,p3,steps=40):
 return [tuple((1-t)**3*p0[k]+3*(1-t)**2*t*p1[k]+3*(1-t)*t*t*p2[k]+t**3*p3[k] for k in [0,1])for t in [j/(steps-1)for j in range(steps)]]
for sign in [-1,1]:
 # Raised collar opening, echoing the approved high-neck gown.
 collar=bezier2((0,-.28),(sign*.12,-.18),(sign*.115,-.09),(sign*.17,-.055))
 ornament('Collar · gold bound edge %d'%sign,collar,.006,gold)
 ornament('Collar · inner stitch %d'%sign,[(x*1.10,z-.013)for x,z in collar],.0018,gold)
 # Main sweeping chest border and a second delicate edge.
 path=bezier2((sign*.012,-.99),(sign*.14,-.70),(sign*.38,-.63),(sign*.55,-.57),64)
 ornament('Gown · sweeping embroidery %d'%sign,path,.006,gold if sign<0 else silver)
 ornament('Gown · fine border %d'%sign,[(x*1.065,z+.013)for x,z in path],.0022,gold)
 # Leaf and scroll filigree: volumetric metal fixed to the gown surface.
 for j in range(7):
  t=.18+.10*j;idx=int(t*(len(path)-1));x,z=path[idx];amp=.035+.018*j/6
  leaf=bezier2((x,z),(x+sign*amp,z+.065),(x+sign*(amp+.055),z+.035),(x+sign*.012,z-.015),26)
  ornament('Gown · leaf %d %02d'%(sign,j),leaf,.0028,gold if sign<0 else silver)
  if j%2==0:
   leaf2=bezier2((x,z),(x-sign*.05,z+.03),(x-sign*.07,z+.08),(x-sign*.012,z+.06),24)
   ornament('Gown · inner curl %d %02d'%(sign,j),leaf2,.002,gold)
 shoulder=bezier2((sign*.23,-.28),(sign*.39,-.24),(sign*.57,-.34),(sign*.66,-.43))
 ornament('Shoulder · bound seam %d'%sign,shoulder,.003,gold if sign<0 else silver)
 # Brooch chains hang in a shallow curve across the breast.
 chain=bezier2((sign*.44,-.40),(sign*.47,-.62),(sign*.29,-.91),(sign*.04,-.96),56)
 ornament('Gown · chain %d'%sign,chain,.0018,gold)
# The throat star and chest medallion have independent mesh volume.
for z,size in [(-.285,.031),(-.49,.075)]:
 x=0;y=min(surface(dx,z+dz,.022)[1]for dx in [-size,0,size]for dz in [-size,0,size])
 jewel('Gown · celestial cabochon %.2f'%z,(x,y,z),(size,.018,size),sapphire)
 ring('Gown · bezel %.2f'%z,(x,y-.008,z),size*1.09,.0035,gold)
 for i in range(16 if size>.04 else 8):
  a=2*pi*i/(16 if size>.04 else 8);outer=size*(1.9 if i%2==0 else 1.45);base=size*1.12;w=.006
  poly=[(x+base*cos(a)-w*sin(a),y,z+base*sin(a)+w*cos(a)),(x+outer*cos(a),y-.002,z+outer*sin(a)),(x+base*cos(a)+w*sin(a),y,z+base*sin(a)-w*cos(a))]
  extrude('Gown · celestial ray %.2f %02d'%(z,i),poly,.009,gold if cos(a)<0 else silver,.001)
# Staging and honest review outputs: no armature, deformation or animation claim.
scene=bpy.context.scene;scene.render.engine='CYCLES'
scene.world=bpy.data.worlds.new('AKSARA night');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35
for name,loc,col,power,size in [('key',(-3,-4,4),(1,.8,.64),300,4),('fill',(3,-3,1),(.4,.6,1),130,3),('rim',(0,3,2),(.3,.45,1),290,3)]:
 bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.name=name;light.data.energy=power;light.data.color=col;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(Vector((0,0,0))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(0,-5,.005));scene.camera=bpy.context.object;scene.camera.data.type='ORTHO'
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
scene=bpy.context.scene;scene.cycles.samples=20;scene.cycles.use_denoising=True
scene.render.resolution_x=760;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.camera.data.ortho_scale=2.37
for l in bpy.data.lights:
 if l.name=='key':l.energy=300
 if l.name=='fill':l.energy=130
 if l.name=='rim':l.energy=290
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.014,.022,.04,1)
scene['status']='UNAPPROVED · reconstructed bust and materials · no rig or animation'
scene['source']='Derived from Hunyuan reconstruction and approved AKSARA artwork; rear design provisional'
scene.camera.location=(0,-5,.005);scene.camera.rotation_euler=(Vector((0,0,.005))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/AKSARA-head-shoulders-v2-UNAPPROVED.blend')
for name,angle in [('front',0),('quarter',35),('profile',90),('back',180)]:
 a=math.radians(angle);c=scene.camera;c.location=(5*sin(a),-5*cos(a),.005);c.rotation_euler=(Vector((0,0,.005))-c.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=OUT+'/v2-'+name+'.png';bpy.ops.render.render(write_still=True)
print('CREATED_OBJECTS',len(created),flush=True)
