"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
test("Cloudflare Gemini time budget is independent from Netlify",()=>{
 const chat=fs.readFileSync("netlify/functions/bilik-antara.js","utf8");
 const stream=fs.readFileSync("netlify/functions/bilik-antara-stream.mjs","utf8");
 assert.match(chat,/const cloudflare=process\.env\.AKSARA_CLOUD_MIGRATION==="preview"/);
 assert.match(chat,/deadline=started\+\(cloudflare\?46000:24000\)/);
 assert.match(chat,/plan\.thinkingLevel==="high"\?28000:19000/);
 assert.match(chat,/plan\.thinkingLevel==="high"\?15000:6500/);
 assert.match(chat,/timeoutMs:cloudflare\?18500:12000/);
 assert.match(stream,/AKSARA_CLOUD_MIGRATION==="preview"\?44000:26000/);
});
test("A timed-out Gemini health probe is not mislabeled as an actual offline upstream failure",()=>{
 const chat=fs.readFileSync("netlify/functions/bilik-antara.js","utf8");
 const html=fs.readFileSync("bilik-antara.html","utf8");
 assert.match(chat,/GeminiTextPool\.failure\(entry\.slot,e/);
 assert.match(chat,/status:\[401,403,404,400\]\.includes\(e\.status\)\?"offline":"ready"/);
 assert.match(chat,/http:200,reason:"health_empty_reply"/);
 assert.match(chat,/e\.name==="AbortError"\?"health_timeout"/);
 assert.match(html,/id==="gemini"&&item\?\.reason==="health_timeout"/);
});

test("Gemini health probe quota does not poison real chat cooldown and surfaces diagnostic status",()=>{
 const chat=fs.readFileSync("netlify/functions/bilik-antara.js","utf8");
 const html=fs.readFileSync("bilik-antara.html","utf8");
 assert.doesNotMatch(chat,/catch\(e\)\{\s*googleCooldown\(fastModel,e\)/);
 assert.match(chat,/e\.status===429\?"health_probe_quota"/);
 assert.match(html,/Ready · Probe 429/);
 assert.match(html,/Offline · HTTP /);
 assert.match(html,/Cooldown /);
});
