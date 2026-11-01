/* AKSARA Code Evaluation Lab: user-started eight-case test suite, zero AI requests. */
(function(){
"use strict";
const engine=window.AksaraCodeRuntime;if(!engine?.evaluate)return;
const cases=[
 {name:"JS arithmetic",language:"javascript",source:"console.log(6*7)",outputIncludes:"42"},
 {name:"JS assertion",language:"javascript",source:'console.assert(false,"EXPECTED_FAIL")',expectOk:false,diagnosticCode:"ASSERTION_FAILED"},
 {name:"Python arithmetic",language:"python",source:"print(sum([2,3,5,7]))",outputIncludes:"17"},
 {name:"Python error",language:"python",source:'raise ValueError("EXPECTED_FAIL")',expectOk:false,diagnosticCode:"PYTHON_ERROR"},
 {name:"TypeScript type",language:"typescript",source:"const n:number=6*7;console.log(n)",outputIncludes:"42"},
 {name:"TypeScript type mismatch",language:"typescript",source:'const x:number="wrong";console.log(x)',expectOk:false,diagnosticCode:"TS2322"},
 {name:"SQLite select",language:"sql",source:"SELECT 6+7 AS total;",outputIncludes:"13"},
 {name:"SQLite missing table",language:"sql",source:"SELECT * FROM table_not_found;",expectOk:false,diagnosticCode:"SQLITE_ERROR"}
];
let controller=null,report=null;
const dialog=document.createElement("dialog");
dialog.id="codeEvaluationDialog";dialog.className="multi-ai-dialog code-evaluation-dialog";
dialog.innerHTML=[
 '<div class="multi-ai-head"><div><strong>AKSARA · Code Evaluation Lab</strong><p>8 ujian sebenar untuk empat runtime. Hanya dijalankan apabila kau tekan Uji. Tiada panggilan API AI.</p></div><button type="button" id="codeEvalClose" aria-label="Tutup">×</button></div>',
 '<div class="code-eval-body"><p id="codeEvalState" role="status" aria-live="polite">Sedia untuk 8 ujian.</p><div id="codeEvalResults" aria-label="Keputusan ujian"></div></div>',
 '<div class="multi-ai-actions code-eval-actions"><button type="button" id="codeEvalRun">Jalankan 8 Ujian</button><button type="button" id="codeEvalStop" disabled>Henti</button><button type="button" id="codeEvalExport" disabled>Eksport Laporan</button></div>'
].join("");document.body.appendChild(dialog);
const $=id=>dialog.querySelector("#"+id),state=$("codeEvalState"),results=$("codeEvalResults");
const css=document.createElement("style");
css.textContent=[
'.code-evaluation-dialog .code-eval-body{margin:12px 0;display:grid;gap:8px;max-height:45dvh;overflow-y:auto}',
'.code-evaluation-dialog #codeEvalState{margin:0;font:600 12px "DM Sans",sans-serif;color:#e7d4b6}',
'.code-evaluation-dialog #codeEvalResults{display:grid;gap:6px}',
'.code-evaluation-dialog .code-eval-item{display:flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid rgba(233,205,158,.2);background:rgba(255,255,255,.022);border-radius:9px;padding:9px;font:500 11px/1.4 "DM Sans",sans-serif}',
'.code-evaluation-dialog .code-eval-item[data-passed="true"]{border-color:rgba(127,217,182,.35)}',
'.code-evaluation-dialog .code-eval-item[data-passed="false"]{border-color:rgba(231,160,142,.5)}',
'.code-evaluation-dialog .code-eval-actions{display:flex;flex-wrap:wrap;gap:8px}',
'.code-evaluation-dialog .code-eval-actions button{flex:1 1 95px;padding:10px;border-radius:11px;border:1px solid rgba(233,205,158,.3);background:rgba(255,255,255,.035);color:#f1dfc1;cursor:pointer;font:600 11px "DM Sans",sans-serif}',
'.code-evaluation-dialog .code-eval-actions button:disabled{opacity:.45;cursor:default}'
].join("\n");document.head.appendChild(css);
function item(row){
 const el=document.createElement("div");el.className="code-eval-item";el.dataset.passed=String(row.passed);
 const name=document.createElement("span"),badge=document.createElement("span");
 name.textContent=row.language+" · "+row.name;badge.textContent=row.passed?"LULUS":"GAGAL";
 el.append(name,badge);el.title=(row.error||row.output||"").slice(0,180);results.append(el);
}
function running(value){$("codeEvalRun").disabled=value;$("codeEvalStop").disabled=!value;$("codeEvalExport").disabled=value||!report;}
$("codeEvalRun").addEventListener("click",async()=>{
 if(controller)return;report=null;results.replaceChildren();controller=new AbortController();running(true);
 state.textContent="Menjalankan ujian dalam sandbox…";
 try{
  report=await engine.evaluate(cases,{signal:controller.signal,onResult:(r,i,n)=>{
   item(r);state.textContent="Kemajuan: "+i+"/"+n+" · "+r.language;
  }});
  state.textContent="Keputusan: "+report.passed+"/"+report.total+" lulus · "+report.elapsedMs+" ms";
 }catch(error){state.textContent=String(error?.message||error).slice(0,200);}
 finally{controller=null;running(false);}
});
$("codeEvalStop").addEventListener("click",()=>controller?.abort());
$("codeEvalExport").addEventListener("click",()=>{
 if(!report)return;
 const blob=new Blob([JSON.stringify(report,null,2)],{type:"application/json"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="AKSARA-Code-Evaluation.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$("codeEvalClose").addEventListener("click",()=>dialog.close());
dialog.addEventListener("close",()=>controller?.abort());
dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close();});
window.addEventListener("aksara:code-evaluation-open",()=>{if(!dialog.open)dialog.showModal();});
window.AksaraCodeEvaluation=Object.freeze({version:"1.0",cases:cases.length});
})();
