"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const source=fs.readFileSync(path.join(root,"bilik-antara-avatar-skeletal-v07.js"),"utf8");
const rig=require("../bilik-antara-avatar-skeletal-v07.js");
class Quaternion{
 constructor(){this.e=[0,0,0];}
 clone(){const q=new Quaternion();q.e=this.e.slice();return q;}
 copy(q){this.e=q.e.slice();return this;}
 multiply(q){this.e=this.e.map((x,i)=>x+q.e[i]);return this;}
 setFromEuler(e){this.e=[e.x,e.y,e.z];return this;}
}
class Euler{
 set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
}
function fake(...names){
 const bones=names.map(name=>({name,isBone:true,quaternion:new Quaternion()}));
 return {bones,root:{traverse:fn=>bones.forEach(fn)}};
}
test("Opt-in adapter requires real skeleton, never invents 2.5D slices",()=>{
 assert.doesNotThrow(()=>new Function(source));
 const none=fake("Body","Root");
 const empty=rig.create({THREE:{Quaternion,Euler},root:none.root});
 assert.equal(empty.ready,false);
 assert.equal(empty.step({time:100}).ready,false);
 assert.doesNotMatch(source,/drawImage|canvas|getUserMedia|new WebSocket|Gemini|live-token|image\/svg/);
});
test("Humanoid bones move as one linked real skeletal pose, smooth and bounded",()=>{
 const {root:avatar,bones}=fake("Hips","Spine","Chest","Neck","Head","LeftShoulder","RightShoulder","LeftUpperArm","RightUpperArm");
 const controller=rig.create({THREE:{Quaternion,Euler},root:avatar});
 assert.equal(controller.ready,true);
 let max=0,prev=null,frames=0;
 for(let i=0;i<720;i++){
  const value=controller.step({time:i*16.666,speaking:i>120&&i<520,level:.64,emotion:i>250?"smile":"neutral"});
  assert.equal(value.ready,true);
  assert.ok(Number.isFinite(value.headX)&&Number.isFinite(value.headY));
  assert.ok(Math.abs(value.headY)<.12);
  assert.ok(Math.abs(value.armL)<.10);
  if(prev!==null)max=Math.max(max,Math.abs(value.headZ-prev));
  prev=value.headZ;frames++;
 }
 assert.ok(max<.02,"head must not jerk between animation frames: "+max);
 assert.equal(controller.snapshot().frames,frames);
 assert.ok(controller.snapshot().mappedBoneCount>=6);
 assert.ok(bones.some(x=>x.quaternion.e.some(y=>Math.abs(y)>1e-7)),"at least one real bone moved");
 controller.dispose();
 assert.ok(bones.every(x=>x.quaternion.e.every(y=>Math.abs(y)<1e-7)),"all bones return to original rest orientation");
});
test("Existing Voice Chat is unchanged by default and 3D mode is strictly query gated",()=>{
 const avatar=fs.readFileSync(path.join(root,"bilik-antara-avatar.js"),"utf8");
 assert.match(avatar,/get\("voice-rig"\)==="skeletal3d"/);
 assert.match(avatar,/skeletalController\?\.step/);
 assert.match(avatar,/if\(skeletal3D\)/);
 assert.match(avatar,/if\(skeletal3D\)window\.AksaraVoiceSkeletal3D/);
 assert.match(avatar,/avatarOptions\.get\("voice-preview"\)==="1"/);
 assert.match(avatar,/AksaraVoiceAudio\?\.analyser/);
 assert.match(avatar,/const modelURL="https:\/\/cdn\.jsdelivr\.net\/gh\/met4citizen\/TalkingHead/);
 assert.doesNotMatch(avatar,/voice-rig=live2d/);
});
