"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const read=n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8");
const core=require("../bilik-antara-terminal-core.js");
test("AI terminal modules parse and stay behind sandbox runtime",()=>{
 assert.doesNotThrow(()=>new vm.Script(read("bilik-antara-ai-terminal.js")));
 const ui=read("bilik-antara-ai-terminal.js"),html=read("bilik-antara.html");
 for(const token of ["engine.run(f.language,f.code","codeAITerminalOpen","AksaraCodeWorkspace?.receiveFile",
  "Project Memory","aitPatchBox","window.confirm(","core.zip(files)","storage(\"delete\")"]){
  assert.ok(ui.includes(token),"Missing AI Terminal feature "+token);
 }
 assert.ok(html.includes("bilik-antara-ai-terminal.js?v=5"));
 assert.ok(html.includes("bilik-antara-terminal-core.js?v=3"));
 assert.ok(html.includes("codeContext")&&html.includes("CODE_GUIDANCE"));
});
test("terminal command grammar rejects shell and wrong runtime",()=>{
 assert.deepEqual(core.command("python main.py"),{type:"run",name:"main.py",language:"python"});
 assert.deepEqual(core.command("node main.js"),{type:"run",name:"main.js",language:"javascript"});
 assert.equal(core.command("node main.py").type,"invalid");
 for(const s of ["rm -rf /","curl https://example.org","pip install requests","npm install","cat ../../secret.py","run ../secret.py"]){
  assert.equal(core.command(s).type,"invalid",s);
 }
 assert.equal(core.command("ls").type,"ls");
});
test("project filename and duplicate safety",()=>{
 const valid=[{name:"main.py",language:"python",code:"print(42)"},{name:"query.sql",language:"sql",code:"SELECT 1;"}];
 assert.equal(core.filesValid(valid),true);
 assert.equal(core.filesValid([...valid,valid[0]]),false);
 assert.equal(core.filename("../secret.py"),false);
 assert.equal(core.filesValid([{name:"main.py",language:"sql",code:"SELECT 1"}]),false);
 assert.equal(core.filesValid([{name:"main.py",language:"python",code:"x".repeat(12001)}]),false);
});
test("AI prompts are grounded and redact common secrets",()=>{
 const prompt=core.aiPrompt({mode:"agent",language:"python",code:"api_key=abcdefghij0123456789",report:{ok:false,stderr:"NameError"},attempt:1});
 assert.ok(prompt.startsWith("[AKSARA CODE BRIDGE]"));
 assert.ok(prompt.includes("BELUM")===false);
 assert.ok(prompt.includes("RALAT"));
 assert.ok(prompt.includes("[NILAI DISEMBUNYIKAN]"));
 assert.ok(!prompt.includes("abcdefghij0123456789"));
 assert.ok(core.capability(["python"]).toLowerCase().includes("bukan"));
 assert.ok(core.diff("print(1)","print(2)").includes("+print(2)"));
});
test("ZIP project export has valid store headers and central directory",()=>{
 const data=core.zip([{name:"main.py",language:"python",code:"print(42)\n"}]);
 const view=new DataView(data.buffer,data.byteOffset,data.byteLength);
 assert.equal(view.getUint32(0,true),0x04034b50);
 const last=data.length-22;
 assert.equal(view.getUint32(last,true),0x06054b50);
 assert.equal(view.getUint16(last+10,true),1);
 const centralOffset=view.getUint32(last+16,true);
 assert.equal(view.getUint32(centralOffset,true),0x02014b50);
 const compressed=view.getUint32(centralOffset+20,true);
 const raw=view.getUint32(centralOffset+24,true);
 assert.equal(compressed,raw);
 assert.equal(raw,10);
});
test("code guidance does not modify Gemini Voice Guidance",()=>{
 const b=read("bilik-antara-brain.js"),coding=read("bilik-antara-code-brain.js");
 assert.ok(coding.includes("const CODE_GUIDANCE="));
 assert.ok(coding.includes("root.AksaraCodeBrain=API"));
 assert.ok(b.includes("CORE,VOICE_GUIDANCE,TEXT_DELIVERY")); 
 assert.ok(!b.includes("VOICE_GUIDANCE.push("));
});

test("No stale 80 KB Bilik Antara HTML budget checks remain",()=>{
 const folders=[__dirname,path.join(__dirname,"..","scripts")];
 const found=[];
 for(const folder of folders)for(const name of fs.readdirSync(folder).filter(x=>x.endsWith(".cjs")||x.endsWith(".js"))){
  const content=fs.readFileSync(path.join(folder,name),"utf8");
  if(/html\.length\s*<\s*80000|html\.length\s*<=\s*80000|byteLength\(html(?:,\s*"utf8")?\)\s*<\s*80000/.test(content))
   found.push(path.relative(path.join(__dirname,".."),path.join(folder,name)));
 }
 assert.deepEqual(found,[], "Legacy 80 KB guards must be migrated to 100 KB");
});

test("terminal ZIP round-trips without losing code or accepting corrupted data",()=>{
 const project=[
  {name:"main.py",language:"python",code:"from utils import answer\nprint(answer())\n"},
  {name:"utils.py",language:"python",code:"def answer():\n    return 42\n"}
 ];
 const zip=core.zip(project);
 assert.deepEqual(core.unzipStore(zip),project);
 const corrupt=new Uint8Array(zip);corrupt[40]^=0x01;
 assert.throws(()=>core.unzipStore(corrupt),/Checksum|ZIP|sah/);
 assert.throws(()=>core.unzipStore(new Uint8Array(30)),/ZIP|sah/);
});
test("supervised AI patch accepts only one correct fenced block",()=>{
 const answer="Cadangan:\n"+String.fromCharCode(96).repeat(3)+"python\nprint(42)\n"+String.fromCharCode(96).repeat(3);
 assert.deepEqual(core.extractPatch(answer,"python"),{language:"python",code:"print(42)"});
 assert.equal(core.extractPatch(answer,"javascript"),null);
 assert.equal(core.extractPatch(answer+"\n"+answer,"python"),null);
 assert.equal(core.command("repl").type,"repl");
 assert.equal(core.command("reset").type,"reset");
 assert.equal(core.command("exit").type,"exit");
});
test("persistent Python session has strict file constraints and sandbox isolation",()=>{
 const session=require("../bilik-antara-python-session.js");
 assert.equal(session.validFiles([{name:"utils.py",code:"x=42"}]),true);
 assert.equal(session.validFiles([{name:"../secret.py",code:"x=1"}]),false);
 assert.equal(session.validFiles([{name:"my-utils.py",code:"x=1"}]),false);
 assert.equal(session.validFiles([{name:"utils.py",code:"x=1"},{name:"utils.py",code:"x=2"}]),false);
 assert.doesNotThrow(()=>new vm.Script(read("bilik-antara-python-session.js")));
 const source=read("bilik-antara-python-session.js");
 assert.ok(source.includes('frame.setAttribute("sandbox","allow-scripts")'));
 assert.ok(source.includes("loadPyodide"));
 assert.ok(source.includes("worker.postMessage"));
 assert.ok(!source.includes("allow-same-origin"));
});
test("terminal supports Python project imports and explicit agent patch review",()=>{
 const runtime=read("bilik-antara-code-runtime.js"),terminal=read("bilik-antara-ai-terminal.js");
 assert.ok(runtime.includes("projectFiles:job.projectFiles"));
 assert.ok(runtime.includes("py.FS.writeFile"));
 assert.ok(runtime.includes("options.projectFiles"));
 for(const phrase of ["pythonFiles()","core.extractPatch","file().code!==pending.before",
  "files[pos].code===target.source","agentCycle()","aitRepl","aitPreview",
  "aitImportZIP","core.unzipStore","aitStdin","closeRepl"]){
  assert.ok(terminal.includes(phrase),"Missing terminal feature: "+phrase);
 }
});

test("terminal identifies source pasted into command prompt without executing it",()=>{
 const items=[
  ["console.log(6*7)","javascript"],
  ["const n:number=6*7; console.log(n);","typescript"],
  ["SELECT 6*7 AS hasil;","sql"],
  ['print("Salam")',"python"],
  ["std::cin >> n; | stdin: 6","cpp"],
  ['#include <iostream>\nint main(){std::cout<<42;}',"cpp"],
  ["<main><h1>AKSARA</h1></main>","html"],
  ["body { color: red; }","css"]
 ];
 for(const [source,language] of items){
  const result=core.classifyInput(source);
  assert.equal(result?.type,"code",source);
  assert.equal(result?.language,language,source);
 }
 const cpp=core.classifyInput("std::cin >> n; | stdin: 6");
 assert.equal(cpp.fragment,true);
 assert.equal(cpp.stdin,"6");
 assert.equal(core.classifyInput("reset → print(x) → exit")?.type,"steps");
 assert.equal(core.classifyInput("rm -rf /"),null);
 assert.equal(core.classifyInput("pip install requests"),null);
 assert.equal(core.command("rm -rf /").type,"invalid");
});
test("safe examples cover 5 executable languages and HTML/CSS",()=>{
 const choices=["python","python-project","javascript","typescript","sql","cpp","html"];
 for(const id of choices){
  const example=core.prepareExample(id,[]);
  assert.ok(example,id);
  assert.ok(core.filesValid(example.files),id);
  assert.ok(example.files.some(f=>f.name===example.primary),id);
  assert.equal(example.files.length,id==="python-project"||id==="html"?2:1);
 }
 const cpp=core.prepareExample("cpp",[]);
 assert.equal(cpp.stdin,"6");
 assert.match(cpp.files[0].code,/int main\(\)/);
 assert.match(cpp.files[0].code,/std::cin/);
 const sql=core.prepareExample("sql",[]);
 assert.match(sql.files[0].code,/SELECT 6 \* 7 AS hasil/);
});
test("examples never overwrite existing project files",()=>{
 const first=core.prepareExample("python-project",[]);
 const second=core.prepareExample("python-project",first.files.map(f=>f.name));
 assert.ok(second);
 assert.ok(second.files.every(f=>!first.files.some(o=>o.name===f.name)));
 assert.match(second.files[0].code,/from demo_utils_2 import answer/);
 assert.ok(core.filesValid(second.files));
 assert.equal(core.prepareExample("does-not-exist",[]),null);
});
test("AI Terminal UI separates prompt commands from source code",()=>{
 const source=read("bilik-antara-ai-terminal.js");
 for(const token of ["aitExampleSelect","aitLoadExample","core.prepareExample","core.classifyInput",
  "aitCodeSuggestion","aitUseSnippet","importSnippet()","suggestCode(","editor atas",
  "candidate?.type===\"steps\"","candidate?.type===\"code\""]){
  assert.ok(source.includes(token),"UI missing "+token);
 }
 assert.ok(!/function importSnippet\(\)[\s\S]{0,1300}engine\.run/.test(source),
  "Pasting source must not silently execute it");
});

test("AI Terminal is a dedicated glass header chip next to Code Engine, not nested in its dialog",()=>{
 const ui=read("bilik-antara-ai-terminal.js");
 const codeStatus=read("bilik-antara-code-status.js");
 const page=read("bilik-antara.html");
 assert.ok(ui.includes('const engineChip=document.getElementById("codeEngineStatus");'));
 assert.ok(ui.includes('engineChip.insertAdjacentElement("afterend",trigger);'));
 assert.ok(ui.includes('trigger.className="code-engine-status ai-terminal-status";'));
 assert.ok(ui.includes('trigger.id="codeAITerminalOpen"'));
 assert.ok(!ui.includes('menu.querySelector(".multi-ai-actions")?.append(trigger)'));
 assert.ok(!codeStatus.includes('codeAITerminalOpen'));
 assert.match(page,/bilik-antara-ai-terminal\.js\?v=4/);
 assert.match(page,/bilik-antara-code-brain\.js\?v=4/);
});
test("terminal's new glass header entry is iconed, accessible, responsive and in sync with runtime",()=>{
 const ui=read("bilik-antara-ai-terminal.js");
 for(const marker of [
  'trigger.setAttribute("aria-haspopup","dialog")',
  'trigger.setAttribute("aria-controls","aksaraAITerminal")',
  'dialog.setAttribute("aria-labelledby","aitTitle")',
  'id="aitTitle"',
  'trigger.setAttribute("aria-expanded","false")',
  'triggerIcon.className="code-engine-core ai-terminal-core"',
  'triggerLabel.textContent="Terminal"',
  'window.addEventListener("aksara:code-runtime-activity"',
  'trigger.dataset.terminalState=state',
  'dialog.addEventListener("close"',
  'dialog.showModal()',
  '@media(max-width:520px)',
  '.conversation-head #codeEngineStatus,.conversation-head #codeAITerminalOpen',
  '.conversation-head #connection{flex:1 1 0!important;min-width:0!important}',
  '@media(prefers-reduced-motion:reduce)'
 ])assert.ok(ui.includes(marker),"Missing glass accessibility/status/mobile contract: "+marker);
 assert.ok(!ui.includes('trigger.textContent="AI Terminal · Patch tersedia"'));
 assert.ok(ui.includes('replBusy=true;$("aitStop").disabled=false;render();paintTrigger();'));
 assert.ok(ui.includes('render();paintTrigger();'));
});
test("AI Terminal still opens its original dialog and keeps every execution safeguard",()=>{
 const ui=read("bilik-antara-ai-terminal.js");
 for(const marker of [
  'const dialog=document.createElement("dialog")',
  'dialog.id="aksaraAITerminal"',
  'core.classifyInput(trimmed)',
  'core.zip(files)',
  'core.unzipStore',
  'window.confirm("Hantar kod',
  'function agentCycle()',
  'core.extractPatch(',
  'function replCommand(',
  'engine.run(f.language,f.code',
  'aitRemember',
  'aitLoadExample',
  'aitImportZIP',
  'trigger.addEventListener("click",openTerminal)'
 ])assert.ok(ui.includes(marker),"Original Terminal workflow missing: "+marker);
 const brain=read("bilik-antara-code-brain.js");
 assert.ok(brain.includes("PINTU MASUK TERMINAL 2.3"));
 assert.ok(brain.includes("Manual, AI Assist dan AI Agent yang berkongsi runtime Code Engine."));
});

test("Terminal header and dialog use the concise name without losing AI modes",()=>{
 const ui=read("bilik-antara-ai-terminal.js");
 for(const s of [
  'triggerLabel.textContent="Terminal"',
  '<strong id="aitTitle">AKSARA Terminal</strong>',
  'aria-label="Tutup Terminal"',
  'Buka Terminal. Status:',
  'Manually', // checked separately below to avoid relying on English mode labels
 ])if(s!=="Manually")assert.ok(ui.includes(s),"Missing Terminal label "+s);
 for(const s of ['data-mode="manual"','data-mode="assist"','data-mode="agent"']){
  assert.ok(ui.includes(s),"Original AI modes missing: "+s);
 }
 const html=read("bilik-antara.html");
 assert.ok(html.includes("bilik-antara-ai-terminal.js?v=5"));
 assert.ok(html.includes("bilik-antara-code-brain.js?v=5"));
});
test("Terminal Liquid Glass groups editor, runtime and project tools while keeping readable output",()=>{
 const ui=read("bilik-antara-ai-terminal.js");
 for(const s of [
  'ait-glass-panel--editor',
  'ait-glass-panel--runtime',
  'ait-glass-panel--tools',
  'Editor Projek',
  'Runtime & Console',
  'Projek & Bantuan A.I.',
  'backdrop-filter:blur(14px)',
  'backdrop-filter:blur(6px)',
  '#aksaraAITerminal #aitEditor',
  '#aksaraAITerminal #aitOutput',
  'background:rgba(3,9,17,.94)',
  'prefers-reduced-motion:reduce'
 ])assert.ok(ui.includes(s),"Missing glass/legibility feature "+s);
});
