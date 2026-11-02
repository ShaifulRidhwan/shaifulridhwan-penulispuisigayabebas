"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const script=fs.readFileSync("bilik-antara-video.js","utf8");
const html=fs.readFileSync("bilik-antara.html","utf8");
const css=fs.readFileSync("bilik-antara-video.css","utf8");

test("Bilik Antara uses only static celestial wallpaper in the live page",()=>{
 assert.doesNotMatch(html,/aksaraAmbientVideo|aksara-bilik-antara-ambient\.mp4|bilik-antara-video\.js\?v=2/);
 assert.match(html,/aksara-celestial-desktop\.webp\?v=1/);
 assert.match(html,/aksara-celestial-mobile\.webp\?v=1/);
 assert.match(css,/\.world-scene\.has-ambient-video \.world-art/);
 for(const page of ["studio-antara.html","perpustakaan-aksara.html"]){
  assert.doesNotMatch(fs.readFileSync(page,"utf8"),/aksaraAmbientVideo|aksara-bilik-antara-ambient\.mp4/);
 }
 assert.doesNotThrow(()=>new vm.Script(script)); // Legacy module kept for rollback only.
});

function harness({saveData=false,reduced=false,hidden=false}={}){
 const handlers=new Map(),observed=[];
 const on=(target,type,fn)=>{handlers.set(target+":"+type,(handlers.get(target+":"+type)||[]).concat(fn))};
 const emit=(target,type)=>{for(const fn of handlers.get(target+":"+type)||[])fn()};
 const classes=new Set();
 const scene={classList:{add:n=>classes.add(n),remove:n=>classes.delete(n),contains:n=>classes.has(n)}};
 const voice={hidden:true};
 const trigger={getAttribute:name=>name==="aria-pressed"?(trigger.pressed?"true":"false"):null,
  pressed:false,addEventListener:(type,fn)=>on("trigger",type,fn)};
 const video={paused:true,plays:0,pauses:0,
  addEventListener:(type,fn)=>on("video",type,fn),
  play(){this.plays++;this.paused=false;emit("video","playing");return Promise.resolve()},
  pause(){this.pauses++;this.paused=true;emit("video","pause")}
 };
 const motion={matches:reduced,addEventListener:(type,fn)=>on("motion",type,fn)};
 const conn={saveData,addEventListener:(type,fn)=>on("connection",type,fn)};
 const doc={hidden,readyState:"complete",
  getElementById:id=>id==="aksaraAmbientVideo"?video:id==="voicePanel"?voice:id==="voiceLive"?trigger:null,
  querySelector:q=>q===".world-scene"?scene:null,
  addEventListener:(type,fn)=>on("document",type,fn)};
 class MockObserver{constructor(fn){this.fn=fn;observed.push(this)}observe(){}disconnect(){}}
 vm.runInNewContext(script,{document:doc,navigator:{connection:conn},
  window:{matchMedia:()=>motion,addEventListener:(type,fn)=>on("window",type,fn)},
  MutationObserver:MockObserver});
 return {video,voice,trigger,motion,conn,doc,classes,mutate:()=>observed.forEach(o=>o.fn()),emit};
}
test("Video plays only in ordinary chat, pauses throughout active Voice Chat and resumes after it",()=>{
 const h=harness();
 assert.equal(h.classes.has("has-ambient-video"),true);
 h.trigger.pressed=true;h.voice.hidden=false;h.mutate();
 assert.equal(h.video.paused,true);
 assert.equal(h.classes.has("has-ambient-video"),false);
 // Minimized Voice Chat still has an active session.
 h.voice.minimized=true;h.mutate();
 assert.equal(h.video.paused,true);
 h.voice.hidden=true;h.trigger.pressed=false;h.mutate();
 assert.equal(h.video.paused,false);
 assert.equal(h.classes.has("has-ambient-video"),true);
});
test("No background video on hidden tab, reduced motion, Data Saver or playback error",()=>{
 for(const initial of [{hidden:true},{reduced:true},{saveData:true}]){
  const h=harness(initial);
  assert.equal(h.video.plays,0);
  assert.equal(h.classes.has("has-ambient-video"),false);
 }
 const h=harness();h.doc.hidden=true;h.emit("document","visibilitychange");
 assert.equal(h.video.paused,true);
 h.doc.hidden=false;h.emit("document","visibilitychange");
 assert.equal(h.video.paused,false);
 h.emit("video","error");h.mutate();
 assert.equal(h.video.paused,true);
 assert.equal(h.classes.has("has-ambient-video"),false);
});

test("Short buffering never flashes the static wallpaper; real pause and failure still do",()=>{
 const h=harness();
 assert.equal(h.classes.has("has-ambient-video"),true);
 h.emit("video","waiting");
 h.emit("video","stalled");
 assert.equal(h.classes.has("has-ambient-video"),true,"Frame must stay visible during brief buffering");
 h.video.pause();
 assert.equal(h.classes.has("has-ambient-video"),false);
 h.video.play();
 assert.equal(h.classes.has("has-ambient-video"),true);
 h.emit("video","error");
 assert.equal(h.classes.has("has-ambient-video"),false);
});
test("Versioned static wallpaper links bypass prior browser cache",()=>{
 assert.ok(html.includes("aksara-celestial-mobile.webp?v=1"));
 assert.ok(html.includes("aksara-celestial-desktop.webp?v=1"));
 assert.ok(html.includes("bilik-antara.css?v=103"));
});
