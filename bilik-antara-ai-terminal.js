/* AKSARA AI Terminal v2: sandboxed project console, consent-gated AI and code review. */
(function(){
"use strict";
const core=window.AksaraTerminalCore,engine=window.AksaraCodeRuntime,bridge=window.BilikAntaraBridge;
const menu=document.getElementById("codeEngineMenu"),form=document.getElementById("composer");
if(!core||!engine||!bridge||!menu||!form)return;
const trigger=document.createElement("button");trigger.type="button";trigger.id="codeAITerminalOpen";trigger.textContent="AI Terminal · Projek";
menu.querySelector(".multi-ai-actions")?.append(trigger);
const dialog=document.createElement("dialog");dialog.id="aksaraAITerminal";dialog.className="multi-ai-dialog aksara-ai-terminal";
dialog.innerHTML=[
'<div class="multi-ai-head"><div><strong>AKSARA · AI TERMINAL</strong><p>Terminal maya dalam sandbox browser, bukan shell OS atau server.</p></div><button id="aitClose" type="button" aria-label="Tutup AI Terminal">×</button></div>',
'<div class="ait-shell">',
'<div class="ait-row"><strong>Code Intelligence 2.0</strong><small id="aitRuntimeState">Sandbox · on demand</small></div>',
'<div class="ait-modes" role="group" aria-label="Mod terminal"><button data-mode="manual" type="button">Manual</button><button data-mode="assist" type="button">AI Assist</button><button data-mode="agent" type="button">AI Agent</button></div>',
'<div class="ait-row"><label for="aitFile">Fail</label><select id="aitFile"></select><button id="aitAdd" type="button">+ Fail</button><button id="aitDelete" type="button">Buang</button></div>',
'<textarea id="aitEditor" rows="8" spellcheck="false" aria-label="Editor kod projek"></textarea>',
'<div class="ait-row"><button id="aitRun" type="button">▶ Run</button><button id="aitStop" type="button" disabled>■ Stop</button><button id="aitTests" type="button">Uji</button><button id="aitUndo" type="button">Rollback</button><button id="aitWorkspace" type="button">Editor penuh</button><button id="aitPreview" type="button">Live Preview</button></div>',
'<div class="ait-row"><button id="aitRepl" type="button">Python REPL</button><button id="aitAgentCycle" type="button">Uji & baiki · Agent</button><small id="aitReplStatus">Python REPL · OFF</small></div>',
'<div class="ait-row" id="aitStdinWrap" hidden><label for="aitStdin">C++ stdin</label><textarea id="aitStdin" maxlength="4000" rows="2" placeholder="Input untuk std::cin"></textarea></div>',
'<section class="ait-console"><div class="ait-row"><strong>TERMINAL</strong><small id="aitProfile">Belum diuji</small></div><pre id="aitOutput" role="log" aria-live="polite"></pre>',
'<form id="aitCommandForm"><label for="aitCommand">aksara@runtime:~$</label><input id="aitCommand" type="text" maxlength="200" autocomplete="off" spellcheck="false" placeholder="help · ls · run main.py"/><button type="submit">Enter</button></form></section>',
'<section class="ait-patch" id="aitPatchBox" hidden><strong>AI Patch · Semak sebelum guna</strong><pre id="aitDiff"></pre><div class="ait-row"><button id="aitApply" type="button">Gunakan patch</button><button id="aitReject" type="button">Tolak</button></div></section>',
'<div class="ait-row"><button id="aitAI" type="button">Minta A.I. bantu</button><button id="aitExport" type="button">Eksport ZIP</button><button id="aitImportZIP" type="button">Import ZIP</button><input id="aitZipFile" type="file" accept=".zip,application/zip" hidden/><button id="aitImport" type="button">Import Workspace</button><label><input id="aitRemember" type="checkbox"/> Project Memory</label></div>',
'<p id="aitHelp" role="status" aria-live="polite">Kod kekal setempat kecuali kau sahkan penghantaran kepada A.I.</p></div>'
].join("");
document.body.appendChild(dialog);
const css=document.createElement("style");
css.textContent=[
'#aksaraAITerminal{box-sizing:border-box;width:min(740px,calc(100vw - 20px));max-width:740px;max-height:95dvh;overflow:auto;padding:15px;border-radius:18px;background:#0b111d;color:#ecdfcc;border:1px solid rgba(232,205,161,.34)}',
'#aksaraAITerminal::backdrop{background:rgba(0,0,0,.76)}',
'#aksaraAITerminal .ait-shell{display:grid;gap:11px;font:500 12px/1.5 "DM Sans",system-ui,sans-serif}',
'#aksaraAITerminal .ait-row,#aksaraAITerminal .ait-modes{display:flex;align-items:center;gap:7px;flex-wrap:wrap}',
'#aksaraAITerminal .ait-row small{margin-left:auto;color:#b9c1bf}',
'#aksaraAITerminal button,#aksaraAITerminal input,#aksaraAITerminal select,#aksaraAITerminal textarea{background:#111d2d;color:#e9e1d3;border:1px solid rgba(232,205,161,.28);border-radius:9px;font:inherit}',
'#aksaraAITerminal button{padding:8px 11px;cursor:pointer}',
'#aksaraAITerminal button[disabled]{opacity:.48;cursor:default}',
'#aksaraAITerminal button:focus-visible,#aksaraAITerminal input:focus-visible{outline:2px solid #ebc68d;outline-offset:2px}',
'#aksaraAITerminal [data-mode][aria-pressed="true"]{background:#c2dac8;color:#08201c}',
'#aitFile{flex:1;min-width:100px;padding:8px}',
'#aitEditor{box-sizing:border-box;width:100%;min-height:140px;max-height:35dvh;resize:vertical;background:#09121e!important;color:#dde6ea!important;font:12px/1.65 ui-monospace,Consolas,monospace!important;padding:10px}',
'#aksaraAITerminal .ait-console{display:grid;gap:8px;border:1px solid rgba(230,204,159,.25);border-radius:13px;padding:11px;background:#060d17}',
'#aitOutput,#aitDiff{margin:0;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.55 ui-monospace,Consolas,monospace;color:#d9e3db}',
'#aitOutput{min-height:130px;max-height:29dvh}#aitDiff{max-height:190px}',
'#aitCommandForm{display:flex;align-items:center;gap:7px;flex-wrap:wrap}#aitCommandForm label{color:#86d5ac;font:11px ui-monospace,Consolas,monospace}',
'#aitCommand{flex:1;min-width:110px;padding:8px;font:12px ui-monospace,Consolas,monospace!important}',
'#aitPatchBox[hidden],#aitStdinWrap[hidden],#aitZipFile[hidden]{display:none!important}#aitPatchBox{padding:10px;border:1px solid rgba(230,199,138,.4);border-radius:12px}',
'#aitHelp{margin:0;font-size:11px;color:#bfc5c6}',
'@media(max-width:460px){#aksaraAITerminal{padding:9px}#aksaraAITerminal button{padding:8px;font-size:11px}#aitEditor{min-height:110px}}'
].join("");
document.head.appendChild(css);
const $=id=>dialog.querySelector("#"+id),langLabel={python:"Python",javascript:"JavaScript",typescript:"TypeScript",sql:"SQL",cpp:"C++",html:"HTML",css:"CSS"};
let files=[{name:"main.py",language:"python",code:'print("Salam AKSARA Terminal")'}],index=0,mode="assist",controller=null,last=null,pending=null,undo=[],attempts=0,waitingAI=null,commands=[],saveTimer=null,repl=null,replActive=false,replBusy=false,historyCursor=-1;
const dbName="aksara-terminal-v2",storeName="projects",prefKey="aksara-terminal-save-consent";
function message(s){$("aitHelp").textContent=String(s||"").slice(0,360);}
function output(s){const pre=$("aitOutput");pre.textContent=(pre.textContent+"\n"+String(s||"")).slice(-11000);pre.scrollTop=pre.scrollHeight;}
function file(){return files[index];}
function render(){
 $("aitFile").replaceChildren();
 files.forEach((f,i)=>{const o=document.createElement("option");o.value=String(i);o.textContent=f.name;$("aitFile").append(o);});
 $("aitFile").value=String(index);$("aitEditor").value=file().code;
 $("aitUndo").disabled=!undo.length;$("aitRun").disabled=Boolean(controller)||replBusy||!engine.available.includes(file().language);
 $("aitTests").disabled=Boolean(controller)||replBusy;
 $("aitStdinWrap").hidden=file().language!=="cpp";
 $("aitRepl").disabled=file().language!=="python"||replBusy;
 $("aitAgentCycle").disabled=mode!=="agent"||Boolean(controller)||replBusy||!engine.available.includes(file().language);
 $("aitReplStatus").textContent=replActive?"Python REPL · "+(replBusy?"RUNNING":"ON · reset jika ubah fail"):"Python REPL · OFF";
 $("aitPatchBox").hidden=!pending;
 dialog.querySelectorAll("[data-mode]").forEach(x=>x.setAttribute("aria-pressed",String(x.dataset.mode===mode)));
}
function saveCurrent(){file().code=$("aitEditor").value.slice(0,core.MAX_SOURCE);saveLater();}
function add(name,code=""){
 if(!core.filename(name)||typeof code!=="string"||code.length>core.MAX_SOURCE||files.length>=core.MAX_FILES||files.some(f=>f.name.toLowerCase()===name.toLowerCase()))return false;
 saveCurrent();files.push({name,language:core.language(name),code});index=files.length-1;render();saveLater();return true;
}
function idb(){return new Promise((yes,no)=>{
 if(!window.indexedDB){no(Error("IndexedDB unavailable"));return;}
 const req=indexedDB.open(dbName,1);
 req.onupgradeneeded=()=>req.result.createObjectStore(storeName);
 req.onsuccess=()=>yes(req.result);req.onerror=()=>no(req.error||Error("DB failed"));
});}
async function storage(op,value){
 const db=await idb();
 try{return await new Promise((yes,no)=>{
  const tx=db.transaction(storeName,op==="get"?"readonly":"readwrite"),store=tx.objectStore(storeName);
  const req=op==="get"?store.get("default"):op==="delete"?store.delete("default"):store.put(value,"default");
  req.onsuccess=()=>yes(req.result);req.onerror=()=>no(req.error||Error("DB failed"));
 });}finally{db.close();}
}
async function persist(){
 if(!$("aitRemember").checked||!core.filesValid(files))return;
 try{await storage("put",{version:2,files:files.map(x=>({...x})),index,mode,savedAt:Date.now()});}
 catch(e){message("Simpan setempat gagal: "+String(e.message||e).slice(0,100));}
}
function saveLater(){if($("aitRemember").checked){clearTimeout(saveTimer);saveTimer=setTimeout(()=>void persist(),400);}}
async function restore(){
 try{
  const allowed=localStorage.getItem(prefKey)==="yes";$("aitRemember").checked=allowed;if(!allowed)return;
  const saved=await storage("get");
  if(saved?.version===2&&core.filesValid(saved.files)&&saved.files.length){
   files=saved.files;index=Math.max(0,Math.min(files.length-1,Number(saved.index)||0));
   mode=["manual","assist","agent"].includes(saved.mode)?saved.mode:"assist";
   render();output("Project Memory dimuatkan · "+files.length+" fail.");
  }
 }catch(e){message("Project Memory tidak tersedia dalam browser ini.");}
}
function pythonFiles(){return files.filter(f=>f.language==="python"&&/^[A-Za-z][A-Za-z0-9_]{0,59}\.py$/.test(f.name)).map(f=>({name:f.name,code:f.code}));}
function closeRepl(reason="Sesi REPL ditutup."){
 if(repl){repl.stop(reason);repl=null;}
 replActive=false;replBusy=false;render();
}
async function replCommand(source){
 if(replBusy||controller){message("Runtime sedang digunakan.");return;}
 if(!replActive){message("Aktifkan Python REPL dahulu.");return;}
 if(!window.AksaraPythonSession){message("Modul Python REPL belum dimuatkan.");return;}
 try{
  if(!repl)repl=window.AksaraPythonSession.create({files:pythonFiles(),onStatus:state=>$("aitRuntimeState").textContent=state});
  replBusy=true;$("aitStop").disabled=false;render();
  const began=performance.now(),result=await repl.execute(source,{onOutput:(stream,chunk)=>{
   output((stream==="stderr"?"ERR> ":"")+chunk);
  }});
  $("aitProfile").textContent=Math.round(performance.now()-began)+" ms · Python REPL";
  if(!result.stdout&&!result.stderr&&!result.error)output("(Tiada output)");
  if(result.error)output("PYTHON ERROR: "+result.error);
  if(result.truncated)output("Output dipotong mengikut had keselamatan.");
 }catch(error){
  output("Python REPL: "+String(error.message||error).slice(0,350));
  if(repl&&!repl.active()){repl=null;replActive=false;}
 }finally{replBusy=false;$("aitStop").disabled=Boolean(controller);render();}
}
function sourceReport(result){
 const d=(result.diagnostics||[]).map(x=>String(x.code||"RUNTIME_ERROR")+": "+String(x.message||"").slice(0,300)).join("\n");
 return String(result.output||"(Tiada output)").slice(0,6500)+(d?"\nDIAGNOSTIK:\n"+d:"")+(result.error&&!d?"\nERROR: "+result.error:"");
}
async function execute(f,{signal,quiet=false,expect=null}={}){
 if(!engine.available.includes(f.language))throw Error("HTML/CSS perlu Live Preview, bukan console.");
 const ctl=signal||new AbortController();if(!signal){controller=ctl;$("aitStop").disabled=false;$("aitRun").disabled=true;}
 let overlay=null;
 try{
  if(!quiet){output("▶ "+f.name+" ("+f.language+")");overlay=window.AksaraRuntimeOverlay?.open(f.language,()=>ctl.abort())||null;}
  const extra=f.language==="python"?{projectFiles:pythonFiles()}:f.language==="cpp"?{stdin:$("aitStdin").value.slice(0,4000)}:{};
  const result=await engine.run(f.language,f.code,{...extra,signal:ctl.signal,onProgress:x=>{
   if(!quiet){$("aitRuntimeState").textContent=String(x).slice(0,75);overlay?.update(String(x));}
  }});
  if(!quiet){
   const previous=Number(last?.report?.runtimeMs)||null;
   last={name:f.name,language:f.language,code:f.code,report:result};
   output(sourceReport(result));output(result.ok?"[PASS] Runtime berjaya":"[FAIL] Runtime melaporkan ralat");
   $("aitProfile").textContent=result.runtimeMs+" ms · "+new TextEncoder().encode(result.output||"").length+" B output";
   if(previous!==null)output("Beza masa run sebelumnya: "+(result.runtimeMs-previous)+" ms");
   window.dispatchEvent(new CustomEvent("aksara:code-result",{detail:{language:f.language,code:f.code,report:result}}));
  }
  return {ok:result.ok===true&&(expect===null||String(result.output||"").includes(expect)),result};
 }finally{overlay?.close();if(!signal){controller=null;$("aitStop").disabled=true;$("aitRun").disabled=false;$("aitRuntimeState").textContent="Sandbox · ready";}}
}
async function runNamed(name){
 saveCurrent();const f=files.find(x=>x.name===name);
 if(!f){output("Fail tidak ditemui: "+name);return;}
 if(controller||replBusy){message("Runtime masih sibuk.");return;}
 try{return await execute({...f});}catch(e){output("Runtime dihentikan / gagal: "+String(e.message||e).slice(0,500));return null;}
}
async function tests(){
 if(controller||replBusy)return;saveCurrent();const f={...file()};
 const smoke={python:['print(sum([2,3,5,7]))',"17"],javascript:['console.log(6*7)',"42"],
  typescript:['const n:number=6*7;console.log(n)',"42"],sql:['SELECT 6+7 AS total;',"13"],
  cpp:['#include <iostream>\nint main(){std::cout << 42 << "\\n";return 0;}',"42"]}[f.language];
 if(!smoke){message("Ujian console tidak disokong untuk HTML/CSS.");return;}
 controller=new AbortController();$("aitStop").disabled=false;$("aitTests").disabled=true;$("aitRun").disabled=true;
 let pass=0;output("Ujian sebenar (2 kes): runtime smoke + pelaksanaan "+f.name);
 try{
  for(const row of [{name:"Runtime smoke",code:smoke[0],expect:smoke[1]},{name:f.name,code:f.code,expect:null}]){
   const item=await execute({...f,...row},{quiet:true,expect:row.expect,signal:controller});
   pass+=Number(item.ok);output((item.ok?"PASS":"FAIL")+" · "+row.name+" · "+item.result.runtimeMs+" ms"+(item.ok?"":"\n"+sourceReport(item.result).slice(0,700)));
  }
  output("KEPUTUSAN: "+pass+"/2 lulus. Ini smoke test, bukan bukti logik projek sempurna.");
 }catch(e){output("Ujian dihentikan / gagal: "+String(e.message||e).slice(0,400));}
 finally{controller=null;$("aitStop").disabled=true;$("aitTests").disabled=false;$("aitRun").disabled=false;}
}
function command(s){
 const trimmed=String(s||"").trim();
 commands.push(trimmed);commands=commands.slice(-40);historyCursor=-1;
 if(replActive&&!["help","exit","reset","status"].includes(trimmed)){
  output("py>>> "+trimmed);void replCommand(trimmed);return;
 }
 const cmd=core.command(trimmed);
 output("aksara@runtime:~$ "+s);
 switch(cmd.type){
 case "help":output("help, pwd, ls, cat nama.py, run nama.py, python nama.py, node main.js, tsc main.ts, sqlite query.sql, clang main.cpp, tests, history, status, clear, repl, reset, exit. Dalam REPL taip arahan Python terus. Tiada shell sebenar.");break;
 case "pwd":output("/aksara/project");break;
 case "ls":output(files.map(x=>x.name).join("  "));break;
 case "cat":output(files.find(x=>x.name===cmd.name)?.code||"Fail tidak ditemui.");break;
 case "run":void runNamed(cmd.name);break;
 case "tests":void tests();break;
 case "status":output("Runtime: "+engine.available.join(", ")+"; mod: "+mode+"; fail: "+files.length);break;
 case "history":output(commands.map((x,i)=>(i+1)+". "+x).join("\n"));break;
 case "clear":$("aitOutput").textContent="";break;
 case "repl":
  if(file().language!=="python"){message("Pilih fail .py untuk Python REPL.");break;}
  replActive=true;render();output("Python REPL aktif. Taip Python terus, contohnya x=6 kemudian print(x*7). reset untuk kosongkan state, exit untuk keluar.");break;
 case "reset":
  if(repl)repl.stop("Python REPL direset.");
  repl=null;replActive=true;replBusy=false;render();output("Sesi Python direset. Pemboleh ubah lama sudah tiada.");break;
 case "exit":
  closeRepl();output("Keluar daripada Python REPL.");break;
 default:output(cmd.message||"Arahan tak disokong.");
 }
}
function propose(job){
 const f=file();
 if(!job||job.language!==f.language||!job.code||job.code.length>core.MAX_SOURCE){message("Jawapan A.I. tidak mengandungi satu blok patch yang jelas.");return;}
 pending={name:f.name,before:f.code,after:job.code};
 $("aitDiff").textContent=core.diff(pending.before,pending.after);
 $("aitPatchBox").hidden=false;message("Patch tersedia untuk semakan. Belum digunakan atau dijalankan.");
}
async function agentCycle(){
 if(mode!=="agent"){message("Pilih mod AI Agent untuk Uji & baiki.");return;}
 if(controller||replBusy||waitingAI){message("Tugas lain masih berjalan.");return;}
 if(pending){message("Semak dan terima/tolak patch yang masih menunggu dahulu.");return;}
 saveCurrent();
 const result=await runNamed(file().name);
 if(!result)return;
 if(result.ok){output("AGENT · Runtime lulus. Semak hasil dan ujian fungsi sebelum anggap lengkap.");return;}
 if(attempts>=3){message("Had 3 cubaan AI Agent telah dicapai.");return;}
 output("AGENT · Runtime gagal. Seterusnya minta cadangan patch A.I. dengan izin kau.");
 askAI();
}
function askAI(){
 saveCurrent();
 if(mode==="manual"){message("Pilih AI Assist atau AI Agent.");return;}
 if(bridge.active()||waitingAI){message("Permintaan A.I. lain masih aktif.");return;}
 const f=file();
 if(!engine.available.includes(f.language)){message("HTML/CSS boleh disemak melalui Live Preview dan Code Workspace.");return;}
 if(mode==="agent"&&attempts>=3){message("Had tiga cubaan patch dicapai. Tukar mod atau Rollback untuk mula semula.");return;}
 const attempt=mode==="agent"?attempts+1:0;
 const prompt=core.aiPrompt({mode,attempt,language:f.language,code:f.code,
  report:last?.name===f.name&&last.code===f.code?last.report:null,thoughtMode:bridge.snapshot?.().thoughtMode||"cahaya",
  task:mode==="agent"?"Diagnosis dan patch ralat sebenar serta edge case":"Semak kod dan cadangkan pembaikan"});
 if(!window.confirm("Hantar kod dan diagnostik ditapis kepada A.I.? Semak sendiri dahulu supaya tiada rahsia atau kunci API."))return;
 if(mode==="agent")attempts++;
 waitingAI={name:f.name,language:f.language,source:f.code};
 dialog.close();bridge.fill(prompt);form.requestSubmit();
 message("Permintaan dihantar melalui chat. Tunggu cadangan patch untuk semakan.");
}
trigger.addEventListener("click",()=>{if(menu.open)menu.close();trigger.textContent="AI Terminal · Projek";dialog.showModal();$("aitCommand").focus();});
$("aitClose").addEventListener("click",()=>dialog.close());
dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close();});
dialog.querySelectorAll("[data-mode]").forEach(b=>b.addEventListener("click",()=>{mode=b.dataset.mode;attempts=0;render();saveLater();}));
$("aitFile").addEventListener("change",()=>{saveCurrent();index=Number($("aitFile").value)||0;render();});
$("aitEditor").addEventListener("input",()=>{saveCurrent();pending=null;$("aitPatchBox").hidden=true;});
$("aitAdd").addEventListener("click",()=>{
 const name=window.prompt("Fail baharu: .py, .js, .ts, .sql, .cpp, .html atau .css","script.py");
 if(name!==null&&!add(name.trim()))message("Fail tidak sah, pendua atau maksimum 12 fail.");
});
$("aitDelete").addEventListener("click",()=>{
 if(files.length<=1){message("Minimum satu fail.");return;}
 if(!window.confirm("Buang fail "+file().name+" daripada projek terminal?"))return;
 files.splice(index,1);index=Math.min(index,files.length-1);render();saveLater();
});
$("aitRun").addEventListener("click",()=>void runNamed(file().name));
$("aitStop").addEventListener("click",()=>{controller?.abort();if(replBusy)closeRepl("Python REPL dihentikan melalui Stop.");});
$("aitTests").addEventListener("click",()=>void tests());
$("aitUndo").addEventListener("click",()=>{
 const previous=undo.pop();if(!previous)return;
 const pos=files.findIndex(x=>x.name===previous.name);if(pos<0)return;
 files[pos].code=previous.code;index=pos;pending=null;render();saveLater();output("Rollback "+previous.name);
});
$("aitApply").addEventListener("click",()=>{
 if(!pending||file().name!==pending.name||file().code!==pending.before){pending=null;render();message("Patch tidak lagi sepadan dengan kod semasa. Minta A.I. analisis semula.");return;}
 undo.push({name:file().name,code:file().code});undo=undo.slice(-15);
 file().code=pending.after;pending=null;render();saveLater();output("Patch digunakan. Tekan Run untuk mengesahkan.");
});
$("aitReject").addEventListener("click",()=>{pending=null;render();message("Patch ditolak.");});
$("aitWorkspace").addEventListener("click",()=>{
 saveCurrent();
 const ok=window.AksaraCodeWorkspace?.receiveFile?.({...file()});
 if(!ok)message("Editor tidak dapat membuka fail. Semak had 12 fail.");
 else message("Fail diimport dan dibuka dalam Code Workspace.");
});
$("aitAI").addEventListener("click",askAI);
$("aitAgentCycle").addEventListener("click",()=>void agentCycle());
$("aitRepl").addEventListener("click",()=>{
 if(file().language!=="python")return;
 if(replActive)closeRepl();
 else{replActive=true;render();output("Python REPL aktif. Cuba x=6 kemudian print(x*7).");}
});
$("aitPreview").addEventListener("click",()=>{
 saveCurrent();
 const selected=file(),html=selected.language==="html"?selected:files.find(f=>f.language==="html");
 if(!html){message("Tambah fail HTML dahulu. Live Preview hanya untuk HTML/CSS.");return;}
 const workspace=window.AksaraCodeWorkspace;
 if(!workspace?.receiveFile){message("Code Workspace tidak tersedia.");return;}
 let imported=0;
 for(const item of [html,...files.filter(f=>f.language==="css")]){
  imported+=Number(workspace.receiveFile({...item}));
 }
 message(imported+" fail dipindah sebagai salinan ke Workspace Live Preview tanpa JavaScript.");
});
$("aitCommand").addEventListener("keydown",event=>{
 if(event.key!=="ArrowUp"&&event.key!=="ArrowDown")return;
 if(!commands.length)return;
 event.preventDefault();
 historyCursor=event.key==="ArrowUp"?Math.min(commands.length-1,historyCursor+1):Math.max(-1,historyCursor-1);
 $("aitCommand").value=historyCursor<0?"":commands[commands.length-1-historyCursor];
});
$("aitCommandForm").addEventListener("submit",e=>{e.preventDefault();const value=$("aitCommand").value;$("aitCommand").value="";command(value);});
$("aitExport").addEventListener("click",()=>{
 saveCurrent();
 try{
  const bytes=core.zip(files),url=URL.createObjectURL(new Blob([bytes],{type:"application/zip"})),a=document.createElement("a");
  a.href=url;a.download="AKSARA-Project.zip";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  message(files.length+" fail dieksport sebagai ZIP setempat.");
 }catch(e){message("ZIP gagal: "+String(e.message||e).slice(0,160));}
});
$("aitImportZIP").addEventListener("click",()=>$("aitZipFile").click());
$("aitZipFile").addEventListener("change",async()=>{
 const fileToImport=$("aitZipFile").files?.[0];$("aitZipFile").value="";
 if(!fileToImport)return;
 if(fileToImport.size>256000){message("ZIP projek melebihi 256 KB.");return;}
 try{
  const loaded=core.unzipStore(await fileToImport.arrayBuffer());
  if(controller||replBusy){message("Hentikan pelaksanaan sebelum mengimport projek.");return;}
  if(!window.confirm("Gantikan projek terminal dengan "+loaded.length+" fail daripada ZIP ini? Projek semasa akan diganti."))return;
  closeRepl();files=loaded;index=0;pending=null;undo=[];last=null;attempts=0;
  render();saveLater();message("ZIP projek disahkan dan diimport: "+loaded.length+" fail.");
 }catch(error){message("ZIP ditolak: "+String(error.message||error).slice(0,220));}
});
$("aitImport").addEventListener("click",()=>{
 const items=window.AksaraCodeWorkspace?.snapshot?.();
 if(!Array.isArray(items)){message("Workspace belum tersedia.");return;}
 let added=0;for(const item of items)if(add(item.name,item.code))added++;
 message(added+" fail diimport. Pendua tidak ditimpa.");
});
$("aitRemember").addEventListener("change",async()=>{
 const on=$("aitRemember").checked;
 try{localStorage.setItem(prefKey,on?"yes":"no");}catch(_){}
 if(on){await persist();message("Project Memory aktif. Projek disimpan pada browser ini sahaja.");}
 else{clearTimeout(saveTimer);try{await storage("delete");}catch(_){}message("Project Memory OFF. Rekod projek setempat dipadam.");}
});
window.addEventListener("ba:answered",e=>{
 if(!waitingAI)return;
 const target=waitingAI;waitingAI=null;
 const job=core.extractPatch(String(e.detail?.answer||""),target.language);
 const pos=files.findIndex(x=>x.name===target.name&&x.language===target.language);
 if(pos>=0&&job?.language===target.language&&files[pos].code===target.source){index=pos;render();propose(job);output("Cadangan patch A.I. diterima, belum dilaksanakan. Buka semula AI Terminal untuk menyemak diff.");trigger.textContent="AI Terminal · Patch tersedia";}
 else if(pos>=0&&files[pos].code!==target.source){message("Kod berubah semasa A.I. menjawab. Patch lama ditolak bagi melindungi perubahan baharu.");}
 else message("Respons A.I. bukan satu blok patch kod yang sah. Semak jawapan di chat.");
});
window.addEventListener("ba:request-failed",()=>{if(waitingAI){waitingAI=null;message("Permintaan A.I. gagal. Kod asal kekal.");}});
window.addEventListener("ba:cleared",()=>{waitingAI=null;controller?.abort();});
window.addEventListener("pagehide",()=>{controller?.abort();clearTimeout(saveTimer);});
window.AksaraAITerminal=Object.freeze({
 version:"2.0",open:()=>{if(!dialog.open)dialog.showModal();},
 capabilityPrompt:q=>/\b(?:kod|code|coding|program|python|javascript|typescript|sql|cpp|c\+\+|compiler|runtime|debug|terminal|script|skrip)\b/i.test(String(q||""))?core.capability(engine.available):"",
 state:()=>({mode,files:files.length,hasRun:Boolean(last),pendingPatch:Boolean(pending),projectMemory:$("aitRemember").checked})
});
render();$("aitOutput").textContent="AKSARA AI Terminal 2.0\nTaip help untuk arahan. Runtime berada dalam sandbox.";
void restore();
})();
