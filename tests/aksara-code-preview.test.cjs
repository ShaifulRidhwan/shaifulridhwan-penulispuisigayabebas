"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");

require("./aksara-terminal-core.test.cjs");

test("Code Engine v0.3 modules parse",()=>{
 for(const name of ["bilik-antara-code-runtime.js","bilik-antara-code-health.js","bilik-antara-code-status.js",
   "bilik-antara-code-workspace.js","bilik-antara-code-chat.js",
   "bilik-antara-code-agent.js","bilik-antara-code-bridge.js","bilik-antara-code-linux.js",
   "bilik-antara-code-execution.js"]){
  assert.doesNotThrow(()=>new vm.Script(read(name),{filename:name}));
 }
});
test("five executable runtimes preserve v0.2 menu and HTML preview",()=>{
 const status=read("bilik-antara-code-status.js"),runtime=read("bilik-antara-code-runtime.js");
 const workspace=read("bilik-antara-code-workspace.js");
 assert.ok(!status.includes("codeEngineProbeAll"),"Old manual probe button must remain removed");
 assert.ok(status.includes('id="codeHtmlPreview"'));
 const list=status.slice(status.indexOf('id="codeRuntimeList"'));
 const markers=['id="codeDeveloperShellOpen"','id="codeLinuxOpen"','id="codeHtmlPreview"','data-code-language="javascript"',
   'data-code-language="python"','data-code-language="typescript"',
   'data-code-language="sql"','data-code-language="cpp"'];
 const positions=markers.map(m=>list.indexOf(m));
 assert.ok(positions.every((p,i)=>p>=0&&(i===0||p>positions[i-1])),
  "Developer Shell must be first, experimental Linux second, and code runtimes unchanged");
 assert.ok(status.includes('data-code-language="cpp"'));
 assert.ok(runtime.includes('const LANGUAGES=Object.freeze(["javascript","python","typescript","sql","cpp"]);'));
 assert.ok(workspace.includes('sandbox=""')&&workspace.includes("script-src 'none'"));
 assert.ok(workspace.includes("ensureWebStarter()"));
});
test("Linux Developer Sandbox is isolated, lazy and integrated into Code Engine, not Security Lab",()=>{
 const menu=read("bilik-antara-code-status.js"),html=read("bilik-antara.html"),linux=read("bilik-antara-code-linux.js");
 assert.ok(menu.indexOf('id="codeDeveloperShellOpen"') < menu.indexOf('id="codeLinuxOpen"'));
 assert.ok(menu.indexOf('id="codeLinuxOpen"') < menu.indexOf('id="codeHtmlPreview"'));
 assert.ok(!menu.includes("🐧"));
 assert.match(menu,/aksara:code-developer-shell-open/);
 assert.match(menu,/aksara:code-linux-open/);
 assert.match(html,/bilik-antara-code-linux\.js\?v=2/);
 assert.match(html,/bilik-antara-code-linux\.css\?v=2/);
 assert.ok(!read("security-lab.html").includes('id="tab-linux"'));
 assert.ok(linux.includes("new V86("));
 assert.ok(linux.includes('"serial0-output-byte"') && linux.includes('vm.serial0_send(input + "\\n")'));
 assert.ok(linux.includes('VM_LIBRARY') && linux.includes('function getLibrary()'));
 assert.doesNotMatch(linux,/network_relay_url\s*:|net_device\s*:/);
 assert.ok(linux.includes("save_state()") && linux.includes("restore_state(data)"));
 assert.ok(linux.includes("get_instruction_counter"));
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
 for(const asset of ["runtime.js?v=8","status.js?v=23","workspace.js?v=11","chat.js?v=11","agent.js?v=6"]){
  assert.ok(html.includes("bilik-antara-code-"+asset),"Missing "+asset);
 }
});

test("AI Code Agent starts enabled without removing manual OFF and stop",()=>{
 const agent=read("bilik-antara-code-agent.js");
 assert.ok(agent.includes("setPermission(true);"),"Default AI code permission must be ON");
 assert.ok(agent.includes('input.addEventListener("change",()=>setPermission(input.checked))'),"User must retain manual OFF");
 assert.ok(agent.includes("if(!allowed){pending=null;controller?.abort();}"),"Manual OFF must abort queued execution");
 assert.ok(agent.includes('window.addEventListener("ba:cleared",()=>{pending=null;controller?.abort();setPermission(allowed);});'),"Clearing chat must not silently re-enable a manual OFF");
 assert.ok(agent.includes("if(!allowed||running)return;")&&
    agent.includes("if(!requested(d.question,job?.language))return;"),"No unrelated auto-execution");
 assert.ok(agent.includes('stop.addEventListener("click"'),"Execution stop must stay available");
});
require("./aksara-code-followup.test.cjs");

test("AI HTML preview renders inline with an isolated iframe and an editor action",()=>{
 const workspace=read("bilik-antara-code-workspace.js");
 for(const token of ['className="aksara-inline-preview"','frame.setAttribute("sandbox","")',
  'frame.srcdoc=safePreviewDocument(parsed.html,parsed.css)',
  'window.addEventListener("ba:answered"','Buka Editor · Code Engine']){
  assert.ok(workspace.includes(token),"Missing inline preview behavior: "+token);
 }
 assert.ok(workspace.includes("inline:i===newestAI")&&
    workspace.includes('const newestAI=history.findLastIndex'),"Only newest non-code AI reply should render an inline preview");
});

test("AI Python follow-up can show console and editor without disturbing HTML preview",()=>{
 const agent=read("bilik-antara-code-agent.js"),workspace=read("bilik-antara-code-workspace.js");
 const html=read("bilik-antara.html");
 for(const marker of ["function inlineCodeConsole(job,element)","function openAICode(job)",
  "engine.run(job.language,job.code","aksara-inline-console","runnable&&inline",
  "window.addEventListener(\"aksara:code-result\""]){
  assert.ok(workspace.includes(marker),"Missing AI code integration: "+marker);
 }
 assert.ok(agent.includes('const match=/^(?:kalau\\s+)?'),"Short language-switch follow-ups must be detected");
 assert.ok(agent.includes('window.AksaraCodeChat?.extractWebCode?.(prior.content)'),"Previous code context required");
 assert.ok(html.includes('new Event("ba:history-rendered")'),"Restored console must work with memory OFF");
 assert.ok(workspace.includes('window.addEventListener("ba:history-rendered"'),"History re-render must restore action");
});

test("Workspace runs JavaScript, Python, TypeScript and SQL without round-tripping through AI",()=>{
 const workspace=read("bilik-antara-code-workspace.js");
 for(const token of ['id="cwRuntimePanel"','id="cwRuntimeRun"','id="cwRuntimeStop"',
  'id="cwRuntimeOutput"','engine.run(language,source','runtimeController?.abort()',
  'setRuntimeRunning(true)','language==="cpp"']){
  assert.ok(workspace.includes(token),"Missing unified runtime: "+token);
 }
 assert.ok(workspace.includes('frame.setAttribute("sandbox","")'));
 assert.ok(workspace.includes('script-src \'none\''));
});

test("on-demand smoke checks verify runtime evidence without permanent Ready claims",()=>{
 const status=read("bilik-antara-code-status.js"),health=read("bilik-antara-code-health.js");
 for(const marker of ['id="codeEngineRefresh"','engine.probeLanguage(language,{signal:controller.signal})',
  'verificationController.abort()','code-refresh-data-note','health.verifyRuntime(language,report.ready===true'])
  assert.ok(status.includes(marker),"Missing runtime verification: "+marker);
 assert.ok(!status.includes('id="codeEngineVerifyAll"'),"No duplicate full-runtime button");
 const sandbox={document:{}};vm.runInNewContext(health,{window:sandbox});
 let now=100000;const monitor=sandbox.AksaraCodeHealth.create(()=>now);
 assert.equal(monitor.verifyRuntime("python",true,{latencyMs:410}),true);
 assert.equal(monitor.snapshot().rows.find(r=>r.language==="python").status,"verified");
 now+=300001;
 assert.equal(monitor.snapshot().rows.find(r=>r.language==="python").status,"unverified");
});
