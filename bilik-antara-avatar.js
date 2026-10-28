/* Bilik Antara · Female voice avatar, loaded only during Voice Live.
   Avatar: TalkingHead example brunette.glb by Ready Player Me.
   Source: https://github.com/met4citizen/TalkingHead
   License: CC BY-NC 4.0 (noncommercial use with attribution). */
const panel=document.getElementById("voicePanel");
const stage=document.getElementById("voiceAvatarStage");
if(panel&&stage){
let active=false,renderer=null,scene=null,camera=null,root=null,face=null,raf=0,resize=null,context=null,blinkAt=0,started=0,loading=false,jawMotion=0,lipMotion=0,morphIndex=null,resizeFrame=0,lastWidth=0,lastHeight=0;
const modelURL="https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@main/avatars/brunette.glb";
// Cache the exact PNG snapshot of the voice avatar: repeat visits need no WebGL portrait pass.
const portraitCacheKey="bilik-antara-chat-portrait-png-v1";
function showPortrait(picture){
 if(typeof picture!=="string"||!picture.startsWith("data:image/png;base64,")||picture.length>450000)return false;
 if(!/^[A-Za-z0-9+/=]+$/.test(picture.slice(22)))return false;
 document.documentElement.style.setProperty("--ai-chat-portrait",'url("'+picture+'")');
 document.documentElement.classList.add("chat-portrait-ready");
 return true;
}
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
// Pre-index morph targets once; matching 900+ names every animation frame wastes CPU.
function indexMorphTargets(){
 morphIndex=new Map();
 if(!face?.morphTargetDictionary)return;
 for(const [key,index] of Object.entries(face.morphTargetDictionary)){
  const name=key.slice(key.lastIndexOf(".")+1);
  if(!morphIndex.has(name))morphIndex.set(name,[]);
  morphIndex.get(name).push(index);
 }
}
function weights(names,value){
 if(!face?.morphTargetInfluences||!morphIndex)return;
 for(const name of names)for(const index of morphIndex.get(name)||[])face.morphTargetInfluences[index]=value;
}
function stop(){
 active=false;cancelAnimationFrame(raf);raf=0;cancelAnimationFrame(resizeFrame);resizeFrame=0;resize?.disconnect();resize=null;
 if(renderer){renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();renderer=null;}
 if(scene){scene.traverse(o=>{if(o.isMesh){o.geometry?.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats)m?.dispose?.();}});}
 scene=null;camera=null;root=null;face=null;morphIndex=null;lastWidth=0;lastHeight=0;stage.classList.remove("avatar-ready","avatar-speaking","avatar-loading");
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
  // Frame only the upper body: this model contains a whole character.
  const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const scale=2.5/Math.max(size.y,.1);root.scale.setScalar(scale);
  const basePosition=center.clone().multiplyScalar(-scale);
  root.position.copy(basePosition);
  // Camera follows the actual head, not the center of the whole character.
  const frameModel=()=>{
    const w=stage.clientWidth,h=stage.clientHeight;
    if(!w||!h)return;
    root.updateMatrixWorld(true);
    const headMesh=root.getObjectByName("Wolf3D_Head");
    const headBox=headMesh?new THREE.Box3().setFromObject(headMesh):null;
    const validHead=headBox&&!headBox.isEmpty()&&headBox.getSize(new THREE.Vector3()).y>0.02;
    const target=validHead?headBox.getCenter(new THREE.Vector3()):new THREE.Vector3(0,size.y*scale*.20,0);
    // Keep head in the upper half and show neck/shoulders below it.
    const headHeight=validHead?headBox.getSize(new THREE.Vector3()).y:size.y*scale*.18;
    const headWidth=validHead?headBox.getSize(new THREE.Vector3()).x:size.x*scale*.35;
    const visibleHeight=Math.max(headHeight*2.55,headWidth*1.8/(w/h),.42);
    const fov=THREE.MathUtils.degToRad(camera.fov);
    const distance=visibleHeight/(2*Math.tan(fov/2));
    camera.position.set(target.x,target.y-headHeight*.38,target.z+Math.max(.75,distance));
    camera.lookAt(target.x,target.y-headHeight*.38,target.z);
  };
  face=root.getObjectByName("Wolf3D_Head")||null;
  if(!face)root.traverse(o=>{if(!face&&o.morphTargetInfluences&&o.morphTargetDictionary)face=o;});
  indexMorphTargets();
  root.traverse(o=>{if(o.isMesh){o.frustumCulled=false;if(o.material){const m=o.material;m.side=THREE.FrontSide;if("roughness" in m)m.roughness=.5;if("metalness" in m)m.metalness=.22;}}});
  resize=new ResizeObserver(()=>{
   if(resizeFrame||!renderer)return;
   resizeFrame=requestAnimationFrame(()=>{
    resizeFrame=0;if(!renderer)return;
    const w=stage.clientWidth,h=stage.clientHeight;
    if(!w||!h||(w===lastWidth&&h===lastHeight))return;
    lastWidth=w;lastHeight=h;renderer.setSize(w,h,false);
    camera.aspect=w/h;frameModel();camera.updateProjectionMatrix();
   });
  });
  resize.observe(stage);frameModel();stage.classList.add("avatar-ready");stage.classList.remove("avatar-loading");blinkAt=performance.now()+2300;
  const frame=(t)=>{if(!active||!renderer)return;raf=requestAnimationFrame(frame);
   const speaking=panel.classList.contains("voice-speaking");
   stage.classList.toggle("avatar-speaking",speaking);
   root.rotation.y=Math.sin(t*.0004)*.075;root.rotation.x=Math.sin(t*.00031)*.025;
   root.position.y=basePosition.y+Math.sin(t*.00085)*.018;
   const duration=t-blinkAt,blink=(duration>=0&&duration<190)?Math.sin(duration/190*Math.PI):0;
   if(duration>190)blinkAt=t+1900+Math.random()*2800;
   weights(["eyeBlinkLeft","eyeBlinkRight"],blink*.9);
   // Keep the jaw relaxed: driving jawOpen + mouthOpen + viseme_aa equally
   // exaggerated the opening and made the avatar look startled while talking.
   // A small smoothed syllable movement looks closer to natural conversation.
   const syllable=Math.pow(Math.max(0,Math.sin(t*.014)+.32*Math.sin(t*.027)),2);
   const targetJaw=speaking?clamp(.028+syllable*.064,.018,.115):.006;
   const targetLips=speaking?clamp(.012+syllable*.048,.008,.085):.005;
   jawMotion+=(targetJaw-jawMotion)*.18;
   lipMotion+=(targetLips-lipMotion)*.21;
   weights(["jawOpen"],jawMotion);
   weights(["mouthOpen"],lipMotion*.45);
   weights(["viseme_aa"],lipMotion*.55);
   weights(["mouthSmileLeft","mouthSmileRight"],speaking?.025:.018);
   renderer.render(scene,camera);
  };
  raf=requestAnimationFrame(frame);
 }catch(err){console.warn("Voice avatar model not available",err);stop();stage.classList.add("avatar-unavailable");}
 finally{loading=false;}
}
// One-time square portrait taken from the SAME 3D face as Voice Chat.
// The chat logo stays static to avoid dozens of active WebGL contexts.
async function buildChatPortrait(){
 let smallRenderer=null,kt=null,model=null;
 try{
  const [THREE,{GLTFLoader},{KTX2Loader},{MeshoptDecoder}]=await Promise.all([
   import("three"),import("three/addons/loaders/GLTFLoader.js"),
   import("three/addons/loaders/KTX2Loader.js"),import("three/addons/libs/meshopt_decoder.module.js")
  ]);
  smallRenderer=new THREE.WebGLRenderer({alpha:false,antialias:true,preserveDrawingBuffer:true,powerPreference:"low-power"});
  smallRenderer.setSize(160,160,false);
  smallRenderer.outputColorSpace=THREE.SRGBColorSpace;
  smallRenderer.toneMapping=THREE.ACESFilmicToneMapping;
  smallRenderer.toneMappingExposure=1.2;
  kt=new KTX2Loader().setTranscoderPath("https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/libs/basis/").detectSupport(smallRenderer);
  model=(await new GLTFLoader().setKTX2Loader(kt).setMeshoptDecoder(MeshoptDecoder).loadAsync(modelURL)).scene;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x0a1019);scene.add(model);
  scene.add(new THREE.HemisphereLight(0xaaa4c5,0x17131b,1.15));
  const light=new THREE.DirectionalLight(0xf6d6ab,3.2);light.position.set(-2,3,4);scene.add(light);
  const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
  const center=bounds.getCenter(new THREE.Vector3());
  const scale=2.5/Math.max(size.y,.1);model.scale.setScalar(scale);
  model.position.copy(center.multiplyScalar(-scale));model.updateMatrixWorld(true);
  const head=model.getObjectByName("Wolf3D_Head");
  const headBounds=head?new THREE.Box3().setFromObject(head):null;
  const found=headBounds&&!headBounds.isEmpty()&&headBounds.getSize(new THREE.Vector3()).y>.02;
  const target=found?headBounds.getCenter(new THREE.Vector3()):new THREE.Vector3(0,size.y*scale*.20,0);
  const headHeight=found?headBounds.getSize(new THREE.Vector3()).y:size.y*scale*.18;
  const camera=new THREE.PerspectiveCamera(34,1,.1,50);
  camera.position.set(target.x,target.y-headHeight*.10,target.z+Math.max(.8,headHeight*2.6));
  camera.lookAt(target.x,target.y-headHeight*.10,target.z);
  camera.updateProjectionMatrix();
  smallRenderer.render(scene,camera);
  const picture=smallRenderer.domElement.toDataURL("image/png");
  if(showPortrait(picture)){
   try{localStorage.setItem(portraitCacheKey,picture);}catch(_){}
  }
 }catch(err){console.warn("Chat avatar portrait unavailable; keeping monogram.",err);}
 finally{
  kt?.dispose();
  if(model)model.traverse(o=>{if(o.isMesh){o.geometry?.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];for(const mat of mats)mat?.dispose?.();}});
  if(smallRenderer){smallRenderer.dispose();smallRenderer.forceContextLoss();}
 }
}
// Reuse the exact pixel-for-pixel portrait on return visits; render it only once.
let portraitCached=false;
try{portraitCached=showPortrait(localStorage.getItem(portraitCacheKey));}catch(_){}
if(!portraitCached){
 if("requestIdleCallback" in window)window.requestIdleCallback(()=>buildChatPortrait(),{timeout:2000});
 else window.setTimeout(buildChatPortrait,300);
}
const observer=new MutationObserver(()=>{if(panel.hidden){if(active)stop();}else if(!active&&!loading)begin();});
observer.observe(panel,{attributes:true,attributeFilter:["hidden"]});
if(!panel.hidden)begin();
window.addEventListener("pagehide",()=>{stop();observer.disconnect();},{once:true});
}
