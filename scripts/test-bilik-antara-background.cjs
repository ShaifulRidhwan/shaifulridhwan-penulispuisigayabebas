"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {test}=require("node:test");
const read=(name)=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const html=read("bilik-antara.html"),css=read("bilik-antara.css"),js=read("bilik-antara-cinematic.js");
test("Bilik Aksara uses two original cinematic WebP assets without legacy iframe",()=>{
 for(const name of ["aksara-cinematic-desktop.webp","aksara-cinematic-mobile.webp"]){
  const img=fs.readFileSync(path.join(__dirname,"..",name));
  assert.equal(img.subarray(0,4).toString(),"RIFF");
  assert.equal(img.subarray(8,12).toString(),"WEBP");
  assert.ok(html.includes(name+"?v=1"));
  assert.ok(css.includes(name+"?v=1"));
 }
 assert.match(html,/bilik-antara-cinematic\.js\?v=1/);
 assert.doesNotMatch(html,/bilik-antara-living-v08/);
 assert.doesNotMatch(css,/aksara-celestial-static/);
 assert.doesNotMatch(js,/createElement\(["']iframe/);
});
test("Cinematic layers respond to Thinking Mode and pause during voice, reduced motion, saver",()=>{
 assert.match(html,/class="cinematic-glow"/);
 assert.match(css,/data-cinematic-mode="gelap"/);
 assert.match(css,/app-shell\.is-busy/);
 assert.match(js,/ba:thought-mode-changed/);
 assert.match(js,/prefers-reduced-motion: reduce/);
 assert.match(js,/network\?\.saveData/);
 assert.match(js,/voice-focus/);
 assert.match(js,/document\.hidden/);
 assert.match(css,/data-motion="off"/);
 assert.match(css,/max-width:760px/);
});
