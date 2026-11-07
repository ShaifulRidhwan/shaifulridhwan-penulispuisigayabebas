/* AKSARA Live2D integration spike v0.3, opt-in ?voice-avatar=live2d.
 * A genuine .moc3/.model3.json model is required; never fake a rig by drawing
 * lines over a flattened picture. Original Voice Chat is never modified.
 * Vendor runtime files are deliberately not bundled: Live2D Core is proprietary,
 * and publishing an AI/chatbot SDK integration requires a licensing review. */
(async function(){
 "use strict";
 const query=new URLSearchParams(location.search);
 if(query.get("voice-avatar")!=="live2d")return;
 const panel=document.getElementById("voicePanel");
 const stage=document.getElementById("voiceAvatarStage");
 if(!panel||!stage)return;
 await Promise.all([import("./bilik-antara-live2d-bridge-v03.js?v=1"),import("./bilik-antara-live2d-motion-v04.js?v=1")]);
 const bridge=window.AksaraLive2DBridge;
 const motion=window.AksaraLive2DMotionV04?.createController({seed:.421});
 if(!bridge||!motion)return;
 const modelUrl="./assets/live2d/aksara/aksara.model3.json";
 const vendorFiles=[
  "https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js",
  "./assets/live2d/vendor/pixi.min.js",
  "./assets/live2d/vendor/cubism4.min.js"
 ];
 const reduced=!!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
 const demo=query.get("voice-preview")==="1"&&query.get("voice-avatar-demo")==="1";
 let ready=false,failed=false,loading=null,app=null,model=null,resize=null;
 let audioCache=null,audioAnalyser=null,emotion="neutral",emotionUntil=0,started=0,lastFrame=0;
 let frameWindowStart=0,windowFrames=0,measuredFPS=0,lowWindows=0,highWindows=0;
 const phone=window.matchMedia("(max-width: 760px)").matches;
 const saveData=!!navigator.connection?.saveData;
 const weakDevice=(navigator.deviceMemory&&navigator.deviceMemory<=3)||(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4);
 const reducedQuality=reduced||phone||saveData||weakDevice;
 let fpsLimit=reducedQuality?30:60,renderResolution=1,quality="normal";
 panel.classList.add("voice-live2d-v04");
 if(query.get("voice-preview")==="1")panel.classList.add("voice-live2d-preview");
 let modelNaturalWidth=1,modelNaturalHeight=1;
 const status=document.createElement("div");
 status.className="aksara-live2d-status";
 status.setAttribute("role","status");
 status.setAttribute("aria-live","polite");
 function report(code,message){
  stage.dataset.live2dStatus=code;
  status.textContent=message;
  status.hidden=false;
  stage.classList.remove("avatar-ready","avatar-loading");
  stage.classList.add("avatar-unavailable");
 }
 stage.classList.add("avatar-live2d-active");
 stage.prepend(status);
 report("checking","Semak model Live2D berlapis…");
 function script(url){
  return new Promise((resolve,reject)=>{
   const element=document.createElement("script");
   element.src=url;element.async=false;
   element.onload=resolve;
   element.onerror=()=>reject(new Error("Runtime tidak tersedia: "+url));
   document.head.appendChild(element);
  });
 }
 function onText(event){
  const next=bridge.inferExpression(event.detail?.text);
  if(next!=="neutral"){emotion=next;emotionUntil=performance.now()+4200;}
 }
 window.addEventListener("ba:voice-avatar-text",onText);
 function setParameter(id,value){
  const core=model?.internalModel?.coreModel;
  if(typeof core?.setParameterValueById==="function")core.setParameterValueById(id,value);
 }
 function position(){
  if(!app||!model)return;
  const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);
  app.renderer.resize(w,h);
  const naturalW=modelNaturalWidth,naturalH=modelNaturalHeight;
  const ratio=Math.min(w/naturalW,h/naturalH)*1.07;
  model.scale.set(ratio);
  model.anchor?.set?.(.5,.52);
  model.position.set(w*.5,h*.49);
 }
 function tunePerformance(now){
  if(!frameWindowStart){frameWindowStart=now;return;}
  if(now-frameWindowStart<3400)return;
  const actualFPS=windowFrames/Math.max(.1,(now-frameWindowStart)/1000);
  measuredFPS=measuredFPS?measuredFPS*.4+actualFPS*.6:actualFPS;
  motion.setFPS(measuredFPS);frameWindowStart=now;windowFrames=0;
  if(actualFPS<fpsLimit*.75){lowWindows++;highWindows=0;}
  else if(actualFPS>fpsLimit*.91){highWindows++;lowWindows=0;}
  else{highWindows=0;lowWindows=0;}
  if(lowWindows>=2){
   lowWindows=0;
   if(renderResolution>1.02){
    renderResolution=1;quality="reduced";
    app.renderer.resolution=renderResolution;position();
   }else if(fpsLimit>24){
    fpsLimit=Math.max(24,fpsLimit-15);quality="reduced";app.ticker.maxFPS=fpsLimit;
   }
  }else if(highWindows>=4&&!reduced&&!saveData){
   highWindows=0;
   const goal=reducedQuality?30:60;
   if(fpsLimit<goal){fpsLimit=Math.min(goal,fpsLimit+15);app.ticker.maxFPS=fpsLimit;}
   else if(renderResolution<(reducedQuality?1.25:1.5)){
    renderResolution=reducedQuality?1.25:1.5;
    app.renderer.resolution=renderResolution;position();quality="normal";
   }
  }
  motion.setQuality(quality);
 }
 function tick(){
  if(!ready||!model)return;
  if(panel.hidden||document.hidden||panel.classList.contains("is-minimized")){
   if(app?.ticker?.started)app.ticker.stop();
   return;
  }
  if(!app?.ticker?.started)app?.ticker?.start();
  const now=performance.now(),phase=panel.dataset.voicePhase||"idle";
  const simulation=demo?Math.floor(now/3300)%4:-1;
  const speaking=panel.classList.contains("voice-speaking")||phase==="speaking"||simulation===1;
  if(now>emotionUntil)emotion="neutral";
  const mood=emotion!=="neutral"?emotion:simulation===2?"smile":simulation===3?"thinking":"neutral";
  const analyser=window.AksaraVoiceAudio?.analyser;
  const signal=speaking&&analyser?bridge.sampleAudio(analyser,analyser===audioAnalyser?audioCache:null):{rms:0,cache:null};
  audioAnalyser=analyser;audioCache=signal.cache;
  const gain=speaking?(analyser?signal.rms:demo?.35+.24*Math.abs(Math.sin(now*.015)):0):0;
  const values=motion.step({
   now,phase:speaking?"speaking":phase,emotion:mood,
   audio:gain,reducedMotion:reduced||saveData,mode:window.BilikAntaraThought?.getMode?.()||"cahaya"
  });
  for(const [id,value] of Object.entries(values))setParameter(id,value);
  stage.dataset.avatarPhase=speaking?"speaking":phase;
  stage.dataset.expression=mood;
  lastFrame=now;windowFrames++;
  tunePerformance(now);
 }
 async function setup(){
  if(ready||failed||loading)return loading;
  loading=(async()=>{
   if(!window.WebGLRenderingContext){report("no-webgl","Peranti ini tidak menyokong WebGL untuk model Live2D.");failed=true;return;}
   let response;
   try{response=await fetch(modelUrl,{cache:"no-store",credentials:"same-origin"});}
   catch(_){report("model-missing","Model Live2D sebenar belum tersedia. Perlu eksport rig .moc3 daripada Cubism Editor.");return;}
   if(!response.ok){
    report("model-missing","Rig Live2D belum dipasang: fail .model3.json dan .moc3 diperlukan.");return;
   }
   let meta;
   try{meta=await response.json();}
   catch(_){report("model-invalid","Fail model3.json tidak sah.");return;}
   if(!bridge.validateManifest(meta)){report("model-invalid","Rig tidak lengkap: perlu .moc3 dan tekstur Live2D.");return;}
   try{
    stage.classList.add("avatar-loading");
    for(const url of vendorFiles)await script(url);
    const PIXI=window.PIXI;
    const Live2DModel=PIXI?.live2d?.Live2DModel;
    if(typeof Live2DModel?.from!=="function")throw Error("PixiJS Live2D Cubism4 adapter gagal dimuat.");
    const options={width:Math.max(1,stage.clientWidth),height:Math.max(1,stage.clientHeight),
      transparent:true,antialias:true,autoStart:false,resolution:Math.min(window.devicePixelRatio||1,1.5)};
    app=new PIXI.Application(options);
    model=await Live2DModel.from(modelUrl);
    app.stage.addChild(model);
    modelNaturalWidth=Math.max(1,Number(model.width)||1);
    modelNaturalHeight=Math.max(1,Number(model.height)||1);
    model.anchor?.set?.(.5,.5);
    position();
    app.view.className="aksara-live2d-webgl";
    stage.prepend(app.view);
    app.ticker.add(tick);
    ready=true;started=performance.now();
    stage.classList.add("avatar-ready");
    stage.classList.remove("avatar-unavailable","avatar-loading");
    stage.dataset.live2dStatus="ready";
    status.hidden=true;
    resize=new ResizeObserver(position);resize.observe(stage);
    resume();
   }catch(error){
    console.warn("AKSARA Live2D runtime unavailable",error);
    failed=true;report("vendor-missing","Enjin Cubism belum dapat dimuatkan. Semak sambungan Core rasmi dan WebGL peranti.");
   }
  })().finally(()=>{loading=null;});
  return loading;
 }
 function resume(){
  if(panel.hidden||document.hidden||panel.classList.contains("is-minimized")){app?.ticker?.stop();return;}
  if(ready){app?.ticker?.start();return;}
  if(!failed)void setup();
 }
 const observer=new MutationObserver(resume);
 observer.observe(panel,{attributes:true,attributeFilter:["hidden","class","data-voice-phase"]});
 document.addEventListener("visibilitychange",resume);
 window.AksaraLive2DExperiment=Object.freeze({
  snapshot:()=>({version:"0.3",runtime:"cubism-model",ready,failed,
   status:stage.dataset.live2dStatus||"checking",
   modelLoaded:!!model,renderer:app?"webgl":null,
   lastFrame,voiceConnectionUnchanged:true}),
  retry:()=>{if(!ready){failed=false;void setup();}}
 });
 window.addEventListener("pagehide",()=>{
  observer.disconnect();document.removeEventListener("visibilitychange",resume);
  window.removeEventListener("ba:voice-avatar-text",onText);
  app?.ticker?.stop();resize?.disconnect();
  try{model?.destroy?.();app?.destroy?.(true,{children:true,texture:true,baseTexture:true});}catch(_){}
 },{once:true});
 if(!panel.hidden)resume();
})();