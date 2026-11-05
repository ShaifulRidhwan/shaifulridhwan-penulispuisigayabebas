/* AKSARA Python REPL: persistent Pyodide worker inside an opaque-origin iframe.
 * Lazy-loaded on explicit user interaction. No OS shell, API tokens or arbitrary network. */
(function(root){
"use strict";
const MAX_CODE=12000,MAX_FILES=12,MAX_PROJECT=48000,MAX_OUTPUT=10000;
function validFiles(files){
 return Array.isArray(files)&&files.length<=MAX_FILES&&
  files.reduce((n,f)=>n+String(f.code||"").length,0)<=MAX_PROJECT&&
  files.every(f=>f&&/^[A-Za-z][A-Za-z0-9_]{0,59}\.py$/.test(f.name)&&
   typeof f.code==="string"&&f.code.length<=MAX_CODE)&&
  new Set(files.map(f=>f.name.toLowerCase())).size===files.length;
}
function isolated(){
 "use strict";
 function pythonWorker(){
  "use strict";
  let py=null,loaded=false,config=[];
  const LIMIT=10000;
  const toString=x=>{try{return typeof x==="string"?x:String(x);}catch(_){return "[output tidak tersedia]";}};
  function send(type,id,data){self.postMessage({type,id,...data});}
  self.onmessage=async e=>{
   const job=e.data||{},id=job.id;
   if(job.type!=="execute"||typeof id!=="number")return;
   let stdout="",stderr="",truncated=false;
   function emit(type,value){
    const valueText=toString(value),used=stdout.length+stderr.length,room=Math.max(0,LIMIT-used);
    const piece=valueText.slice(0,room);
    if(valueText.length>room)truncated=true;
    if(type==="stdout")stdout+=(stdout?"\n":"")+piece;
    else stderr+=(stderr?"\n":"")+piece;
    send("chunk",id,{stream:type,text:piece.slice(0,1500)});
   }
   try{
    if(!loaded){
     send("status",id,{message:"Memuatkan Python Pyodide WebAssembly…"});
     importScripts("https://cdn.jsdelivr.net/pyodide/v0.27.8/full/pyodide.js");
     py=await loadPyodide({indexURL:"https://cdn.jsdelivr.net/pyodide/v0.27.8/full/"});
     config=Array.isArray(job.files)?job.files:[];
     for(const f of config){
      if(!/^[A-Za-z][A-Za-z0-9_]{0,59}\.py$/.test(f.name)||typeof f.code!=="string")continue;
      py.FS.writeFile(py.FS.cwd()+"/"+f.name,f.code,{encoding:"utf8"});
     }
     await py.runPythonAsync("import sys, os\nsys.path.insert(0, os.getcwd())");
     loaded=true;
     send("status",id,{message:"Python REPL sedia · sesi berterusan"});
    }
    py.setStdout({batched:x=>emit("stdout",x)});
    py.setStderr({batched:x=>emit("stderr",x)});
    const result=await py.runPythonAsync(job.code);
    if(result!==undefined&&result!==null)emit("stdout",result);
    send("done",id,{ok:true,stdout,stderr,truncated});
   }catch(error){
    const msg=toString(error?.message||error).slice(0,1100);
    send("done",id,{ok:false,stdout,stderr,error:msg,truncated});
   }
  };
 }
 const workerSource="("+pythonWorker.toString()+")();";
 const url=URL.createObjectURL(new Blob([workerSource],{type:"text/javascript"}));
 const worker=new Worker(url);
 worker.onmessage=e=>parent.postMessage({aksaraPythonSession:true,...e.data},"*");
 worker.onerror=e=>{e.preventDefault();parent.postMessage({aksaraPythonSession:true,type:"worker-error",error:"Worker Python gagal."},"*");};
 window.addEventListener("message",e=>{
  if(e.source!==parent||e.data?.aksaraPythonSession!==true||e.data.type!=="execute")return;
  worker.postMessage({type:"execute",id:e.data.id,code:e.data.code,files:e.data.files});
 });
 parent.postMessage({aksaraPythonSession:true,type:"ready"},"*");
}
function documentFor(){
 const csp="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net; connect-src https://cdn.jsdelivr.net; worker-src blob:; img-src 'none'; style-src 'none'; base-uri 'none'; form-action 'none'";
 return '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="'+csp+'"></head><body><script>('+isolated.toString()+')();<\/script></body></html>';
}
function create({files=[],onStatus=()=>{}}={}){
 if(!validFiles(files))throw Error("Fail Python projek tidak sah (maksimum 12 fail, 48,000 aksara).");
 let active=true,ready=false,pending=null,sequence=0,bootTimer=null;
 let resolveReady,rejectReady;
 const boot=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
 const frame=document.createElement("iframe");
 frame.setAttribute("sandbox","allow-scripts");
 frame.setAttribute("referrerpolicy","no-referrer");
 frame.setAttribute("aria-hidden","true");
 frame.style.cssText="position:fixed;width:0;height:0;border:0;visibility:hidden;pointer-events:none";
 const handler=event=>{
  if(!active||event.source!==frame.contentWindow||event.data?.aksaraPythonSession!==true)return;
  const data=event.data;
  if(data.type==="ready"){ready=true;clearTimeout(bootTimer);resolveReady();return;}
  if(data.type==="worker-error"){stop(String(data.error||"Worker gagal."));return;}
  if(!pending||pending.id!==data.id)return;
  if(data.type==="status"){onStatus(String(data.message||"").slice(0,100));return;}
  if(data.type==="chunk"){pending.onOutput?.(data.stream,String(data.text||"").slice(0,1500));return;}
  if(data.type==="done"){
   const job=pending;pending=null;clearTimeout(job.timer);
   job.resolve({ok:data.ok===true,stdout:String(data.stdout||"").slice(0,MAX_OUTPUT),
    stderr:String(data.stderr||"").slice(0,MAX_OUTPUT),error:String(data.error||"").slice(0,1200),truncated:data.truncated===true});
  }
 };
 function stop(reason="Sesi Python dihentikan."){
  if(!active)return;
  active=false;clearTimeout(bootTimer);root.removeEventListener("message",handler);
  frame.remove();
  if(!ready)rejectReady(Error(reason));
  if(pending){const job=pending;pending=null;clearTimeout(job.timer);job.reject(Error(reason));}
 }
 root.addEventListener("message",handler);
 bootTimer=setTimeout(()=>stop("Python REPL gagal dimulakan."),12000);
 frame.srcdoc=documentFor();document.body.appendChild(frame);
 async function execute(source,{onOutput=()=>{}}={}){
  const code=String(source||"");
  if(!active)throw Error("Sesi Python telah ditutup.");
  if(!code.trim()||code.length>MAX_CODE)throw Error("Kod Python mesti 1 hingga 12,000 aksara.");
  if(pending)throw Error("Sesi Python masih menjalankan kod.");
  await boot;
  if(!active)throw Error("Sesi Python telah ditutup.");
  const id=++sequence;
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>stop("Had masa Python REPL (75 saat) dicapai."),75000);
   pending={id,resolve,reject,onOutput,timer};
   frame.contentWindow.postMessage({aksaraPythonSession:true,type:"execute",id,code,files},"*");
  });
 }
 return Object.freeze({execute,stop,close:()=>stop("Sesi Python ditutup."),active:()=>active,busy:()=>Boolean(pending)});
}
const api=Object.freeze({version:"1.0",create,validFiles,MAX_FILES,MAX_PROJECT});
if(typeof module!=="undefined"&&module.exports)module.exports=api;
if(root)root.AksaraPythonSession=api;
})(typeof window!=="undefined"?window:null);
