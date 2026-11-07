/* AKSARA Voice | 2D cinematic anime experiment v0.2.
 * Opt-in: ?voice-avatar=2d. This module controls only avatar presentation.
 * No Gemini, microphone, token, TTS, speaker or playback manipulation. */
(function(){
"use strict";
const params=new URLSearchParams(location.search);
if(params.get("voice-avatar")!=="2d")return;
const panel=document.getElementById("voicePanel");
const stage=document.getElementById("voiceAvatarStage");
if(!panel||!stage)return;
const demo=params.get("voice-preview")==="1"&&params.get("voice-avatar-demo")==="1";
const reduced=!!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
const clamp=(number,min,max)=>Math.max(min,Math.min(max,number));
const canvas=document.createElement("canvas");
canvas.className="aksara-anime-canvas";
canvas.width=720;canvas.height=960;
canvas.setAttribute("aria-hidden","true");
const context=canvas.getContext("2d",{alpha:true});
if(!context)return;
const portrait=new Image();portrait.decoding="async";
portrait.src="./bilik-antara-avatar-2d-art.webp?v=2";
let loaded=false,failed=false,active=false,frameId=0,lastDraw=0,nextBlink=0,blinkStart=-1;
let audioAnalyser=null,audioArray=null,smoothAmplitude=0;
let expression="neutral",expressionUntil=0;
stage.classList.add("avatar-2d-active","avatar-loading");
stage.prepend(canvas);
function emotionForText(raw){
 const text=String(raw||"").toLocaleLowerCase("ms-MY").slice(-360);
 if(/\b(?:hahaha+|hehehe+|mwehehe|ketawa)\b/.test(text))return "laugh";
 if(/\b(?:tahniah|syabas|seronok|gembira)\b/.test(text))return "smile";
 if(/\b(?:terkejut|tak sangka)\b/.test(text))return "surprised";
 if(/\b(?:aku fikir|cuba fikir|menarik untuk difikirkan)\b/.test(text))return "thinking";
 if(/\b(?:sebaliknya|namun|tidak tepat|tak semestinya)\b/.test(text))return "serious";
 return "neutral";
}
function onResponse(event){
 const found=emotionForText(event?.detail?.text);
 if(found!=="neutral"){expression=found;expressionUntil=performance.now()+3600;resume();}
}
window.addEventListener("ba:voice-avatar-text",onResponse);
function audioLevel(){
 const analyser=window.AksaraVoiceAudio?.analyser;
 if(!analyser||typeof analyser.getFloatTimeDomainData!=="function")return null;
 if(analyser!==audioAnalyser){audioAnalyser=analyser;audioArray=new Float32Array(analyser.fftSize||512);}
 try{
  analyser.getFloatTimeDomainData(audioArray);
  let sum=0;for(const value of audioArray)sum+=value*value;
  return clamp(Math.sqrt(sum/audioArray.length)*8,0,1);
 }catch(_){audioAnalyser=null;audioArray=null;return null;}
}
function blinkEye(x,y,amount,side){
 if(amount<.01)return;
 context.save();context.globalAlpha=clamp(amount,0,1);
 const skin=context.createLinearGradient(x-30,y-17,x+33,y+20);
 skin.addColorStop(0,side==="left"?"#c39a88":"#a88a84");
 skin.addColorStop(.5,"#bc9085");skin.addColorStop(1,"#8b6d75");
 context.fillStyle=skin;
 context.beginPath();context.ellipse(x,y,43,15,0,0,Math.PI*2);context.fill();
 context.strokeStyle="#45323e";context.lineWidth=2.1;
 context.beginPath();context.moveTo(x-36,y-1);
 context.quadraticCurveTo(x,y+4,x+36,y-2);context.stroke();
 context.restore();
}
function animateMouth(phase,time,power){
 const animated=phase==="speaking"?power:phase==="surprised"?.28:0;
 if(animated<.06)return;
 const amount=clamp(animated,0,1);
 context.save();context.globalAlpha=Math.min(.86,amount*1.3);
 context.fillStyle="#48222c";context.strokeStyle="#ac666c";
 context.lineWidth=1.6;
 context.beginPath();context.ellipse(360,389,22+amount*4,1+amount*8,0,0,Math.PI*2);
 context.fill();context.stroke();context.restore();
}
function render(time){
 frameId=0;
 if(!active||!loaded||document.hidden||panel.hidden||panel.classList.contains("is-minimized"))return;
 if(!reduced&&time-lastDraw<33){frameId=requestAnimationFrame(render);return;}
 lastDraw=time;
 const callPhase=panel.dataset.voicePhase||"idle";
 const demoStep=demo?Math.floor(time/3200)%5:-1;
 const talking=panel.classList.contains("voice-speaking")||callPhase==="speaking"||demoStep===1||demoStep===2;
 const listening=callPhase==="listening"||demoStep===0;
 const thinking=callPhase==="thinking"||demoStep===3;
 if(time>expressionUntil)expression="neutral";
 const mood=expression!=="neutral"?expression:demoStep===4?"smile":thinking?"thinking":"neutral";
 const phase=talking?"speaking":thinking?"thinking":listening?"listening":callPhase;
 stage.dataset.avatarPhase=phase;stage.dataset.expression=mood;
 stage.dataset.avatarMode=window.BilikAntaraThought?.getMode?.()||"cahaya";
 let power=talking?audioLevel():0;
 if(talking&&power===null){
  // Only approximate lip motion if an audio analyser is unavailable.
  power=.30+.28*Math.abs(Math.sin(time*.014))+.12*Math.abs(Math.sin(time*.027));
 }
 smoothAmplitude+=(clamp(power||0,0,1)-smoothAmplitude)*.29;
 if(!nextBlink)nextBlink=time+2100;
 if(!reduced&&time>=nextBlink&&blinkStart<0)blinkStart=time;
 const blink=blinkStart>=0?Math.sin(clamp((time-blinkStart)/158,0,1)*Math.PI):0;
 if(blinkStart>=0&&time-blinkStart>=158){blinkStart=-1;nextBlink=time+2450+Math.random()*2400;}
 context.clearRect(0,0,canvas.width,canvas.height);
 context.drawImage(portrait,0,0,720,960);
 // Lightweight pseudo-rig v0.2, not Live2D mesh deformation.
 blinkEye(289,267,blink+(mood==="thinking"?.12:0),"left");
 blinkEye(416,267,blink+(mood==="thinking"?.12:0),"right");
 animateMouth(talking?"speaking":mood,time,smoothAmplitude);
 if((mood==="smile"||mood==="laugh")&&!talking){
  context.save();context.globalAlpha=.46;context.strokeStyle="#965963";
  context.lineWidth=2;context.beginPath();context.moveTo(338,390);
  context.quadraticCurveTo(360,404,382,390);context.stroke();context.restore();
 }
 if(reduced)return;
 const drift=Math.sin(time*.0005)*1.5;
 const breath=Math.sin(time*.00095)*2.2;
 canvas.style.transform="translate("+drift.toFixed(2)+"px,"+breath.toFixed(2)+"px) rotate("+(drift*.18).toFixed(2)+"deg)";
 frameId=requestAnimationFrame(render);
}
function pause(){
 active=false;cancelAnimationFrame(frameId);frameId=0;lastDraw=0;smoothAmplitude=0;
 audioAnalyser=null;audioArray=null;
}
function resume(){
 if(!loaded||failed||document.hidden||panel.hidden||panel.classList.contains("is-minimized")){pause();return;}
 active=true;if(!frameId)frameId=requestAnimationFrame(render);
}
portrait.onload=()=>{
 loaded=true;stage.classList.remove("avatar-loading","avatar-unavailable");
 stage.classList.add("avatar-ready");resume();
};
portrait.onerror=()=>{
 failed=true;stage.classList.remove("avatar-loading");
 stage.classList.add("avatar-unavailable");canvas.remove();
 console.warn("AKSARA 2D artwork could not be loaded");
};
const observer=new MutationObserver(resume);
observer.observe(panel,{attributes:true,attributeFilter:["hidden","class","data-voice-phase"]});
document.addEventListener("visibilitychange",resume);
window.AksaraAvatar2D=Object.freeze({
 snapshot:()=>({version:"0.2",loaded,active,failed,expression:stage.dataset.expression||"neutral",phase:stage.dataset.avatarPhase||"idle",demo,reducedMotion:reduced,renderer:"canvas2d"})
});
window.addEventListener("pagehide",()=>{
 pause();observer.disconnect();window.removeEventListener("ba:voice-avatar-text",onResponse);
 document.removeEventListener("visibilitychange",resume);
},{once:true});
})();