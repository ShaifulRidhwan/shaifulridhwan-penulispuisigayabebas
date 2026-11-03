"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const html=fs.readFileSync("bilik-antara.html","utf8");
const suite=fs.readFileSync("bilik-antara-suite.js","utf8");

test("session saving defaults ON for first visit but explicit OFF survives reload",()=>{
 assert.match(html,/<input type="checkbox" id="rememberChat" checked>/);
 assert.match(html,/ui\.remember\.checked=localStorage\.getItem\(SESSION_PREF_STORAGE\)!=="off";/);
 assert.match(html,/if\(!ui\.remember\.checked\)return;\s+const stored=/);
 assert.match(suite,/localStorage\.setItem\(preferenceKey,enabled\?"on":"off"\)/);
 assert.match(suite,/if\(enabled\)api\.persistSession\(\);/);
 assert.match(suite,/else try\{localStorage\.removeItem\(snapshotKey\);\}/);
});

test("memory notes default ON without pre-filling notes, explicit OFF remains intact",()=>{
 assert.match(suite,/read\(KEYS\.memory,\{enabled:true,text:""\}\)/);
 assert.match(suite,/memory=\{enabled:true,text:""\}/);
 assert.match(suite,/toggle\.checked=!!memory\.enabled/);
 assert.match(suite,/const updated=\{enabled:toggle\.checked,text:field\.value\.trim\(\)\.slice\(0,8000\)\}/);
 assert.match(suite,/memory\.enabled&&typeof memory\.text==="string"/);
 assert.match(suite,/enabled:false,text:""/); // Manual delete explicitly disables memory.
});

test("existing saved session OFF, saved memory OFF and saved notes are not migrated away",()=>{
 assert.match(html,/localStorage\.getItem\(SESSION_PREF_STORAGE\)!=="off"/);
 assert.match(suite,/read\(KEYS\.memory,\{enabled:true,text:""\}\)/);
 assert.doesNotMatch(suite,/localStorage\.removeItem\(KEYS\.memory\)/);
 assert.doesNotMatch(suite,/localStorage\.setItem\(KEYS\.memory.*enabled:true/);
 assert.match(html,/bilik-antara-suite\.js\?v=17/);
});

test("changing default never wipes old session archives or memory notes",()=>{
 const restore=html.slice(html.indexOf("function restore(){"),html.indexOf("function renderIdeas(){"));
 assert.doesNotMatch(restore,/removeItem\(SESSION_PREF_STORAGE\)/);
 assert.doesNotMatch(restore,/removeItem\(PREFIX/);
 const memInit=suite.slice(suite.indexOf("let memory=read("),suite.indexOf("let workspace=read("));
 assert.doesNotMatch(memInit,/removeItem|localStorage\.clear/);
});
