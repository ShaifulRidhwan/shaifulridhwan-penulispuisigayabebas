/* AKSARA AI Code Agent v1. Sandbox only; user-opt-in in current tab only. */
(function(){
"use strict";
const engine=window.AksaraCodeRuntime,chat=window.BilikAntaraBridge;
const menu=document.getElementById("codeEngineMenu");
if(!engine||!chat||!menu)return;
let allowed=false,pending=null,controller=null,running=false,runs=0;
const holder=document.createElement("div");
holder.id="codeAiExecutionGate";
holder.innerHTML='<label class="code-ai-permission"><input type="checkbox" id="codeAiExecutionAllowed"/> <span>Benarkan A.I. jalankan kod dalam sandbox</span></label>'+
 '<p>Tab ini sahaja. A.I. boleh menjalankan satu blok kod apabila kau sendiri meminta ujian kod. Tiada akses terminal pelayan, fail peribadi atau API key.</p>'+
 '<div id="codeAiExecutionState" role="status" aria-live="polite">A.I. Code Execution · OFF</div>'+
 '<button type="button" id="codeAiExecutionStop" hidden>■ Henti pelaksanaan A.I.</button>';
menu.querySelector(".multi-ai-actions")?.before(holder);
const input=holder.querySelector("#codeAiExecutionAllowed"),status=holder.querySelector("#codeAiExecutionState"),stop=holder.querySelector("#codeAiExecutionStop");
const css=document.createElement("style");
css.textContent=[
'.code-engine-dialog #codeAiExecutionGate{border-top:1px solid rgba(228,198,155,.2);margin-top:14px;padding-top:12px;display:grid;gap:8px}',
'.code-engine-dialog .code-ai-permission{display:flex;align-items:center;gap:8px;color:#f0ddbd;font:600 12px/1.45 "DM Sans",sans-serif;cursor:pointer}',
'.code-engine-dialog .code-ai-permission input{width:17px;height:17px;accent-color:#d9b981;flex:none}',
'.code-engine-dialog #codeAiExecutionGate p{font:11px/1.5 "DM Sans",sans-serif;color:#c9c0b2;margin:0}',
'.code-engine-dialog #codeAiExecutionState{font:600 11px "DM Sans",sans-serif;color:#e4c99b}',
'.code-engine-dialog #codeAiExecutionStop{border:1px solid rgba(243,170,158,.42);background:rgba(85,29,31,.3);border-radius:9px;color:#f1b4a6;padding:10px;font:600 11px "DM Sans",sans-serif;cursor:pointer}',
'.code-engine-dialog #codeAiExecutionStop[hidden]{display:none!important}'
].join("\n");document.head.appendChild(css);
const named={javascript:"JavaScript",python:"Python",typescript:"TypeScript",sql:"SQL"};
function extract(reply){
 // Chat style may append emoji after the closing fence. Keep exactly one valid executable block.
 const blocks=[...String(reply||"").matchAll(/(?:^|\n)[ \t]*\x60\x60\x60(javascript|js|typescript|ts|python|py|sql)[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*\x60\x60\x60(?=\s|$)/gi)];
 if(blocks.length!==1)return null;
 const code=blocks[0][2].trim(),map={js:"javascript",ts:"typescript",py:"python"};
 const language=map[blocks[0][1].toLowerCase()]||blocks[0][1].toLowerCase();
 if(!engine.available.includes(language)||!code||code.length>6000)return null;
 return {language,code};
}
function requested(question){
 const q=String(question||"").toLowerCase().slice(0,500);
 return /\b(?:jalankan|laksanakan|run|execute|uji|test|cuba)\b/i.test(q)&&
  /\b(?:kod|code|skrip|script|program|code engine|typescript|javascript|python|sql)\b/i.test(q)&&
  !q.includes("[aksara code bridge]");
}
function setPermission(value){
 allowed=Boolean(value);input.checked=allowed;
 if(!allowed){pending=null;controller?.abort();}
 status.textContent=allowed?"A.I. Code Execution · ARMED":"A.I. Code Execution · OFF";
 window.dispatchEvent(new CustomEvent("aksara:ai-code-permission",{detail:{enabled:allowed,running:false}}));
}
input.addEventListener("change",()=>setPermission(input.checked));
stop.addEventListener("click",()=>{pending=null;controller?.abort();});
window.addEventListener("ba:answered",e=>{
 const d=e.detail||{};pending=null;
 if(!allowed||running||!requested(d.question))return;
 const job=extract(d.answer);
 if(!job){status.textContent="A.I. Execution · Tiada satu blok kod sah ditemui";return;}
 pending=job;status.textContent="A.I. mencadangkan "+named[job.language]+" · sedia jalankan";
});
async function execute(){
 if(!allowed||running||!pending||chat.active())return;
 const job=pending;pending=null;running=true;controller=new AbortController();stop.hidden=false;
 status.textContent="A.I. EXECUTING · "+named[job.language];
 window.dispatchEvent(new CustomEvent("aksara:ai-code-permission",{detail:{enabled:true,running:true,language:job.language}}));
 const overlay=window.AksaraRuntimeOverlay?.open(job.language,()=>controller?.abort())||null;
 let report=null,output="";
 try{
  report=await engine.run(job.language,job.code,{signal:controller.signal,onProgress:t=>{
   status.textContent=named[job.language]+" · "+String(t).slice(0,65);
   overlay?.update(String(t).slice(0,90));
  }});
  const diagnostic=(report.diagnostics||[]).map(d=>String(d.code||"RUNTIME_ERROR")+": "+String(d.message||"").slice(0,260)).join("\n");
  output=named[job.language]+" · A.I. EXECUTION "+(report.ok?"BERJAYA":"RALAT")+
   "\nOUTPUT:\n"+String(report.output||"(Tiada output)").slice(0,8000)+
   (diagnostic?"\nDIAGNOSTIK:\n"+diagnostic:"")+
   (report.error&&!diagnostic?"\nERROR: "+String(report.error).slice(0,600):"")+
   "\nRuntime: "+report.runtimeMs+" ms\nSandbox browser · pelaksanaan tanpa API AI.";
 }catch(error){
  output=named[job.language]+" · A.I. EXECUTION DIHENTIKAN / GAGAL\n"+
   String(error?.message||error).slice(0,500);
 }finally{
  overlay?.close();controller=null;running=false;stop.hidden=true;
  status.textContent=allowed?"A.I. Code Execution · ARMED":"A.I. Code Execution · OFF";
  window.dispatchEvent(new CustomEvent("aksara:ai-code-permission",{detail:{enabled:allowed,running:false}}));
 }
 runs++;
 if(!chat.addLocalCode([{role:"user",content:"[Cadangan A.I. · "+named[job.language]+"]\n"+job.code},
  {role:"assistant",content:output}])){
  status.textContent="Kod selesai tetapi sejarah chat masih sibuk.";return;
 }
 // Result is local until user explicitly chooses the existing Code Bridge share flow.
 if(report)window.dispatchEvent(new CustomEvent("aksara:code-result",{detail:{
  language:job.language,code:job.code,
  report:{ok:report.ok,stdout:String(report.stdout||"").slice(0,8000),
   stderr:String(report.stderr||"").slice(0,4000),error:String(report.error||"").slice(0,1800),
   diagnostics:(report.diagnostics||[]).slice(0,8),runtimeMs:report.runtimeMs,
   truncated:report.truncated===true,limits:report.limits}
 }}));
}
window.addEventListener("ba:ready-for-tools",()=>{if(pending&&!running)void execute();});
window.addEventListener("ba:cleared",()=>setPermission(false));
window.addEventListener("pagehide",()=>{pending=null;controller?.abort();});
window.AksaraAICodeAgent=Object.freeze({version:"1.0",enabled:()=>allowed,running:()=>running,
 runs:()=>runs,extract,isExplicitRequest:requested});
})();
