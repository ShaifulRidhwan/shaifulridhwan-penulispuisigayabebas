/* AKSARA Code Engine v0.2. Sandboxed opaque-origin iframe + disposable Web Worker.
 * No AI API; worker prevents tight loops from blocking the chat UI. */
(function(root){
"use strict";
const MAX_SOURCE=12000,MAX_OUTPUT=12000;
function sandboxBootstrap(){
 "use strict";
 function workerEntrypoint(){
  "use strict";
  const lines=[];
  function add(value){
   const total=lines.reduce((n,x)=>n+x.length+1,0);
   if(total<10000)lines.push(String(value).slice(0,Math.min(4000,10000-total)));
  }
  const printable=x=>{try{return typeof x==="string"?x:JSON.stringify(x)??String(x);}catch(_){return String(x);}};
  self.onmessage=async event=>{
   const job=event.data;
   if(!job||typeof job.source!=="string")return;
   try{
    let result;
    if(job.language==="javascript"||job.language==="typescript"){
     let source=job.source;
     if(job.language==="typescript"){
      self.postMessage({type:"loading",detail:"Memuatkan compiler TypeScript…"});
      importScripts("https://cdn.jsdelivr.net/npm/typescript@5.9.3/lib/typescript.js");
      const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None,strict:true},reportDiagnostics:true});
      const errors=(compiled.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error);
      if(errors.length)throw Error(ts.flattenDiagnosticMessageText(errors[0].messageText," "));
      source=compiled.outputText;
     }
     const logger={
      log:(...args)=>add(args.map(printable).join(" ")),
      info:(...args)=>add(args.map(printable).join(" ")),
      warn:(...args)=>add(args.map(printable).join(" ")),
      error:(...args)=>add(args.map(printable).join(" "))
     };
     const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
     result=await new AsyncFunction("console",'"use strict";\n'+source)(logger);
    }else if(job.language==="sql"){
     self.postMessage({type:"loading",detail:"Memuatkan SQLite WebAssembly…"});
     importScripts("https://cdn.jsdelivr.net/npm/sql.js@1.14.2/dist/sql-wasm.js");
     const SQLite=await initSqlJs({locateFile:file=>"https://cdn.jsdelivr.net/npm/sql.js@1.14.2/dist/"+file});
     const db=new SQLite.Database();
     try{
      const results=db.exec(job.source);
      if(!results.length)add("(SQL berjaya. Tiada baris keputusan.)");
      for(const table of results){
       add(table.columns.join(" | "));
       for(const row of table.values.slice(0,100))add(row.map(printable).join(" | "));
       if(table.values.length>100)add("… "+(table.values.length-100)+" baris lagi (terhad).");
      }
     }finally{db.close();}
    }else if(job.language==="python"){
     self.postMessage({type:"loading",detail:"Memuatkan Python WebAssembly…"});
     importScripts("https://cdn.jsdelivr.net/pyodide/v0.27.8/full/pyodide.js");
     const py=await loadPyodide({indexURL:"https://cdn.jsdelivr.net/pyodide/v0.27.8/full/"});
     py.setStdout({batched:add});py.setStderr({batched:add});
     result=await py.runPythonAsync(job.source);
    }else throw Error("Bahasa belum disokong.");
    if(result!==undefined&&result!==null)add(printable(result));
    self.postMessage({type:"done",ok:true,output:lines.join("\n")||"(Tiada output)"});
   }catch(error){
    self.postMessage({type:"done",ok:false,output:lines.join("\n"),error:String(error?.message||error).slice(0,1800)});
   }
  };
 }
 const say=(id,type,payload)=>parent.postMessage(Object.assign({aksaraCodeV1:true,id,type},payload),"*");
 window.addEventListener("message",event=>{
  const job=event.data;
  if(!job||job.type!=="execute"||typeof job.id!=="string")return;
  let worker=null,url=null,settled=false;
  function done(payload){
   if(settled)return;
   settled=true;
   say(job.id,"done",payload);
   if(worker)worker.terminate();
   if(url)URL.revokeObjectURL(url);
  }
  try{
   url=URL.createObjectURL(new Blob(["("+workerEntrypoint.toString()+")();"],{type:"text/javascript"}));
   worker=new Worker(url);
   worker.onmessage=e=>{
    if(e.data?.type==="loading")say(job.id,"loading",{detail:String(e.data.detail||"Memuatkan runtime…").slice(0,90)});
    else if(e.data?.type==="done")done({ok:e.data.ok===true,output:String(e.data.output||"").slice(0,12000),error:String(e.data.error||"").slice(0,1800)});
   };
   worker.onerror=e=>{e.preventDefault();done({ok:false,output:"",error:"Worker runtime gagal. Semak polisi browser atau sambungan CDN."});};
   worker.postMessage({language:job.language,source:job.source});
  }catch(error){done({ok:false,output:"",error:String(error?.message||error).slice(0,1800)});}
 },{once:true});
 say("","boot",{});
}
function documentFor(language){
 const external=["python","typescript","sql"].includes(language);
 // JavaScript: no network; Python: outbound CDN only to load pinned Pyodide assets.
 const csp=external?
  "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net; connect-src https://cdn.jsdelivr.net; worker-src blob:; img-src 'none'; style-src 'none'; base-uri 'none'; form-action 'none'":
  "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; connect-src 'none'; worker-src blob:; img-src 'none'; style-src 'none'; base-uri 'none'; form-action 'none'";
 return '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="'+csp+'"></head><body><script>('+sandboxBootstrap.toString()+')();<\/script></body></html>';
}
function run(language,source,options={}){
 return new Promise((resolve,reject)=>{
  if(!["javascript","python","typescript","sql"].includes(language)){reject(Error("Runtime belum tersedia."));return;}
  if(typeof source!=="string"||!source.trim()){reject(Error("Masukkan kod dahulu."));return;}
  if(source.length>MAX_SOURCE){reject(Error("Kod maksimum 12,000 aksara."));return;}
  const id="code-"+(root.crypto?.randomUUID?.()||Math.random().toString(36).slice(2));
  const frame=document.createElement("iframe");
  frame.setAttribute("sandbox","allow-scripts");
  frame.setAttribute("referrerpolicy","no-referrer");
  frame.setAttribute("aria-hidden","true");
  frame.style.cssText="position:fixed;width:0;height:0;border:0;visibility:hidden;pointer-events:none";
  let finished=false,timer;
  const clean=()=>{
   if(finished)return false;
   finished=true;clearTimeout(timer);
   window.removeEventListener("message",message);
   options.signal?.removeEventListener("abort",abort);
   frame.remove();return true;
  };
  const abort=()=>{if(clean())reject(Error("Pelaksanaan dihentikan."));};
  const message=event=>{
   if(event.source!==frame.contentWindow||event.data?.aksaraCodeV1!==true)return;
   const data=event.data;
   if(data.type==="boot"&&data.id===""){
    frame.contentWindow.postMessage({type:"execute",id,language,source},"*");
   }else if(data.id===id&&data.type==="loading"){
    options.onProgress?.(String(data.detail||"Memuatkan runtime…"));
   }else if(data.id===id&&data.type==="done"&&clean()){
    resolve({ok:data.ok===true,output:String(data.output||"").slice(0,MAX_OUTPUT),error:String(data.error||"").slice(0,1800),language});
   }
  };
  if(options.signal?.aborted){reject(Error("Pelaksanaan dihentikan."));return;}
  window.addEventListener("message",message);
  options.signal?.addEventListener("abort",abort,{once:true});
  timer=setTimeout(()=>{if(clean())reject(Error("Had masa dicapai. Pelaksanaan dihentikan."));},language==="python"?45000:language==="sql"?30000:language==="typescript"?25000:7000);
  frame.srcdoc=documentFor(language);document.body.appendChild(frame);
 });
}
async function probe(){
 try{const r=await run("javascript","console.log(6 * 7)");return r.ok&&r.output.trim()==="42";}
 catch(_){return false;}
}
root.AksaraCodeRuntime=Object.freeze({run,probe,available:["javascript","python","typescript","sql"],version:"0.3"});
})(window);
