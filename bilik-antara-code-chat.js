/* AKSARA Code Intent Router: detect locally, never auto-execute, never call AI. */
(function(){
"use strict";
const engine=window.AksaraCodeRuntime,bridge=window.BilikAntaraBridge;
const form=document.getElementById("composer"),input=document.getElementById("input");
const area=document.querySelector(".conversation .composer-area");
if(!engine||!bridge||!form||!input||!area)return;
let selected=null,executing=false,controller=null,allowAISendOnce=false;
const action=document.createElement("div");
action.id="codeActionBar";action.className="code-action-bar";action.hidden=true;
const desc=document.createElement("span");desc.id="codeActionText";desc.textContent="Kod dikesan";
const run=document.createElement("button");run.type="button";run.id="codeRunAction";run.textContent="▶ Jalankan Kod";
const sendAI=document.createElement("button");sendAI.type="button";sendAI.id="codeSendAI";sendAI.textContent="Hantar ke AI";sendAI.hidden=true;
const stop=document.createElement("button");stop.type="button";stop.id="codeStopAction";stop.textContent="■ Henti";stop.hidden=true;
action.append(desc,run,sendAI,stop);
form.before(action);
const styles=document.createElement("style");
styles.textContent=[
'.code-action-bar[hidden]{display:none!important}',
'.conversation .code-action-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;box-sizing:border-box;min-height:32px;padding:3px 10px 7px;color:#e6dac7;font:500 11px/1.35 "DM Sans",system-ui,sans-serif}',
'.code-action-bar span{margin-right:auto;min-width:90px;color:#bed0d9}',
'.conversation .code-action-bar button{font:600 11px/1.35 "DM Sans",system-ui,sans-serif;padding:7px 12px;border-radius:999px;border:1px solid rgba(229,202,157,.4);color:#f3dfb5;background:rgba(48,56,67,.44);cursor:pointer}',
'.conversation .code-action-bar button:focus-visible{outline:2px solid #f0cf90;outline-offset:2px}',
'.conversation .code-action-bar button:disabled{opacity:.5;cursor:default}',
'.conversation .code-action-bar button[hidden]{display:none!important}',
'.conversation .code-engine-message .byline{color:#8ad3b4}',
'.conversation .code-engine-message .bubble{white-space:pre-wrap;overflow-wrap:anywhere;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;line-height:1.6}',
'@media(max-width:420px){.conversation .code-action-bar{font-size:10px;padding-inline:9px}.conversation .code-action-bar button{font-size:10px;padding:6px 9px}}'
].join("\n");document.head.appendChild(styles);
const langName=l=>({javascript:"JavaScript",python:"Python",typescript:"TypeScript",sql:"SQL"})[l]||"Code";
function detect(source){
 const full=String(source||"").trim();
 if(!full||full.length>12000)return null;
 // Only an entire fenced block is treated as executable; explanatory prose is ordinary chat.
 const fenced=/^```(javascript|js|python|py|typescript|ts|sql)\s*\n([\s\S]*?)\n```$/i.exec(full);
 if(fenced){
  const token=fenced[1].toLowerCase();
  const language=/^(py|python)$/.test(token)?"python":/^(ts|typescript)$/.test(token)?"typescript":token==="sql"?"sql":"javascript";
  return fenced[2].trim()?{language,code:fenced[2].trim(),format:"fenced"}:null;
 }
 if(/^```/.test(full))return null;
 const js=/\b(?:console\.(?:log|warn|error|info)\s*\(|(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=|function\s+[A-Za-z_$][\w$]*\s*\(|(?:=>\s*[{(]?)|throw\s+new\s+Error\s*\()/m;
 const py=/^(?:\s*(?:print\s*\(|def\s+[a-zA-Z_]\w*\s*\(|for\s+[a-zA-Z_]\w*\s+in\s+(?:range\(|\w+)|from\s+[a-zA-Z_]\w*\s+import\s+|import\s+[a-zA-Z_]\w*|class\s+[a-zA-Z_]\w*\s*:|if\s+__name__\s*==|while\s+\S+:\s*$))/m;
 const isSql=/^(?:SELECT|WITH|CREATE\s+TABLE|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/i.test(full);
 const isTs=/\b(?:interface\s+\w+|type\s+\w+\s*=|(?:const|let|var)\s+\w+\s*:\s*[A-Za-z]|function\s+\w+\s*\([^)]*:\s*[A-Za-z])/m.test(full);
 const isJs=js.test(full),isPy=py.test(full);
 if(isSql)return {language:"sql",code:full,format:"raw"};
 if(isTs)return {language:"typescript",code:full,format:"raw"};
 if(isJs===isPy)return null;
 return {language:isPy?"python":"javascript",code:full,format:"raw"};
}
function candidate(){
 const raw=input.value.trim();if(!raw||raw.length>12000)return null;
 const found=detect(raw);
 if(selected&&!raw.startsWith("```"))return {language:selected,code:raw,format:"manual"};
 if(found)return found;
 return null;
}
let confirmSend=false;
function refresh(){
 if(executing){action.hidden=false;desc.textContent="Code Engine sedang menjalankan kod…";run.hidden=true;sendAI.hidden=true;stop.hidden=false;return;}
 const found=candidate();
 action.hidden=!found;
 run.hidden=false;stop.hidden=true;sendAI.hidden=!confirmSend;
 if(!found){confirmSend=false;return;}
 desc.textContent=confirmSend?"Kod dikesan. Pilih tindakan:":langName(found.language)+" dikesan · tanpa AI";
 run.textContent="▶ Jalankan Kod";run.disabled=bridge.active();
}
input.addEventListener("input",()=>{confirmSend=false;refresh();});
window.addEventListener("aksara:code-language",event=>{
 const language=event.detail?.language;
 if(!engine.available.includes(language))return;
 selected=language;confirmSend=false;refresh();
});
form.addEventListener("submit",event=>{
 if(allowAISendOnce){allowAISendOnce=false;return;}
 if(executing){event.preventDefault();event.stopImmediatePropagation();return;}
 if(bridge.active())return;
 // Detect executable syntax, but never interpret ordinary chat text as a command.
 if(detect(input.value)&&document.getElementById("removeAttachment")?.hidden!==false){
  event.preventDefault();event.stopImmediatePropagation();confirmSend=true;refresh();
 }
},true);
sendAI.addEventListener("click",()=>{
 if(executing||bridge.active())return;
 allowAISendOnce=true;confirmSend=false;refresh();form.requestSubmit();
});
stop.addEventListener("click",()=>controller?.abort());
run.addEventListener("click",async()=>{
 const found=candidate();
 if(!found||executing||bridge.active())return;
 const source=input.value.trim(),started=performance.now();
 controller=new AbortController();executing=true;refresh();
 const session=window.AksaraRuntimeOverlay?.open(found.language,()=>controller?.abort())||null;
 session?.update("Menjalankan kod dalam sandbox…");
 let answer,executeTime=0,structuredReport=null;
 try{
  const result=await engine.run(found.language,found.code,{signal:controller.signal,onProgress:detail=>{
   desc.textContent=String(detail||"Memuatkan runtime…").slice(0,90);
   session?.update(String(detail||"Memuatkan runtime…"));
  }});
  executeTime=Math.round(performance.now()-started);
  structuredReport={ok:result.ok===true,stdout:String(result.stdout||"").slice(0,8000),
   stderr:String(result.stderr||"").slice(0,4000),error:String(result.error||"").slice(0,1800),
   diagnostics:(result.diagnostics||[]).slice(0,8).map(d=>({
    severity:String(d.severity||"error").slice(0,16),code:String(d.code||"").slice(0,35),
    message:String(d.message||"").slice(0,450),
    ...(Number.isInteger(d.line)&&d.line>0?{line:d.line}:{}),
    ...(Number.isInteger(d.column)&&d.column>0?{column:d.column}:{})
   })),
   truncated:result.truncated===true,limits:result.limits||{},runtimeMs:result.runtimeMs||0};
  session?.update(result.ok?"Menyusun output…":"Memeriksa ralat runtime…");
  // A cinematic minimum of 3 s never delays genuine execution or a user abort.
  const remain=Math.max(0,3000-(performance.now()-started));
  if(remain)await new Promise((resolve,reject)=>{
   if(controller.signal.aborted){reject(Error("Pelaksanaan dihentikan."));return;}
   const abort=()=>{clearTimeout(timer);reject(Error("Pelaksanaan dihentikan."));};
   const timer=setTimeout(()=>{controller.signal.removeEventListener("abort",abort);resolve();},remain);
   controller.signal.addEventListener("abort",abort,{once:true});
  });
  const header=langName(found.language)+" · "+(result.ok?"BERJAYA":"RALAT");
  const messages=(result.diagnostics||[]).map(d=>
   (d.line?"Baris "+d.line+(d.column?", kolum "+d.column:"")+" · ":"")+
   String(d.code||"RUNTIME_ERROR")+": "+String(d.message||"Ralat tidak dikenali").slice(0,450));
  answer=header+"\nOUTPUT:\n"+(result.output||"(Tiada output)")+
   (messages.length?"\nDIAGNOSTIK:\n"+messages.join("\n"):"")+
   (result.error&&!messages.length?"\nERROR: "+result.error:"")+
   (result.truncated?"\nNota: output telah dihadkan untuk kestabilan.":"")+
   "\nTempoh runtime: "+result.runtimeMs+" ms"+
   "\nHad: "+result.limits.maxSource+" aksara kod · "+(result.limits.timeoutMs/1000)+"s maksimum"+
   "\nDilaksanakan dalam sandbox setempat tanpa API AI.";
 }catch(error){
  answer=langName(found.language)+" · RUNTIME DIHENTIKAN / GAGAL\n"+String(error?.message||error).slice(0,500)+"\nTiada API AI digunakan.";
 }finally{session?.close();}
 // Chat history stores local results but omits them from any future AI context/summary.
 if(bridge.addLocalCode([{role:"user",content:source},{role:"assistant",content:answer}])){
  // Runtime results stay local unless the user explicitly approves AI sharing later.
  window.dispatchEvent(new CustomEvent("aksara:code-result",{detail:{
   language:found.language,code:found.code,
   report:structuredReport||{ok:false,error:answer.slice(0,550),diagnostics:[],stdout:"",stderr:"",runtimeMs:executeTime}
  }}));
  if(input.value.trim()===source){input.value="";input.dispatchEvent(new Event("input",{bubbles:true}));}
 }
 controller=null;executing=false;selected=null;confirmSend=false;refresh();
});
refresh();
window.AksaraCodeChat=Object.freeze({detect,selectedLanguage:()=>selected,isRunning:()=>executing});
})();
