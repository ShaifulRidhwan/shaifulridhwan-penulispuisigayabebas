"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const {join}=require("node:path");
const root=join(__dirname,"..");
const read=name=>fs.readFileSync(join(root,name),"utf8");

test("v0.2 JavaScript modules parse",()=>{
 for(const name of ["bilik-antara-code-status.js","bilik-antara-code-workspace.js","bilik-antara-code-runtime.js"]){
  assert.doesNotThrow(()=>new vm.Script(read(name),{filename:name}));
 }
});
test("remove 4 runtime test button but preserve all runtime engines",()=>{
 const status=read("bilik-antara-code-status.js");
 const runtime=read("bilik-antara-code-runtime.js");
 assert.doesNotMatch(status,/id="codeEngineProbeAll"|Uji 4 runtime/);
 assert.match(status,/id=\\"codeHtmlPreview\\"/);
 for(const language of ["javascript","python","typescript","sql"])assert.match(runtime,new RegExp('"'+language+'"'));
 assert.match(runtime,/const LANGUAGES=Object\.freeze\(\["javascript","python","typescript","sql"\]\)/);
});
test("HTML preview requires explicit workspace event and iframe sandbox",()=>{
 const status=read("bilik-antara-code-status.js");
 const workspace=read("bilik-antara-code-workspace.js");
 assert.match(status,/aksara:code-workspace-open/);
 assert.match(workspace,/event\.detail\?\.language==="html"/);
 assert.match(workspace,/sandbox=\\"\\"/);
 assert.match(workspace,/referrerpolicy=\\"no-referrer\\"/);
 assert.match(workspace,/new DOMParser\(\)/);
 assert.match(workspace,/script-src 'none'/);
 assert.match(workspace,/connect-src 'none'/);
 assert.match(workspace,/form-action 'none'/);
 assert.match(workspace,/\.html,\.css/);
 assert.match(workspace,/schedulePreview\(\)/);
});
test("v0.2 assets are cache busted in the live page",()=>{
 const html=read("bilik-antara.html");
 assert.match(html,/bilik-antara-code-status\.js\?v=15/);
 assert.match(html,/bilik-antara-code-workspace\.js\?v=2/);
});
