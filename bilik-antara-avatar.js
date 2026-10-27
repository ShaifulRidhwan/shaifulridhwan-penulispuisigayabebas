/* Bilik Antara · FaceCap avatar, loaded only while Voice Live is open.
   FaceCap source: Three.js example / Face Cap; see attribution below. */
const panel=document.getElementById("voicePanel");
const stage=document.getElementById("voiceAvatarStage");
if(panel&&stage){
let active=false,renderer=null,scene=null,camera=null,root=null,face=null,raf=0,resize=null,context=null,blinkAt=0,started=0,loading=false;
const modelURL="https://cdn.jsdelivr.net/gh/mrdoob/three.js@r184/examples/models/gltf/facecap.glb";
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function weights(names,value){if(!face?.morphTargetDictionary)return;for(const name of names){for(const [k,i] of Object.entries(face.morphTargetDictionary)){if(k===name||k.endsWith("."+name)){face.morphTargetInfluences[i]=value;}}}}
function stop(){
 active=false;cancelAnimationFrame(raf);raf=0;resize?.disconnect();resize=null;
 if(renderer){renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();renderer=null;}
 if(scene){scene.traverse(o=>{if(o.isMesh){o.geometry?.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats)m?.dispose?.();}});}
 scene=null;camera=null;root=null;face=null;stage.classList.remove("avatar-ready","avatar-speaking","avatar-loading");
}
async function begin(){
 if(active||loading)return;active=true;loading=true;started=performance.now();stage.classList.add("avatar-loading");
 try{
  const [THREE,{GLTFLoader},{KTX2Loader},{MeshoptDecoder}]=await Promise.all([
   import("three"),import("three/addons/loaders/GLTFLoader.js"),
   import("three/addons/loaders/KTX2Loader.js"),import("three/addons/libs/meshopt_decoder.module.js")
  ]);
  if(!active)return;
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(34,1,.1,40);camera.position.set(0,0,4.5);
  renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:"low-power"});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  renderer.domElement.className="voice-avatar-canvas";renderer.domElement.setAttribute("aria-hidden","true");
  stage.prepend(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xaaa4c5,0x100e12,.85));
  const key=new THREE.DirectionalLight(0xeac58d,2.15);key.position.set(-2.8,2.4,3.0);scene.add(key);
  const rim=new THREE.DirectionalLight(0x56708c,2.4);rim.position.set(2.5,1.4,-1.0);scene.add(rim);
  const kt=new KTX2Loader().setTranscoderPath("https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/libs/basis/").detectSupport(renderer);
  const gltf=await new GLTFLoader().setKTX2Loader(kt).setMeshoptDecoder(MeshoptDecoder).loadAsync(modelURL);
  kt.dispose();if(!active){gltf.scene.traverse(o=>{o.geometry?.dispose?.();});return;}
  root=gltf.scene;scene.add(root);
  const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  root.position.sub(center);const scale=1.45/Math.max(size.y,.1);root.scale.setScalar(scale);
  // Center AFTER scaling: the previous unscaled offset put the face outside frame.
  const basePosition=center.clone().multiplyScalar(-scale);
  root.position.copy(basePosition);
  const frameModel=()=>{
    if(!stage.clientWidth||!stage.clientHeight)return;
    const aspect=stage.clientWidth/stage.clientHeight;
    const vfov=THREE.MathUtils.degToRad(camera.fov);
    const visibleHeight=Math.max(size.y*scale, size.x*scale/Math.max(aspect,.2));
    const distance=(visibleHeight/Math.tan(vfov/2))*.9 + Math.max(size.z*scale,.2);
    camera.position.set(0,0,Math.max(3.4,distance));camera.lookAt(0,0,0);
  };
  face=root.getObjectByName("mesh_2")||null;
  if(!face)root.traverse(o=>{if(!face&&o.morphTargetInfluences&&o.morphTargetDictionary)face=o;});
  root.traverse(o=>{if(o.isMesh){o.frustumCulled=false;if(o.material){const m=o.material;m.side=THREE.FrontSide;if("roughness" in m)m.roughness=.5;if("metalness" in m)m.metalness=.22;}}});
  resize=new ResizeObserver(()=>{if(!renderer)return;const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;frameModel();camera.updateProjectionMatrix();});
  resize.observe(stage);frameModel();stage.classList.add("avatar-ready");stage.classList.remove("avatar-loading");blinkAt=performance.now()+2300;
  const frame=(t)=>{if(!active||!renderer)return;raf=requestAnimationFrame(frame);
   const speaking=panel.classList.contains("voice-speaking");
   stage.classList.toggle("avatar-speaking",speaking);
   root.rotation.y=Math.sin(t*.0004)*.075;root.rotation.x=Math.sin(t*.00031)*.025;
   root.position.y=basePosition.y+Math.sin(t*.00085)*.018;
   const duration=t-blinkAt,blink=(duration>=0&&duration<190)?Math.sin(duration/190*Math.PI):0;
   if(duration>190)blinkAt=t+1900+Math.random()*2800;
   weights(["eyeBlinkLeft","eyeBlinkRight"],blink*.9);
   const mouth=speaking?.18+.14*Math.abs(Math.sin(t*.019)):.012;
   weights(["jawOpen","mouthOpen","viseme_aa"],mouth);
   weights(["mouthSmileLeft","mouthSmileRight"],speaking?.07:.03);
   renderer.render(scene,camera);
  };
  raf=requestAnimationFrame(frame);
 }catch(err){console.warn("Voice avatar model not available",err);stop();stage.classList.add("avatar-unavailable");}
 finally{loading=false;}
}
const observer=new MutationObserver(()=>{if(panel.hidden){if(active)stop();}else if(!active&&!loading)begin();});
observer.observe(panel,{attributes:true,attributeFilter:["hidden"]});
if(!panel.hidden)begin();
window.addEventListener("pagehide",()=>{stop();observer.disconnect();},{once:true});
}
