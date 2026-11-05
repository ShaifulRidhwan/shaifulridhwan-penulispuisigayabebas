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
 assert.ok(html.includes("bilik-antara-ai-terminal.js?v=2"));
 assert.ok(html.includes("bilik-antara-terminal-core.js?v=2"));
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
