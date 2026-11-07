/* AKSARA Live2D v0.3: pure parameter mapping.
 * No browser side effects, microphone access, storage, network or AI calls.
 * This module can be tested with Node and can drive a real Cubism model. */
(function(root,factory){
 "use strict";
 const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root)root.AksaraLive2DBridge=api;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(n))?Number(n):0));
 const ids=Object.freeze([
  "ParamAngleX","ParamAngleY","ParamAngleZ","ParamEyeLOpen","ParamEyeROpen",
  "ParamEyeBallX","ParamEyeBallY","ParamBrowLY","ParamBrowRY",
  "ParamMouthOpenY","ParamMouthForm","ParamBodyAngleX","ParamBreath"
 ]);
 function inferExpression(value){
  const text=String(value||"").toLocaleLowerCase("ms-MY").slice(-360);
  if(/\b(?:hahaha+|hehehe+|mwehehe|ketawa)\b/.test(text))return "laugh";
  if(/\b(?:tahniah|syabas|seronok|gembira)\b/.test(text))return "smile";
  if(/\b(?:terkejut|tak sangka)\b/.test(text))return "surprised";
  if(/\b(?:aku fikir|cuba fikir|menarik untuk difikirkan)\b/.test(text))return "thinking";
  if(/\b(?:sebaliknya|namun|tidak tepat|tak semestinya)\b/.test(text))return "serious";
  return "neutral";
 }
 function sampleAudio(analyser,cache){
  if(!analyser||typeof analyser.getFloatTimeDomainData!=="function")return 0;
  const length=Math.max(32,Math.min(4096,Number(analyser.fftSize)||512));
  const arr=cache?.length===length?cache:new Float32Array(length);
  try{
   analyser.getFloatTimeDomainData(arr);
   let sum=0;for(const v of arr)sum+=v*v;
   return {rms:clamp(Math.sqrt(sum/length)*8,0,1),cache:arr};
  }catch(_){return {rms:0,cache:null};}
 }
 function state({time=0,phase="idle",emotion="neutral",audio=0,reducedMotion=false,mode="cahaya"}={}){
  const t=Number(time)||0;
  const voice=phase==="speaking"?clamp(audio,0,1):0;
  const idle=reducedMotion?0:Math.sin(t*.00064);
  const breathing=reducedMotion?0:Math.sin(t*.0014);
  let blink=0;
  if(!reducedMotion){
   const cycle=((t%4150)+4150)%4150;
   if(cycle>3500&&cycle<3650)blink=Math.sin((cycle-3500)/150*Math.PI);
  }
  const brow=emotion==="surprised"?.6:emotion==="thinking"?.27:emotion==="serious"?-.35:0;
  const mouthForm=emotion==="smile"?.55:emotion==="laugh"?.75:emotion==="serious"?-.32:0;
  const tilt=phase==="listening"?-3:phase==="thinking"?-5:0;
  const values={
   ParamAngleX:idle*2.5,ParamAngleY:breathing*1.7,ParamAngleZ:tilt+idle*1.5,
   ParamEyeLOpen:clamp(1-blink,0,1),ParamEyeROpen:clamp(1-blink,0,1),
   ParamEyeBallX:idle*.11,ParamEyeBallY:phase==="thinking"?.15:0,
   ParamBrowLY:brow,ParamBrowRY:brow,
   ParamMouthOpenY:voice,ParamMouthForm:mouthForm,
   ParamBodyAngleX:idle*1.2,ParamBreath:clamp(.5+breathing*.26,0,1)
  };
  if(mode==="gelap")values.ParamBrowLY=values.ParamBrowRY=clamp(brow-.13,-1,1);
  return values;
 }
 function validateManifest(json){
  if(!json||typeof json!=="object"||!json.FileReferences||typeof json.FileReferences.Moc!=="string")return false;
  if(!json.FileReferences.Moc.endsWith(".moc3"))return false;
  return Array.isArray(json.FileReferences.Textures)&&json.FileReferences.Textures.length>0;
 }
 return Object.freeze({ids,inferExpression,sampleAudio,state,validateManifest,clamp});
});