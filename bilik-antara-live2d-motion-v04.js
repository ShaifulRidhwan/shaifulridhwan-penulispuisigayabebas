/* AKSARA Live2D Natural Motion v0.4.
 * Pure deterministic controller: no DOM, networking, AI or audio-device access.
 * Rig physics owns hair meshes; this module feeds smooth head/body/breath inputs.
 */
(function(root,factory){
 "use strict";
 const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root)root.AksaraLive2DMotionV04=api;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const clamp=(n,min,max)=>Math.min(max,Math.max(min,Number.isFinite(n)?n:0));
 const smoothstep=x=>{const u=clamp(x,0,1);return u*u*(3-2*u);};
 const random=(n,salt=0)=>{const v=Math.sin((n+1)*127.1+salt*311.7)*43758.5453123;return v-Math.floor(v);};
 const wander=(time,period,salt)=>{
  const n=Math.floor(Math.max(0,time)/period);
  const t=smoothstep((Math.max(0,time)-n*period)/period);
  return ((random(n,salt)*2-1)*(1-t)+(random(n+1,salt)*2-1)*t);
 };
 const expressionTargets=Object.freeze({
  neutral:{brow:0,mouth:0,eye:1,cheek:0,gloom:0},
  smile:{brow:.18,mouth:.5,eye:.91,cheek:.22,gloom:0},
  laugh:{brow:.29,mouth:.75,eye:.78,cheek:.35,gloom:0},
  thinking:{brow:.22,mouth:-.08,eye:.94,cheek:0,gloom:.07},
  serious:{brow:-.24,mouth:-.29,eye:.93,cheek:0,gloom:.10},
  surprised:{brow:.58,mouth:.04,eye:1,cheek:0,gloom:0}
 });
 const limits=Object.freeze({
  ParamAngleX:[-12,12],ParamAngleY:[-10,10],ParamAngleZ:[-10,10],
  ParamBodyAngleX:[-8,8],ParamBodyAngleY:[-8,8],ParamBodyAngleZ:[-8,8],
  ParamEyeLOpen:[0,1],ParamEyeROpen:[0,1],
  ParamEyeBallX:[-1,1],ParamEyeBallY:[-1,1],
  ParamBrowLY:[-1,1],ParamBrowRY:[-1,1],
  ParamMouthOpenY:[0,1],ParamMouthForm:[-1,1],
  ParamBreath:[0,1],ParamCheek:[0,1],ParamGloom:[0,1]
 });
 const fallback=(mode)=>mode==="gelap"?.10:0;
 function createController(options={}){
  const seed=clamp(Number(options.seed??0.274),0,1)*9;
  const channels=Object.create(null);
  const velocities=Object.create(null);
  let time0=null,lastTime=null,blinkTime=null,blinkIndex=0,blinkCount=0;
  let targetBlinkEnd=0,lastAudio=0,fpsEstimate=0,quality="normal";
  const current=(key,value=0)=>channels[key]??value;
  function follow(key,target,dt,tau){
   const now=current(key,target);
   const alpha=1-Math.exp(-dt/Math.max(.015,tau));
   const value=now+(target-now)*alpha;
   channels[key]=value;
   return value;
  }
  function spring(key,target,dt,frequency=1.45){
   const n=current(key,target);
   const v=velocities[key]||0;
   const f=2*Math.PI*frequency;
   const stiffness=f*f;
   const acceleration=(target-n)*stiffness-2*.96*f*v;
   const nextVelocity=clamp(v+acceleration*dt,-28,28);
   const value=n+nextVelocity*dt;
   velocities[key]=nextVelocity;
   channels[key]=value;
   return value;
  }
  function blink(now,enabled){
   if(!enabled)return {left:1,right:1,active:false};
   if(blinkTime===null)blinkTime=now+2400+random(0,seed)*2300;
   if(now>=blinkTime){
    targetBlinkEnd=now+142+random(++blinkIndex,seed)*74;
    blinkTime=targetBlinkEnd+2400+random(blinkIndex+1,seed)*3600;
    blinkCount++;
   }
   if(!targetBlinkEnd||now>=targetBlinkEnd)return {left:1,right:1,active:false};
   const duration=142+random(blinkIndex,seed)*74;
   const progress=clamp(1-(targetBlinkEnd-now)/duration,0,1);
   const closure=Math.pow(Math.sin(Math.PI*progress),.68);
   return {left:1-.94*closure,right:1-.93*closure,active:true};
  }
  function step({now=0,phase="idle",emotion="neutral",audio=0,mode="cahaya",reducedMotion=false}={}){
   const time=Math.max(0,Number(now)||0);
   if(time0===null)time0=time;
   const elapsed=time-time0;
   const delta=lastTime===null?1/60:clamp((time-lastTime)/1000,.001,.048);
   lastTime=time;
   const activeExpression=expressionTargets[emotion]||expressionTargets.neutral;
   const eye=blink(elapsed,!reducedMotion);
   const breathing=reducedMotion?0:Math.sin(elapsed*.00135)*.16;
   const headX=reducedMotion?0:(wander(elapsed,3200,seed+1)*2.4+wander(elapsed,6900,seed+2)*.75);
   const headY=reducedMotion?0:(wander(elapsed,4600,seed+3)*1.4+breathing*.9);
   const headZ=reducedMotion?0:wander(elapsed,3700,seed+4)*1.55;
   const phaseZ=phase==="listening"?-1.8:phase==="thinking"?-2.6:0;
   const phaseX=phase==="speaking"?.55:0;
   const bodyX=reducedMotion?0:wander(elapsed,5600,seed+5)*1.45;
   const gazeX=reducedMotion?0:wander(elapsed,2200,seed+7)*.24;
   const gazeY=reducedMotion?0:wander(elapsed,3800,seed+8)*.14+(phase==="thinking"?.12:0);
   const talk=phase==="speaking"?clamp(Number(audio)||0,0,1):0;
   const lipTarget=talk>.038?clamp((talk-.038)*1.26,0,.90):0;
   // 45ms mouth attack, 115ms release; don't claim phoneme alignment.
   const lip=follow("lip",lipTarget,delta,lipTarget>current("lip",0)?.048:.115);
   lastAudio=lip;
   const brow=follow("brow",activeExpression.brow-(mode==="gelap"?.10:0),delta,.24);
   const eyeExpression=follow("eyeExpression",activeExpression.eye,delta,.20);
   const mouthForm=follow("mouthForm",activeExpression.mouth,delta,.24);
   const cheek=follow("cheek",activeExpression.cheek,delta,.30);
   const gloom=follow("gloom",activeExpression.gloom,delta,.32);
   const values={
    ParamAngleX:spring("headX",headX+phaseX,delta,1.07),
    ParamAngleY:spring("headY",headY,delta,1.1),
    ParamAngleZ:spring("headZ",headZ+phaseZ,delta,1.08),
    ParamBodyAngleX:spring("bodyX",bodyX,delta,.81),
    ParamBodyAngleY:spring("bodyY",reducedMotion?0:breathing*1.8,delta,.75),
    ParamBodyAngleZ:spring("bodyZ",reducedMotion?0:headZ*.38+phaseZ*.26,delta,.85),
    ParamEyeLOpen:clamp(eye.left*eyeExpression,0,1),
    ParamEyeROpen:clamp(eye.right*eyeExpression,0,1),
    ParamEyeBallX:follow("gazeX",gazeX,delta,.18),
    ParamEyeBallY:follow("gazeY",gazeY,delta,.21),
    ParamBrowLY:brow,ParamBrowRY:brow,
    ParamMouthOpenY:lip,ParamMouthForm:mouthForm,
    ParamBreath:clamp(.5+breathing,0,1),
    ParamCheek:cheek,ParamGloom:gloom
   };
   for(const id of Object.keys(values)){
    const [lo,hi]=limits[id];
    values[id]=clamp(values[id],lo,hi);
   }
   return values;
  }
  return Object.freeze({
   step,
   snapshot:()=>({blinkCount,blinkActive:!!targetBlinkEnd&&lastTime!==null&&(lastTime-time0)<targetBlinkEnd,
     lastAudio,mouth:current("lip",0),headAngle:current("headZ",0),
     emotion:current("mouthForm",0),fps:fpsEstimate,quality}),
   setQuality(value){quality=String(value||"normal");},
   setFPS(value){fpsEstimate=clamp(Number(value),0,120);},
   reset(){
    for(const k of Object.keys(channels))delete channels[k];
    for(const k of Object.keys(velocities))delete velocities[k];
    time0=null;lastTime=null;blinkTime=null;blinkIndex=0;blinkCount=0;targetBlinkEnd=0;lastAudio=0;
   }
  });
 }
 return Object.freeze({createController,limits,expressionTargets,wander,clamp});
});