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
 assert.ok(html.includes("bilik-antara-ai-terminal.js?v=1"));
 assert.ok(html.includes("bilik-antara-terminal-core.js?v=1"));
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
 const b=read("bilik-antara-brain.js");
 assert.ok(b.includes("const CODE_GUIDANCE="));
 assert.ok(b.includes("CORE,VOICE_GUIDANCE,TEXT_DELIVERY,CODE_GUIDANCE"));
 assert.ok(!b.includes("VOICE_GUIDANCE.push("));
});

test("No stale 80 KB Bilik Antara HTML budget checks remain",()=>{
 const names=fs.readdirSync(__dirname).filter(x=>x.endsWith(".cjs")||x.endsWith(".js"));
 const found=[];
 for(const name of names){
  const content=fs.readFileSync(path.join(__dirname,name),"utf8");
  if(/html\.length\s*<\s*80000|html\.length\s*<=\s*80000|byteLength\(html(?:,\s*"utf8")?\)\s*<\s*80000/.test(content))
   found.push(name);
 }
 assert.deepEqual(found,[], "Legacy 80 KB guards must be migrated to 100 KB");
});
