"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const html=fs.readFileSync("bilik-antara.html","utf8");
test("Fresh light-dark visual without legacy GPU canvas",()=>{
 assert.ok(html.includes("eclipse-scene"));
 assert.ok(html.includes('id="themeToggle"'));
 assert.ok(html.includes('html[data-theme="light"]'));
 assert.ok(html.includes("prefers-reduced-motion:reduce"));
 assert.ok(!html.includes("<canvas"));
 assert.ok(!html.includes("ai-face"));
 assert.ok(!html.includes("THREE."));
});
test("All backend-critical controls preserved",()=>{
 const ids=["chat","connection","connectionText","connectionInfo","connectionInfoText",
 "retryBtn","starters","composer","input","sendBtn","documentUpload",
 "rememberChat","clearChat","thoughtItems","forgetIdeas","docStatus",
 "removeAttachment","themeToggle"];
 for(const id of ids)assert.ok(html.includes('id="'+id+'"'),"Missing "+id);
});
test("Single automatic intelligence and safe OSINT UI",()=>{
 assert.ok(html.includes("/.netlify/functions/bilik-antara"));
 assert.ok(!html.includes('data-insight='));
 assert.ok(html.includes("publicAccount"));
 assert.ok(html.includes("argumentMap"));
 assert.ok(html.includes("truthAudit"));
 assert.ok(html.includes("thoughtLedger"));
 assert.ok(html.includes("profileUrl"));
});
test("No inline JS syntax errors or duplicate IDs",()=>{
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
 assert.equal(scripts.length,1);
 for(const [,content]of scripts)assert.doesNotThrow(()=>new Function(content));
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
 assert.equal(ids.length,new Set(ids).size);
});
