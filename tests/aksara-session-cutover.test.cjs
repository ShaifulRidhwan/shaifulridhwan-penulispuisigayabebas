"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const u=require("../bilik-antara-session-utils");
const user=(content,timestamp)=>({role:"user",content,timestamp});
const bot=(content,timestamp)=>({role:"assistant",content,timestamp});
test("topic skips greeting when real question exists",()=>{
 assert.equal(u.conversationTitle([user("anyyeong",1),bot("Hai",2),user("Bagi contoh puisi beserta maksud",3)]),"Bagi contoh puisi beserta maksud");
 assert.equal(u.conversationTitle([user("anyyeong",1)]),"anyyeong");
});
test("same reopened conversation reuses archive ID",()=>{
 const old=[user("anyyeong",101),bot("Hai",102)];
 assert.equal(u.matchArchivedSession([{id:"saved",history:old}],old.concat(user("Puisi",103))),"saved");
});
test("unrelated chats with same greeting remain separate",()=>{
 const archive=[{id:"old",history:[user("anyyeong",101),bot("Hai",102)]}];
 assert.equal(u.matchArchivedSession(archive,[user("anyyeong",201),bot("Hai",202)]),null);
 assert.equal(u.matchArchivedSession(archive,[user("anyyeong",101),bot("Lain",102)]),null);
});
test("Netlify homepage links directly to Cloudflare and legacy chat URL redirects",()=>{
 const home=fs.readFileSync("index.html","utf8");
 assert.equal((home.match(/href="https:\/\/aksara-apps\.mshaifulridhwan\.workers\.dev\/bilik-antara\.html"/g)||[]).length,2);
 const suite=fs.readFileSync("bilik-antara-suite.js","utf8");
 assert.match(suite,/Eksport semua sesi \(JSON\) dahulu/);
 assert.match(suite,/ba-session-group/);
});

test("legacy Netlify chatbot redirects, with a separate export-only archive page",()=>{
 const redirects=fs.readFileSync("_redirects","utf8");
 const destination="https://aksara-apps.mshaifulridhwan.workers.dev/bilik-antara.html";
 assert.match(redirects,new RegExp("^/bilik-antara\\.html\\s+"+destination.replace(/[.*+?^${}()|[\\]\\]/g,"\\$&")+"\\s+302!$","m"));
 assert.match(redirects,/^\/bilik-antara\s+https:\/\/aksara-apps\.mshaifulridhwan\.workers\.dev\/bilik-antara\.html\s+302!$/m);
 const exportPage=fs.readFileSync("arkib-sesi-netlify.html","utf8");
 assert.match(exportPage,/bilik-antara-suite-v1-archive/);
 assert.match(exportPage,/bilik-antara-session-v2/);
 assert.match(exportPage,/Eksport arkib JSON/);
 assert.doesNotMatch(exportPage,/<iframe|window\.location\.replace/);
 const build=fs.readFileSync("cloudflare/build.mjs","utf8");
 assert.doesNotMatch(build,/arkib-sesi-netlify\.html/);
});
