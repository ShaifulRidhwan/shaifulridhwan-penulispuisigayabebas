/* AKSARA Voice Skeletal 3D v0.7 | experimental rig controller.
 * Uses actual GLB humanoid bones; NEVER fakes 3D by slicing a 2D bitmap.
 * No calls to Gemini Live/audio device/voice transport. Only receives output
 * amplitude and speaking state supplied by existing Voice Chat renderer.
 */
(function(root,factory) {
 "use strict";
 const api=factory();
 if (typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root)root.AksaraSkeletal3DRig=api;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:0));
 const norm=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
 const aliases={
  head:["head","mixamorighead","j_head","biphead"],
  neck:["neck","mixamorigneck","j_neck"],
  chest:["upperchest","chest","spine2","spine1","mixamorigspine2"],
  spine:["spine","mixamorigspine","hips"],
  leftShoulder:["leftshoulder","lshoulder","mixamorigleftshoulder"],
  rightShoulder:["rightshoulder","rshoulder","mixamorigrightshoulder"],
  leftUpperArm:["leftupperarm","leftarm","mixamorigleftarm"],
  rightUpperArm:["rightupperarm","rightarm","mixamorigrightarm"]
 };
 function findBone(bones,names){
  const entries=bones.map(o=>({object:o,name:norm(o.name)}));
  for(const n of names){
   const exact=entries.find(e=>e.name===n);
   if(exact)return exact.object;
  }
  for(const n of names){
   const tail=entries.find(e=>e.name.endsWith(n));
   if(tail)return tail.object;
  }
  return null;
 }
 function create({THREE,root:avatar,seed=.4}={}){
  if(!avatar||!THREE?.Quaternion||!THREE?.Euler)throw Error("A loaded real GLB and THREE are required");
  const bones=[];
  avatar.traverse(o=>{if(o.isBone)bones.push(o);});
  const mapped={};
  for(const [key,names] of Object.entries(aliases))mapped[key]=findBone(bones,names);
  const driven=Object.fromEntries(Object.entries(mapped).filter(([,value])=>!!value));
  const count=Object.keys(driven).length;
  const ready=!!(mapped.head&&mapped.neck&&(mapped.chest||mapped.spine));
  const original=new Map();
  for(const bone of Object.values(driven))original.set(bone,bone.quaternion.clone());
  const euler=new THREE.Euler(0,0,0,"XYZ"),rotation=new THREE.Quaternion();
  let since=0,angleX=0,angleY=0,angleZ=0,armL=0,armR=0,last=0,frames=0;
  function put(name,x=0,y=0,z=0){
   const bone=driven[name];if(!bone)return;
   euler.set(x,y,z);
   rotation.setFromEuler(euler);
   bone.quaternion.copy(original.get(bone)).multiply(rotation);
  }
  const wander=(time,period,offset)=>{
   const phase=(time+offset*700)/period;
   return Math.sin(phase*2*Math.PI)*.72+Math.sin(phase*.91*2*Math.PI+.7)*.28;
  };
  function step({time=0,speaking=false,level=0,emotion="neutral",reducedMotion=false}={}){
   if(!ready)return {ready:false,count,bones:Object.keys(driven)};
   const now=Number(time)||0;
   if(!since)since=now;
   const seconds=Math.max(0,(now-since)/1000);
   const dt=last?clamp((now-last)/1000,.001,.045):.016;
   last=now;
   const talking= speaking?clamp(level,0,1):0;
   const limiter=reducedMotion?.18:1;
   // A small linked gesture library with asymmetric overlapping cycles.
   // Joint rotations are in radians and RELATIVE to rest pose. No T-pose reset.
   const speakSway=limiter*(speaking?(wander(seconds,3.8,.4)*.020+talking*.012):wander(seconds,7.4,.2)*.012);
   const headTargetX=limiter*((emotion==="thinking"?-.048:0)+Math.sin(seconds*1.1)*.018+talking*.015);
   const headTargetY=limiter*(wander(seconds,5.3,seed)*.064);
   const headTargetZ=limiter*(wander(seconds,6.5,seed+1)*.037+speakSway);
   const follow=(prev,target,tau)=>prev+(target-prev)*(1-Math.exp(-dt/tau));
   angleX=follow(angleX,headTargetX,.15);
   angleY=follow(angleY,headTargetY,.2);
   angleZ=follow(angleZ,headTargetZ,.25);
   put("head",angleX*.72,angleY*.78,angleZ*.7);
   put("neck",angleX*.25,angleY*.22,angleZ*.3);
   put("chest",limiter*Math.sin(seconds*1.08)*.011,speakSway*.31,speakSway*.38);
   put("spine",limiter*Math.sin(seconds*.9)*.006,0,-speakSway*.18);
   put("leftShoulder",limiter*Math.sin(seconds*.95)*.008,0,0);
   put("rightShoulder",limiter*Math.sin(seconds*.95+.38)*.008,0,0);
   armL=follow(armL,limiter*(speaking? .028*Math.sin(seconds*1.24)+talking*.018:0),.28);
   armR=follow(armR,limiter*(speaking?-.020*Math.sin(seconds*1.06+.6)-talking*.016:0),.32);
   put("leftUpperArm",armL,0,armL*.4);
   put("rightUpperArm",armR,0,armR*.4);
   frames++;
   return {ready:true,count,headX:angleX,headY:angleY,headZ:angleZ,armL,armR,frames};
  }
  function dispose(){
   for(const [bone,rest] of original)bone.quaternion.copy(rest);
   original.clear();
  }
  return Object.freeze({ready,step,dispose,snapshot:()=>({ready,boneCount:bones.length,
   mappedBoneCount:count,mapped:Object.keys(driven),frames,lastHeadX:angleX,lastHeadY:angleY,lastHeadZ:angleZ})});
 }
 return Object.freeze({create,findBone,aliases,clamp});
});