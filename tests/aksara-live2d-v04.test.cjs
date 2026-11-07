"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const motion=require("../bilik-antara-live2d-motion-v04.js");

test("v0.4 spring and facial parameter outputs are valid Cubism ranges",()=>{
 const controller=motion.createController({seed:.421});
 for(let t=0;t<18000;t+=16.667){
  const p=controller.step({now:t,phase:t<6000?"listening":t<12000?"speaking":"thinking",emotion:"smile",audio:.62,mode:"gelap"});
  for(const [key,value] of Object.entries(p)){
   assert.ok(Number.isFinite(value),key+" must be finite");
   assert.ok(key in motion.limits,key+" must be a declared Cubism parameter");
   const [lo,hi]=motion.limits[key];assert.ok(value>=lo&&value<=hi,key+": "+value);
  }
 }
 assert.ok(controller.snapshot().blinkCount>=1,"irregular blinking must happen");
});

test("blink intervals are not a repeating 4.15 second timer",()=>{
 const c=motion.createController({seed:.421}),intervals=[];
 let previous=0;
 for(let t=0;t<=65000;t+=20){
  c.step({now:t});
  const n=c.snapshot().blinkCount;
  if(n>previous){intervals.push(t);previous=n;}
 }
 assert.ok(intervals.length>6,JSON.stringify(intervals));
 const gaps=intervals.slice(1).map((t,i)=>t-intervals[i]);
 assert.ok(new Set(gaps).size>3,"blink timing should vary: "+gaps.join(","));
 assert.ok(gaps.every(t=>t>=2300&&t<=6500));
});

test("talking mouth attacks and releases smoothly with no idle phantom motion",()=>{
 const c=motion.createController();
 for(let t=0;t<1000;t+=17)c.step({now:t,phase:"idle",audio:1});
 assert.equal(c.snapshot().mouth,0);
 const start=c.step({now:1020,phase:"speaking",audio:.7}).ParamMouthOpenY;
 const rising=c.step({now:1040,phase:"speaking",audio:.7}).ParamMouthOpenY;
 assert.ok(start>0&&start<rising&&rising<.9,{start,rising});
 for(let t=1060;t<=1600;t+=20)c.step({now:t,phase:"speaking",audio:.7});
 const closing=c.step({now:1620,phase:"idle",audio:0}).ParamMouthOpenY;
 assert.ok(closing>0&&closing<.85,"release must not snap or remain stuck");
 for(let t=1640;t<2600;t+=20)c.step({now:t,phase:"idle",audio:0});
 assert.ok(c.snapshot().mouth<.005,"mouth should return to rest");
});

test("head movements and expressions are damped, not instantaneous steps",()=>{
 const c=motion.createController({seed:.421});
 for(let t=0;t<1800;t+=20)c.step({now:t,phase:"idle"});
 const before=c.step({now:1820,phase:"idle",emotion:"neutral"});
 const step=c.step({now:1840,phase:"thinking",emotion:"surprised"});
 assert.ok(Math.abs(step.ParamAngleZ-before.ParamAngleZ)<.8,"head should not instantly jump");
 assert.ok(step.ParamBrowLY>0&&step.ParamBrowLY<.58,"eyebrow should fade in");
 for(let t=1860;t<3300;t+=20)c.step({now:t,phase:"thinking",emotion:"surprised"});
 const mature=c.step({now:3320,phase:"thinking",emotion:"surprised"});
 assert.ok(mature.ParamBrowLY>.50);
 const retreat=c.step({now:3340,phase:"idle",emotion:"neutral"});
 assert.ok(retreat.ParamBrowLY>.10,"neutral transition must not snap");
});

test("reduced-motion keeps eyes open and movement stable while allowing lip sync",()=>{
 const c=motion.createController();
 let first=null;
 for(let t=0;t<25000;t+=20){
  const p=c.step({now:t,phase:"idle",reducedMotion:true});
  if(t===0)first=p;
  assert.equal(p.ParamEyeLOpen,1);
  assert.equal(p.ParamEyeROpen,1);
 }
 const final=c.step({now:25020,phase:"idle",reducedMotion:true});
 assert.equal(final.ParamAngleX,first.ParamAngleX);
 assert.equal(final.ParamBodyAngleY,first.ParamBodyAngleY);
 assert.equal(c.snapshot().blinkCount,0);
 const voice=c.step({now:25040,phase:"speaking",audio:.55,reducedMotion:true});
 assert.ok(voice.ParamMouthOpenY>0);
});

test("original model art unchanged; native hair physics retained and damped",()=>{
 const manifest=JSON.parse(read("assets/live2d/aksara/aksara.model3.json"));
 const physic=JSON.parse(read("assets/live2d/aksara/"+manifest.FileReferences.Physics));
 const groups=physic.PhysicsSettings.filter(s=>s.Id.startsWith("PhysicsHair"));
 assert.equal(groups.length,8,"must preserve existing hair physics groups");
 assert.equal(physic.Meta.PhysicsSettingCount,13);
 assert.ok(groups.every(g=>g.Output.length>0&&g.Input.length>0));
 for(const g of groups){
  assert.ok(g.Input.some(i=>/Angle|Breath/.test(i.Source?.Id||"")),g.Id+" requires head/body physics");
  assert.ok(g.Output.every(o=>Number.isFinite(o.Scale)),g.Id+" output scaling valid");
 }
 assert.ok(read("bilik-antara-live2d-v03.js").includes("motion.step("));
 assert.ok(read("bilik-antara-live2d-v03.css").includes("voice-live2d-preview"));
 assert.equal(fs.existsSync(path.join(root,"assets/live2d/vendor/live2dcubismcore.min.js")),false);
});
