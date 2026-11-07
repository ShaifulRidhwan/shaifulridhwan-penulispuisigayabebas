/* AKSARA: 2D anime portrait experiment. Presentation only.
   ?voice-avatar=2d. Does not control Aoede, Gemini, microphone or playback. */
(function(){
"use strict";
const params=new URLSearchParams(location.search);
if(params.get("voice-avatar")!=="2d")return;
const panel=document.getElementById("voicePanel"),stage=document.getElementById("voiceAvatarStage");
if(!panel||!stage)return;
stage.classList.add("avatar-2d-active");
const reduced=!!matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
const demo=params.get("voice-preview")==="1"&&params.get("voice-avatar-demo")==="1";
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
let svg=null,loading=null,failed=false,active=false,raf=0,lastDraw=0,blinkAt=0,blinkBegin=-1;
let analyser=null,samples=null,mouthLevel=0,expression="neutral",expressionUntil=0;
const element=id=>svg?.querySelector("#"+id);
function inferExpression(input){
 const s=String(input||"").toLocaleLowerCase("ms-MY").slice(-300);
 if(/\b(?:hahaha+|hehehe+|mwehehe|ketawa)\b/.test(s))return "laugh";
 if(/\b(?:tahniah|syabas|seronok|gembira)\b/.test(s))return "smile";
 if(/\b(?:terkejut|tak sangka)\b/.test(s))return "surprised";
 if(/\b(?:aku fikir|cuba fikir|menarik untuk difikirkan)\b/.test(s))return "thinking";
 if(/\b(?:sebaliknya|namun|tidak tepat|tak semestinya)\b/.test(s))return "serious";
 return "neutral";
}
function onAssistantText(event){
 const next=inferExpression(event.detail?.text);
 if(next==="neutral")return;
 expression=next;expressionUntil=performance.now()+3400;wake();
}
window.addEventListener("ba:voice-avatar-text",onAssistantText);
function audioLevel(){
 const source=window.AksaraVoiceAudio?.analyser;
 if(!source||typeof source.getFloatTimeDomainData!=="function")return null;
 if(source!==analyser){analyser=source;samples=new Float32Array(source.fftSize||512);}
 try{
  source.getFloatTimeDomainData(samples);
  let square=0;for(const sample of samples)square+=sample*sample;
  return clamp(Math.sqrt(square/samples.length)*8,0,1);
 }catch(_){analyser=null;samples=null;return null;}
}
async function ensureArt(){
 if(svg||failed)return;
 if(loading)return loading;
 loading=(async()=>{
  const response=await fetch("./bilik-antara-avatar-2d.svg?v=1",{credentials:"same-origin"});
  if(!response.ok)throw Error("Avatar 2D HTTP "+response.status);
  const doc=new DOMParser().parseFromString(await response.text(),"image/svg+xml");
  if(doc.querySelector("parsererror"))throw Error("Invalid SVG");
  const imported=document.importNode(doc.documentElement,true);
  if(imported.localName!=="svg")throw Error("Unexpected avatar artwork");
  stage.prepend(imported);svg=imported;
  stage.classList.add("avatar-ready");stage.classList.remove("avatar-loading","avatar-unavailable");
 })().catch(e=>{
  failed=true;stage.classList.remove("avatar-loading");stage.classList.add("avatar-unavailable");
  console.warn("Avatar 2D unavailable",e);
 }).finally(()=>{loading=null;});
 return loading;
}
function draw(time){
 raf=0;
 if(!active||!svg||panel.hidden||panel.classList.contains("is-minimized")||document.hidden)return;
 if(!reduced&&time-lastDraw<33){raf=requestAnimationFrame(draw);return;}
 lastDraw=time;
 const phase=panel.dataset.voicePhase||"idle";
 const demoStage=demo?Math.floor(time/3200)%5:-1;
 const speaking=panel.classList.contains("voice-speaking")||phase==="speaking"||demoStage===1||demoStage===2;
 const listening=phase==="listening"||demoStage===0;
 const thinking=phase==="thinking"||demoStage===3;
 if(time>expressionUntil)expression="neutral";
 const mood=expression!=="neutral"?expression:demoStage===4?"smile":thinking?"thinking":"neutral";
 stage.dataset.expression=mood;
 stage.dataset.avatarPhase=speaking?"speaking":thinking?"thinking":listening?"listening":phase;
 let amplitude=speaking?audioLevel():0;
 if(speaking&&amplitude===null){
  // No analyser: a graceful approximation, not claimed to be phoneme-synced.
  amplitude=.35+.25*Math.abs(Math.sin(time*.012))+.14*Math.abs(Math.sin(time*.026));
 }
 mouthLevel+=(clamp(amplitude||0,0,1)-mouthLevel)*.29;
 if(!blinkAt)blinkAt=time+1900;
 if(!reduced&&time>=blinkAt&&blinkBegin<0)blinkBegin=time;
 const blink=blinkBegin>=0?Math.sin(clamp((time-blinkBegin)/150,0,1)*Math.PI):0;
 if(blinkBegin>=0&&time-blinkBegin>150){blinkBegin=-1;blinkAt=time+2400+Math.random()*2500;}
 for(const id of ["a2d-eye-left","a2d-eye-right"]){
  const eye=element(id);if(eye)eye.style.transform="scaleY("+(reduced?1:1-blink*.94).toFixed(3)+")";
 }
 const brow=mood==="surprised"?-6:mood==="thinking"?-3:mood==="serious"?3:0;
 ["a2d-brow-left","a2d-brow-right"].forEach((id,i)=>{
  const el=element(id);
  if(el)el.style.transform="translateY("+brow+"px) rotate("+(mood==="thinking"?(i?-4:4):0)+"deg)";
 });
 const sway=reduced?0:Math.sin(time*.00052)*1.6;
 const breath=reduced?0:Math.sin(time*.00108)*2.3;
 const tilt=mood==="thinking"?-2:mood==="laugh"?1.4:listening?-1.2:0;
 const head=element("a2d-head"),front=element("a2d-front-hair"),back=element("a2d-back-hair");
 if(head)head.setAttribute("transform","translate("+sway.toFixed(2)+" "+breath.toFixed(2)+") rotate("+(tilt+sway*.3).toFixed(2)+" 250 310)");
 if(front)front.setAttribute("transform","translate("+(sway*.7).toFixed(2)+" "+(breath*.5).toFixed(2)+") rotate("+(-sway*.4).toFixed(2)+" 252 90)");
 if(back)back.setAttribute("transform","translate("+(sway*.45).toFixed(2)+" "+(breath*.35).toFixed(2)+")");
 const mouth=element("a2d-mouth"),smile=element("a2d-smile");
 if(mouth){
  mouth.setAttribute("ry",(speaking?2+mouthLevel*17:mood==="surprised"?7:mood==="laugh"?4:1.8).toFixed(2));
  mouth.setAttribute("rx",(speaking?13+mouthLevel*6:16).toFixed(2));
 }
 if(smile)smile.setAttribute("opacity",!speaking&&(mood==="smile"||mood==="laugh")?"1":"0");
 if(!reduced)raf=requestAnimationFrame(draw);
}
function wake(){if(active&&svg&&!raf&&!document.hidden)raf=requestAnimationFrame(draw);}
function pause(){
 active=false;if(raf)cancelAnimationFrame(raf);raf=0;lastDraw=0;
 mouthLevel=0;analyser=null;samples=null;
}
async function sync(){
 if(panel.hidden||panel.classList.contains("is-minimized")||document.hidden){pause();return;}
 active=true;
 if(!svg&&!failed){stage.classList.add("avatar-loading");await ensureArt();}
 if(active&&svg)wake();
}
const observer=new MutationObserver(()=>{void sync();});
observer.observe(panel,{attributes:true,attributeFilter:["hidden","class","data-voice-phase"]});
document.addEventListener("visibilitychange",sync);
window.AksaraAvatar2D=Object.freeze({
 snapshot:()=>({loaded:!!svg,active,expression:stage.dataset.expression||"neutral",phase:stage.dataset.avatarPhase||"idle",demo,reducedMotion:reduced})
});
window.addEventListener("pagehide",()=>{
 pause();observer.disconnect();window.removeEventListener("ba:voice-avatar-text",onAssistantText);
 document.removeEventListener("visibilitychange",sync);
},{once:true});
if(!panel.hidden)void sync();
})();