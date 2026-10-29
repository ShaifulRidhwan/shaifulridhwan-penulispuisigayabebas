/* Bilik Antara · Female voice avatar, loaded only during Voice Live.
   Avatar: TalkingHead example brunette.glb by Ready Player Me.
   Source: https://github.com/met4citizen/TalkingHead
   License: CC BY-NC 4.0 (noncommercial use with attribution). */
const panel=document.getElementById("voicePanel");
const stage=document.getElementById("voiceAvatarStage");
if(panel&&stage){
let active=false,renderer=null,scene=null,camera=null,root=null,face=null,raf=0,resize=null,context=null,blinkAt=0,started=0,loading=false,jawMotion=0,lipMotion=0,morphIndex=null,resizeFrame=0,lastWidth=0,lastHeight=0,emotion="neutral",emotionUntil=0,emotionLevel=0,expressionWeights={},tearMeshes=[],audioArray=null,audioSpectrum=null,audioAnalyser=null,mouthRound=0;
const modelURL="https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@main/avatars/brunette.glb";
// The chat still is an exact pre-rendered frame of this same GLB model.
 // No WebGL, GLTF decoding, or 3D assets run in the normal chat page.
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
// Pre-index morph targets once; matching 900+ names every animation frame wastes CPU.
function indexMorphTargets(){
 morphIndex=new Map();
 root?.traverse(mesh=>{
  if(!mesh.morphTargetDictionary||!mesh.morphTargetInfluences)return;
  for(const [key,index] of Object.entries(mesh.morphTargetDictionary)){
   const name=key.slice(key.lastIndexOf(".")+1);
   if(!morphIndex.has(name))morphIndex.set(name,[]);
   morphIndex.get(name).push({mesh,index});
  }
 });
}
function weights(names,value){
 if(!morphIndex)return;
 for(const name of names)for(const entry of morphIndex.get(name)||[])entry.mesh.morphTargetInfluences[entry.index]=value;
}
// Conservative cues in Aksara's own transcript; uncertain text stays neutral.
function emotionFor(text){
 const t=String(text||"").toLocaleLowerCase("ms-MY").slice(-360);
 if(/\b(?:menangis|air mata|tersedu)\b/.test(t))return "cry";
 if(/\b(?:berduka|kehilangan|takziah|dukacita)\b/.test(t))return "sad";
 if(/\b(?:terkejut|tak sangka|wow)\b/.test(t))return "surprised";
 if(/\b(?:aku|saya) (?:betul-betul |memang |tengah )?(?:geram|marah|menyampah)\b/.test(t))return "angry";
 if(/\b(?:aku|saya) (?:betul-betul |memang |tengah )?(?:stress|tertekan|cemas|risau)\b/.test(t))return "stressed";
 if(/\b(?:hahaha+|hehehe+|mwehehe|ketawa)\b/.test(t))return "laugh";
 if(/\b(?:gembira|seronok|tahniah|syabas)\b/.test(t))return "smile";
 if(/\b(?:aku fikir|cuba fikir|menarik untuk difikirkan)\b/.test(t))return "thinking";
 return "neutral";
}
function onAvatarText(event){
 const next=emotionFor(event.detail?.text);
 if(next!=="neutral"){emotion=next;emotionUntil=performance.now()+4200;}
}
window.addEventListener("ba:voice-avatar-text",onAvatarText);
function audioLevel(){
 const analyser=window.AksaraVoiceAudio?.analyser;
 if(!analyser)return 0;
 if(analyser!==audioAnalyser){audioAnalyser=analyser;audioArray=new Float32Array(analyser.fftSize);audioSpectrum=new Float32Array(analyser.frequencyBinCount);}
 analyser.getFloatTimeDomainData(audioArray);
 let sum=0;for(const sample of audioArray)sum+=sample*sample;
 const level=clamp(Math.sqrt(sum/audioArray.length)*8,0,1);
 // A gentle spectral hint varies rounded mouth shapes; this is not phoneme recognition.
 if(level>.03&&audioSpectrum.length&&typeof analyser.getFloatFrequencyData==="function"){
  analyser.getFloatFrequencyData(audioSpectrum);
  let low=0,high=0;
  for(let i=1;i<audioSpectrum.length;i++){
   const power=Math.pow(10,Math.max(-100,audioSpectrum[i])/20);
   if(i<12)low+=power;else if(i<55)high+=power;
  }
  mouthRound=clamp((low/(low+high+.0001)-.35)*.8,0,.25);
 }else mouthRound=0;
 return level;
}
// A lightweight trial hairstyle, built around the existing head and hair mesh.
function installMessyBun(THREE,model,mergeGeometries){
 const hair=model.getObjectByName("Wolf3D_Hair");
 const position=hair?.geometry?.getAttribute("position"),index=hair?.geometry?.getIndex();
 if(!hair||!position||!index)return false;
 const original=hair.geometry,trimmed=original.clone(),kept=[];
 // Keep the fringe and crown, while shortening the original hanging hair.
 for(let i=0;i<index.count;i+=3){
  const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);
  if(Math.min(position.getY(a),position.getY(b),position.getY(c))>1.565)kept.push(a,b,c);
 }
 if(!kept.length)return false;
 trimmed.setIndex(kept);
 const group=new THREE.Group();group.name="Aksara_MessyBun";
 const locks=[];
 const dark=new THREE.MeshStandardMaterial({color:0x171311,roughness:.83,metalness:0});
 const strands=new THREE.MeshStandardMaterial({color:0x30241e,roughness:.82,metalness:0});
 const bun=new THREE.Mesh(new THREE.SphereGeometry(.071,20,14),dark);
 bun.position.set(0,1.745,-.115);bun.scale.set(1.12,.74,.82);group.add(bun);
 const lobes=new THREE.InstancedMesh(new THREE.SphereGeometry(.025,10,7),dark,28);
 const transform=new THREE.Object3D();
 for(let i=0;i<28;i++){
  const angle=i*2.39996,r=.034+.019*((i%4)/3);
  transform.position.set(Math.cos(angle)*r,1.746+Math.sin(angle)*r*.68,-.15+(i%3)*.012);
  transform.scale.set(1.05,.7,.65);transform.updateMatrix();lobes.setMatrixAt(i,transform.matrix);
 }
 group.add(lobes);
 // Fine irregular locks frame the face; swept strands lead back to the bun.
 for(let i=0;i<26;i++){
  const side=i%2?1:-1,j=Math.floor(i/2),dx=(j-6)*.003;
  const points=[
   new THREE.Vector3(side*(.067+dx),1.69+(j%3)*.006,.085),
   new THREE.Vector3(side*(.104+dx*.4),1.73+(j%4)*.004,.016),
   new THREE.Vector3(side*(.072+dx*.6),1.775-(j%3)*.005,-.065),
   new THREE.Vector3(side*(.014+dx),1.75+(j%4)*.004,-.12)
  ];
  const curve=new THREE.CatmullRomCurve3(points);
  locks.push(new THREE.TubeGeometry(curve,14,.0014+(j%3)*.00035,4,false));
 }
 for(let side of [-1,1])for(let i=0;i<3;i++){
  const x=side*(.082+i*.004);
  const curve=new THREE.CatmullRomCurve3([
   new THREE.Vector3(x,1.682,.091),new THREE.Vector3(x+side*.009,1.63,.102),
   new THREE.Vector3(x+side*(.015+i*.002),1.575,.094),new THREE.Vector3(x+side*.011,1.54-(i%2)*.015,.08)
  ]);
  locks.push(new THREE.TubeGeometry(curve,12,.0014,4,false));
 }
 const merged=mergeGeometries(locks);locks.forEach(g=>g.dispose());
 if(merged)group.add(new THREE.Mesh(merged,strands));
 model.add(group);hair.geometry=trimmed;original.dispose();return true;
}
function stop(){
 active=false;cancelAnimationFrame(raf);raf=0;cancelAnimationFrame(resizeFrame);resizeFrame=0;resize?.disconnect();resize=null;
 if(renderer){renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();renderer=null;}
 if(scene){scene.traverse(o=>{if(o.isMesh){o.geometry?.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats)m?.dispose?.();}});}
 scene=null;camera=null;root=null;face=null;morphIndex=null;tearMeshes=[];audioArray=null;audioSpectrum=null;audioAnalyser=null;mouthRound=0;emotion="neutral";emotionLevel=0;expressionWeights={};lastWidth=0;lastHeight=0;stage.classList.remove("avatar-ready","avatar-speaking","avatar-loading");
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
  if(new URLSearchParams(window.location.search).get("gaya")==="messybun"){
   try{
    const {mergeGeometries}=await import("three/addons/utils/BufferGeometryUtils.js");
    if(active)installMessyBun(THREE,root,mergeGeometries);
   }catch(err){console.warn("Messy bun unavailable",err);}
   if(!active)return;
  }
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
  // Tiny translucent droplets live in 3D, anchored to the head rather than the screen.
  if(face){
   root.updateMatrixWorld(true);
   const box=new THREE.Box3().setFromObject(face),sz=box.getSize(new THREE.Vector3());
   if(!box.isEmpty()&&sz.y>0){
    for(const x of [.35,.65]){
     const mat=new THREE.MeshBasicMaterial({color:0xb6dfff,transparent:true,opacity:0,depthWrite:false});
     const drop=new THREE.Mesh(new THREE.SphereGeometry(.007,8,6),mat);
     const p=new THREE.Vector3(box.min.x+sz.x*x,box.min.y+sz.y*.55,box.max.z+.004);
     root.worldToLocal(p);drop.position.copy(p);drop.userData.baseY=p.y;drop.scale.set(.6,1.25,.5);root.add(drop);tearMeshes.push(drop);
    }
   }
  }
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
   // The 3D canvas is fully hidden when minimized. Preserve the active voice,
   // model and speaking state, but skip all invisible WebGL drawing work.
   if(panel.classList.contains("is-minimized")||document.hidden)return;
   const speaking=panel.classList.contains("voice-speaking");
   stage.classList.toggle("avatar-speaking",speaking);
   root.rotation.y=Math.sin(t*.0004)*.075;root.rotation.x=Math.sin(t*.00031)*.025+(emotion==="laugh"?Math.sin(t*.012)*.012:0);
   root.position.y=basePosition.y+Math.sin(t*.00085)*.018;
   const duration=t-blinkAt,blink=(duration>=0&&duration<190)?Math.sin(duration/190*Math.PI):0;
   if(duration>190)blinkAt=t+1900+Math.random()*2800;
   weights(["eyeBlinkLeft","eyeBlinkRight"],blink*.9);
   // Analyze the audio actually being played; silence naturally closes the mouth.
   const level=speaking?audioLevel():0;
   const targetJaw=clamp(level*.23,0,.23),targetLips=clamp(level*.14,0,.14);
   jawMotion+=(targetJaw-jawMotion)*.28;lipMotion+=(targetLips-lipMotion)*.28;
   weights(["jawOpen"],jawMotion);
   weights(["mouthOpen"],lipMotion*.4);
   weights(["viseme_aa"],lipMotion*.55);
   weights(["viseme_O","viseme_U"],speaking?mouthRound*level*.32:0);
   if(t>emotionUntil)emotion="neutral";
   const targetEmotion=emotion==="neutral"?0:1;
   emotionLevel+=(targetEmotion-emotionLevel)*.06;
   const targets={
    mouthSmile:emotion==="laugh"?.38:emotion==="smile"?.26:.018,
    mouthFrown:(emotion==="sad"||emotion==="cry")?.22:emotion==="stressed"?.1:0,
    browDown:emotion==="angry"?.34:emotion==="stressed"?.18:0,
    browInner:(emotion==="sad"||emotion==="cry")?.3:emotion==="surprised"?.35:emotion==="thinking"?.12:0,
    eyeWide:emotion==="surprised"?.2:0,
    eyeSquint:emotion==="laugh"?.25:emotion==="angry"?.1:0
   };
   for(const key of Object.keys(targets))expressionWeights[key]=(expressionWeights[key]||0)+(targets[key]-(expressionWeights[key]||0))*.06;
   weights(["mouthSmileLeft","mouthSmileRight"],expressionWeights.mouthSmile);
   weights(["mouthFrownLeft","mouthFrownRight"],expressionWeights.mouthFrown);
   weights(["browDownLeft","browDownRight"],expressionWeights.browDown);
   weights(["browInnerUp"],expressionWeights.browInner);
   weights(["eyeWideLeft","eyeWideRight"],expressionWeights.eyeWide);
   weights(["eyeSquintLeft","eyeSquintRight"],expressionWeights.eyeSquint);
   const glance=Math.max(0,Math.sin(t*.00043))* .10;
   weights(["eyeLookInLeft","eyeLookOutRight"],glance);
   weights(["eyeLookOutLeft","eyeLookInRight"],Math.max(0,-Math.sin(t*.00043))*.10);
   for(const drop of tearMeshes){
    const show=emotion==="cry"&&emotionLevel>.15;
    drop.visible=show;drop.material.opacity=show?Math.min(.65,emotionLevel*.65):0;
    drop.position.y=drop.userData.baseY-(show?(t%2600)/2600*.055:0);
   }
   renderer.render(scene,camera);
  };
  raf=requestAnimationFrame(frame);
 }catch(err){console.warn("Voice avatar model not available",err);stop();stage.classList.add("avatar-unavailable");}
 finally{loading=false;}
}
// The live 3D avatar activates only when this module is imported on demand.
 const observer=new MutationObserver(()=>{if(panel.hidden){if(active)stop();}else if(!active&&!loading)begin();});
observer.observe(panel,{attributes:true,attributeFilter:["hidden"]});
if(!panel.hidden)begin();
window.addEventListener("pagehide",()=>{stop();observer.disconnect();window.removeEventListener("ba:voice-avatar-text",onAvatarText);},{once:true});
}
