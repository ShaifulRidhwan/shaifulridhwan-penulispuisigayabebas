"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");

test("Code Engine v0.3 modules parse",()=>{
 for(const name of ["bilik-antara-code-runtime.js","bilik-antara-code-status.js",
   "bilik-antara-code-workspace.js","bilik-antara-code-chat.js",
   "bilik-antara-code-agent.js","bilik-antara-code-bridge.js",
   "bilik-antara-code-execution.js"]){
  assert.doesNotThrow(()=>new vm.Script(read(name),{filename:name}));
 }
});
test("five executable runtimes preserve v0.2 menu and HTML preview",()=>{
 const status=read("bilik-antara-code-status.js"),runtime=read("bilik-antara-code-runtime.js");
 const workspace=read("bilik-antara-code-workspace.js");
 assert.ok(!status.includes("codeEngineProbeAll"),"Old manual probe button must remain removed");
 assert.ok(status.includes('id="codeHtmlPreview"'));
 assert.ok(status.includes('data-code-language="cpp"'));
 assert.ok(runtime.includes('const LANGUAGES=Object.freeze(["javascript","python","typescript","sql","cpp"]);'));
 assert.ok(workspace.includes('sandbox=""')&&workspace.includes("script-src 'none'"));
 assert.ok(workspace.includes("ensureWebStarter()"));
});
test("real C++20 Clang WASM on-demand execution stays sandboxed",()=>{
 const runtime=read("bilik-antara-code-runtime.js");
 assert.ok(runtime.includes("@live-codes/clang-wasm@0.3.0"));
 assert.ok(runtime.includes('createCompiler("cpp"'));
 assert.ok(runtime.includes("compiler.run(job.source"));
 assert.ok(runtime.includes("compiler.dispose()"));
 assert.ok(runtime.includes("cpp:180000"));
 assert.ok(runtime.includes("stdin.length>4000"));
 assert.ok(runtime.includes('frame.setAttribute("sandbox","allow-scripts")'));
 assert.ok(runtime.includes("worker.terminate()"));
 assert.ok(runtime.includes("options.signal"));
});
test("C++ project workflow exposes code, stdin, stop and output",()=>{
 const status=read("bilik-antara-code-status.js"),workspace=read("bilik-antara-code-workspace.js");
 const chat=read("bilik-antara-code-chat.js");
 assert.ok(status.includes("codeCPPState"));
 assert.ok(status.includes('language:"cpp"'));
 for(const symbol of ["ensureCppStarter","cwCppRun","cwCppStop","cwCppStdin","cwCppOutput",".cpp"]){
  assert.ok(workspace.includes(symbol),"Missing C++ workspace "+symbol);
 }
 assert.ok(chat.includes("const isCpp="));
 assert.ok(chat.includes('language:"cpp"'));
});
test("v0.3 page loads fresh Code Engine JS",()=>{
 const html=read("bilik-antara.html");
 for(const asset of ["runtime.js?v=5","status.js?v=16","workspace.js?v=3","chat.js?v=6"]){
  assert.ok(html.includes("bilik-antara-code-"+asset),"Missing "+asset);
 }
});
