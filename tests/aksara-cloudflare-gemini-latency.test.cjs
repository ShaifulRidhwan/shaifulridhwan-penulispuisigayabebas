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
 assert.match(chat,/status:e\.name==="AbortError"\?"ready":"offline"/);
 assert.match(chat,/reason:e\.name==="AbortError"\?"health_timeout"/);
 assert.match(html,/id==="gemini"&&item\?\.reason==="health_timeout"/);
});
