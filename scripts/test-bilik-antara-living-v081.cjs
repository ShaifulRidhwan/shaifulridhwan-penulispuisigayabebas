"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const src=fs.readFileSync("bilik-antara-living-v08.js","utf8");
const html=fs.readFileSync("bilik-antara.html","utf8");
const bg=fs.readFileSync("bilik-antara-living-v08-bg.html","utf8");

test("Bilik-only loading and locked v0.8 visuals remain unchanged",()=>{
 assert.ok(html.includes("bilik-antara-living-v08.js?v=2"));
 for(const marker of ["livingHairWindOuter","livingPhysicalMoon","solarTideAttackA","livingGownGold"]){
  assert.ok(bg.includes(marker),"Locked visual missing: "+marker);
 }
 assert.ok(!html.includes('src="bilik-antara-living-v08-bg.html"'));
});

test("Voice pause reuses iframe, then releases it after 45 seconds",()=>{
 let voiceBusy=false,hidden=false,reduced=false,saveData=false;
 let created=0,removed=0,sync=null,clock=0;
 const timers=new Map(),animationStates=[];
 const scene={appendChild(frame){this.frame=frame;}};
 const voice={get hidden(){return !voiceBusy;}};
 const document={
  get hidden(){return hidden;},
  querySelector:s=>s===".world-scene"?scene:null,
  getElementById:s=>s==="voicePanel"?voice:null,
  createElement(){
   created++;
   const events={};
   return {
    style:{cssText:"",display:"block"},
    setAttribute(){},
    addEventListener:(name,fn)=>events[name]=fn,
    fire:name=>events[name]?.(),
    contentDocument:{querySelector:()=>({classList:{toggle:(_,active)=>animationStates.push(active)}})},
    remove(){removed++;}
   };
  },
  body:{classList:{contains:()=>voiceBusy}},
  documentElement:{dataset:{}},addEventListener(){}
 };
 const window={matchMedia:()=>({get matches(){return reduced;},addEventListener(){}}),addEventListener(){}};
 const navigator={connection:{get saveData(){return saveData;},addEventListener(){}}};
 class Observer{constructor(fn){sync=fn;}observe(){}}
 vm.runInNewContext(src,{document,window,navigator,MutationObserver:Observer,
  setTimeout(fn){const id=++clock;timers.set(id,fn);return id;},
  clearTimeout(id){timers.delete(id);}});
 assert.equal(created,1);
 scene.frame.fire("load");
 voiceBusy=true;sync();
 assert.equal(scene.frame.style.display,"none");
 assert.equal(animationStates.at(-1),false);
 voiceBusy=false;sync();
 assert.equal(scene.frame.style.display,"block");
 assert.equal(created,1,"Short Voice pause should not create a second iframe");
 assert.equal(animationStates.at(-1),true);
 voiceBusy=true;sync();
 assert.equal(timers.size,1);
 [...timers.values()][0]();
 assert.equal(removed,1,"Long Voice pause should release the iframe");
 voiceBusy=false;sync();
 assert.equal(created,2);
 reduced=true;sync();
 assert.equal(removed,2,"Reduced Motion should release immediately");
 reduced=false;saveData=true;sync();
 assert.equal(created,2,"Data Saver must not load animation");
 saveData=false;hidden=true;sync();
 assert.equal(created,2,"Background tab must stay static");
});
