"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const html=fs.readFileSync("bilik-antara.html","utf8");
const css=fs.readFileSync("bilik-antara-cinematic.css","utf8");
const art=fs.readFileSync("bilik-antara-cover-art.jpg");
test("Original novel art is used, not a generic external image",()=>{
 assert.equal(art[0],0xff);assert.equal(art[1],0xd8);
 assert.match(css,/bilik-antara-cover-art\.jpg/);
 assert.match(html,/rel="preload" href="bilik-antara-cover-art\.jpg"/);
 assert.match(html,/class="world-scene"/);
 assert.ok(art.length<300000);
});
test("Cinematic identity replaces orbital dashboard markup",()=>{
 assert.doesNotMatch(html,/class="eclipse-scene"/);
 assert.match(html,/Aku, Kecerdasan Buatan/);
 assert.match(html,/bilik-antara-cinematic\.css\?v=1/);
 assert.match(html,/(Ruang Perbualan|Saluran Antara)/);
 assert.match(css,/\.world-art/);
 assert.match(css,/\.world-haze/);
 assert.match(css,/\.world-embers/);
 assert.match(css,/\.messages\.is-welcome/);
});
test("Existing chat connections and functionality survive",()=>{
 for(const id of ["chat","connection","connectionText","connectionInfo","connectionInfoText",
  "retryBtn","starters","composer","input","sendBtn","documentUpload",
  "rememberChat","clearChat","thoughtItems","forgetIdeas","docStatus",
  "removeAttachment","themeToggle"]){
  assert.ok(html.includes('id="'+id+'"'),"Missing "+id);
 }
 assert.match(html,/\/\.netlify\/functions\/bilik-antara/);
 for(const term of ["publicAccount","argumentMap","truthAudit","thoughtLedger","renderExtras","fileState"]){
  assert.ok(html.includes(term),"Missing "+term);
 }
 assert.doesNotMatch(html,/ara-face\.glb|THREE\.|<canvas/i);
});
test("Mobile layout supports keyboard resize and legible inputs",()=>{
 assert.match(html,/visualViewport/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/--app-height/);
 assert.match(css,/\.composer textarea\{font-size:16px/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
test("New stylesheet is syntactically balanced",()=>{
 let depth=0,quote="",comment=false,escaped=false;
 for(let i=0;i<css.length;i++){
  const c=css[i],next=css[i+1];
  if(comment){if(c==="*"&&next==="/"){comment=false;i++;}continue;}
  if(quote){if(escaped){escaped=false;continue;}if(c==="\\"){escaped=true;continue;}if(c===quote)quote="";continue;}
  if(c==="/"&&next==="*"){comment=true;i++;continue;}
  if(c==="'"||c==='"'){quote=c;continue;}
  if(c==="{")depth++;
  if(c==="}"){depth--;assert.ok(depth>=0);}
 }
 assert.equal(depth,0);assert.equal(quote,"");assert.equal(comment,false);
});
