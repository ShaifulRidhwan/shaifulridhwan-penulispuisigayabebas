/* AKSARA Code Engine v0.1. Runs code in a sandboxed opaque-origin iframe. No AI API. */
(function(root){
"use strict";
const MAX_SOURCE=12000;
function sandboxBootstrap(){
 "use strict";
 const lines=[];
 const say=(id,type,payload)=>parent.postMessage(Object.assign({aksaraCodeV1:true,id,type},payload),"*");
 const add=value=>{if(lines.join("\n").length<10000)lines.push(String(value).slice(0,4000));};
 const repr=x=>{try{return typeof x==="string"?x:JSON.stringify(x)??String(x);}catch(_){return String(x);}};
 window.addEventListener("message",async event=>{
  const job=event.data;
  if(!job||job.type!=="execute"||typeof job.id!=="string")return;
  try{
   let result;
   if(job.language==="javascript"){
    const logger={log:(...a)=>add(a.map(repr).join(" ")),info:(...a)=>add(a.map(repr).join(" ")),warn:(...a)=>add(a.map(repr).join(" ")),error:(...a)=>add(a.map(repr).join(" "))};
    const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
    result=await new AsyncFunction("console",'"use strict";\n'+job.source)(logger);
   }else if(job.language==="python"){
    say(job.id,"loading",{detail:"Memuatkan Python WebAssembly…"});
    await new Promise((resolve,reject)=>{
     const script=document.createElement("script");
     script.src="https://cdn.jsdelivr.net/pyodide/v0.27.8/full/pyodide.js";
     script.onload=resolve;script.onerror=()=>reject(Error("Pyodide CDN tidak dapat dimuatkan."));
     document.head.appendChild(script);
    });
    const py=await loadPyodide({indexURL:"https://cdn.jsdelivr.net/pyodide/v0.27.8/full/"});
    py.setStdout({batched:add});py.setStderr({batched:add});
    result=await py.runPythonAsync(job.source);
   }else throw Error("Bahasa ini belum disokong.");
   if(result!==undefined&&result!==null)add(repr(result));
   say(job.id,"done",{ok:true,output:lines.join("\n")||"(Tiada output)"});
  }catch(error){say(job.id,"done",{ok:false,output:lines.join("\n"),error:String(error?.message||error).slice(0,1800)});}
 },{once:true});
 say("","boot",{});
}
function doc(language){
 const p=language==="python";
 const csp=p?
  "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; connect-src https://cdn.jsdelivr.net; worker-src blob:; img-src 'none'; style-src 'none'; base-uri 'none'; form-action 'none'":
  "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; connect-src 'none'; worker-src 'none'; img-src 'none'; style-src 'none'; base-uri 'none'; form-action 'none'";
 return '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="'+csp+'"></head><body><script>('+sandboxBootstrap.toString()+')();<\/script></body></html>';
}
function run(language,source,options={}){
 return new Promise((resolve,reject)=>{
  if(!["javascript","python"].includes(language)){reject(Error("Runtime belum tersedia."));return;}
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
   options.signal?.removeEventListener("abort",abort);frame.remove();return true;
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
    resolve({ok:data.ok===true,output:String(data.output||"").slice(0,12000),error:String(data.error||"").slice(0,1800),language});
   }
  };
  if(options.signal?.aborted){reject(Error("Pelaksanaan dihentikan."));return;}
  window.addEventListener("message",message);
  options.signal?.addEventListener("abort",abort,{once:true});
  timer=setTimeout(()=>{if(clean())reject(Error("Had masa dicapai. Pelaksanaan dihentikan."));},language==="python"?45000:7000);
  frame.srcdoc=doc(language);document.body.appendChild(frame);
 });
}
async function probe(){
 try{const r=await run("javascript","console.log(6 * 7)");return r.ok&&r.output.trim()==="42";}
 catch(_){return false;}
}
root.AksaraCodeRuntime=Object.freeze({run,probe,available:["javascript","python"],version:"0.1"});
})(window);
