"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const html=fs.readFileSync("bilik-antara.html","utf8");
const suite=fs.readFileSync("bilik-antara-suite.js","utf8");

test("session save is unticked by default and requires explicit saved on preference",()=>{
 assert.match(html,/<input type="checkbox" id="rememberChat">/);
 assert.doesNotMatch(html,/<input type="checkbox" id="rememberChat" checked>/);
 assert.match(html,/ui\.remember\.checked=localStorage\.getItem\(SESSION_PREF_STORAGE\)==="on";/);
 assert.match(html,/if\(!ui\.remember\.checked\)return;\s+const stored=/);
 assert.match(html,/localStorage\.setItem\(SESSION_PREF_STORAGE,ui\.remember\.checked\?"on":"off"\)/);
});

test("memory notes are unticked when unconfigured, previous explicit saves honored",()=>{
 assert.match(suite,/read\(KEYS\.memory,\{enabled:false,text:""\}\)/);
 assert.match(suite,/memory=\{enabled:false,text:""\}/);
 assert.match(suite,/toggle\.checked=!!memory\.enabled/);
 assert.match(suite,/const updated=\{enabled:toggle\.checked,text:field\.value\.trim\(\)\.slice\(0,8000\)\}/);
});

test("changing default never wipes old session archives or memory notes",()=>{
 const restore=html.slice(html.indexOf("function restore(){"),html.indexOf("function renderIdeas(){"));
 assert.doesNotMatch(restore,/removeItem\(SESSION_PREF_STORAGE\)/);
 assert.doesNotMatch(restore,/removeItem\(PREFIX/);
 const memInit=suite.slice(suite.indexOf("let memory=read("),suite.indexOf("let workspace=read("));
 assert.doesNotMatch(memInit,/removeItem|localStorage\.clear/);
});
