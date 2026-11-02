/* AKSARA Code Engine v0.3 · five executable runtimes, one guarded execution contract.
 * Isolated opaque-origin iframe + disposable worker. No AI endpoint.
 * User execution remains explicit in bilik-antara-code-chat.js. */
(function(root){
"use strict";
const MAX_SOURCE=12000,MAX_OUTPUT=12000;
const LANGUAGES=Object.freeze(["javascript","python","typescript","sql","cpp"]);
const TIMEOUTS=Object.freeze({javascript:7000,python:45000,typescript:25000,sql:30000,cpp:180000});
function sandboxBootstrap(){
 "use strict";
 function workerEntrypoint(){
  "use strict";
  const stdout=[],stderr=[],diagnostics=[];
  const MAX_CAPTURE=10000,MAX_LINES=180,MAX_ROWS=100,MAX_STMTS=25;
  let length=0,lines=0,truncated=false;
  const printable=x=>{
   try{
    if(typeof x==="string")return x;
    if(x===undefined)return "undefined";
    if(x instanceof Error)return x.name+": "+x.message;
    return JSON.stringify(x)??String(x);
   }catch(_){try{return String(x);}catch(__){return "[Tidak boleh dipaparkan]";}}
  };
  function emit(type,value){
   if(truncated)return;
   const str=String(value);
   const remaining=MAX_CAPTURE-length;
   if(remaining<=0||lines>=MAX_LINES){truncated=true;return;}
   const text=str.slice(0,Math.min(4000,remaining));
   (type==="stderr"?stderr:stdout).push(text);
   length+=text.length+1;lines++;
   if(text.length<str.length)truncated=true;
  }
  const add=x=>emit("stdout",x);
  function report(error,language){
   const message=String(error?.message||error).slice(0,1400);
   const stack=String(error?.stack||"");
   let line=null,column=null;
   const tsLine=/^(?:.+):(\d+):(\d+)/.exec(message);
   const pythonLine=/(?:File "<exec>"|File "<string>"), line (\d+)/.exec(stack+" "+message);
   const jsLine=/aksara-(?:snippet|typescript)\.js:(\d+):(\d+)/.exec(stack);
   if(language==="python"&&pythonLine)line=Number(pythonLine[1]);
   else if(jsLine){line=Math.max(1,Number(jsLine[1])-3);column=Number(jsLine[2]);}
   else if(tsLine){line=Number(tsLine[1]);column=Number(tsLine[2]);}
   const record={severity:"error",code:language==="sql"?"SQLITE_ERROR":language==="python"?"PYTHON_ERROR":"RUNTIME_ERROR",message};
   if(Number.isInteger(line)&&line>0)record.line=line;
   if(Number.isInteger(column)&&column>0)record.column=column;
   diagnostics.push(record);
   return message;
  }
  function finish(ok,error){
   const output=[...stdout,...stderr].join("\n")+(truncated?"\n… Output dipotong pada had keselamatan.":"");
   self.postMessage({type:"done",ok,stdout:stdout.join("\n"),stderr:stderr.join("\n"),output:output||(ok?"(Tiada output)":""),error:error||"",diagnostics:diagnostics.slice(0,8),truncated,
    limits:{maxOutput:MAX_CAPTURE,maxLines:MAX_LINES,maxRows:MAX_ROWS,maxStatements:MAX_STMTS}});
  }
  function compileTypeScript(code){
   self.postMessage({type:"loading",detail:"Memuatkan TypeScript dan menyemak jenis data…"});
   importScripts("https://cdn.jsdelivr.net/npm/typescript@5.9.3/lib/typescript.js");
   const virtualFile="/snippet.ts",libFile="/aksara-lib.d.ts";
   const miniLib=[
    "interface Object {}","interface Function {}","interface CallableFunction extends Function {}",
    "interface NewableFunction extends Function {}","interface IArguments {length:number; [index:number]:any;}",
    "interface String {length:number;}","interface Number {}","interface Boolean {}","interface RegExp {}",
    "interface Array<T> {length:number; [index:number]:T; map<U>(fn:(value:T,index:number)=>U):U[]; reduce(fn:(previous:T,current:T)=>T):T; reduce<U>(fn:(previous:U,current:T)=>U,initial:U):U; push(...items:T[]):number;}",
    "interface ReadonlyArray<T> {readonly length:number; readonly [index:number]:T;}",
    "declare const console:{log(...values:any[]):void;info(...values:any[]):void;warn(...values:any[]):void;error(...values:any[]):void;table(value:any):void;assert(condition:any,...values:any[]):void;time(label?:string):void;timeEnd(label?:string):void;};",
    "declare const Math:{[name:string]:any};","declare const JSON:{stringify(value:any):string;parse(value:string):any;};"
   ].join("\n");
   const options={noLib:true,strict:true,target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None,noEmit:true,skipLibCheck:true};
   const files=new Map([[virtualFile,code],[libFile,miniLib]]);
   const host={
    getSourceFile:(file,version)=>files.has(file)?ts.createSourceFile(file,files.get(file),version,true):undefined,
    getDefaultLibFileName:()=>libFile,
    writeFile:()=>{},
    getCurrentDirectory:()=>"/",
    getDirectories:()=>[],
    fileExists:file=>files.has(file),
    readFile:file=>files.get(file),
    useCaseSensitiveFileNames:()=>true,
    getCanonicalFileName:file=>file,
    getNewLine:()=>"\n",
    directoryExists:()=>true
   };
   const program=ts.createProgram([virtualFile,libFile],options,host);
   const errors=ts.getPreEmitDiagnostics(program).filter(d=>d.category===ts.DiagnosticCategory.Error&&d.file?.fileName===virtualFile);
   // Transpilation is deliberately single-file. Bare import/require is not supported.
   const compiled=ts.transpileModule(code,{fileName:virtualFile,compilerOptions:{
    target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None,isolatedModules:true},reportDiagnostics:true});
   errors.push(...(compiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error));
   if(errors.length){
    for(const d of errors.slice(0,8)){
     const pos=d.file&&typeof d.start==="number"?d.file.getLineAndCharacterOfPosition(d.start):null;
     diagnostics.push({severity:"error",code:"TS"+d.code,
      message:ts.flattenDiagnosticMessageText(d.messageText," ").slice(0,450),
      ...(pos?{line:pos.line+1,column:pos.character+1}:{})});
    }
    const first=diagnostics[0];
    throw Error((first.line?"Baris "+first.line+", kolum "+first.column+": ":"")+first.code+" "+first.message);
   }
   return compiled.outputText;
  }
  self.onmessage=async event=>{
   const job=event.data;
   if(!job||typeof job.source!=="string")return;
   const lang=job.language,started=Date.now();
   try{
    let result,assertionFailures=0;
    if(lang==="javascript"||lang==="typescript"){
     const code=lang==="typescript"?compileTypeScript(job.source):job.source;
     const clocks=new Map();
     const logger={
      assert:(condition,...args)=>{
       if(condition)return;
       const message=args.length?args.map(printable).join(" "):"Assertion failed";
       emit("stderr",message);assertionFailures++;
       if(diagnostics.length<8)diagnostics.push({severity:"error",code:"ASSERTION_FAILED",message:message.slice(0,450)});
      },
      time:(label="default")=>{clocks.set(String(label).slice(0,80),performance.now());},
      timeEnd:(label="default")=>{
       const name=String(label).slice(0,80),start=clocks.get(name);
       if(start===undefined){emit("stderr","Timer tidak dijumpai: "+name);return;}
       add(name+": "+(performance.now()-start).toFixed(2)+" ms");clocks.delete(name);
      },
      log:(...args)=>add(args.map(printable).join(" ")),
      info:(...args)=>add(args.map(printable).join(" ")),
      warn:(...args)=>emit("stderr",args.map(printable).join(" ")),
      error:(...args)=>emit("stderr",args.map(printable).join(" ")),
      table:value=>{
       if(Array.isArray(value)){
        value.slice(0,MAX_ROWS).forEach((v,i)=>add(i+": "+printable(v)));
        if(value.length>MAX_ROWS)add("… Baris seterusnya tidak dipaparkan.");
       }else add(printable(value));
      }
     };
     const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
     result=await new AsyncFunction("console",'"use strict";\n'+code+"\n//# sourceURL=aksara-snippet.js")(logger);
    }else if(lang==="sql"){
     self.postMessage({type:"loading",detail:"Memuatkan SQLite dan memproses arahan…"});
     importScripts("https://cdn.jsdelivr.net/npm/sql.js@1.14.2/dist/sql-wasm.js");
     const SQLite=await initSqlJs({locateFile:file=>"https://cdn.jsdelivr.net/npm/sql.js@1.14.2/dist/"+file});
     const db=new SQLite.Database();
     let statementCount=0,results=0;
     try{
      // Prepare statements incrementally; never materialize unbounded result tables.
      for(const statement of db.iterateStatements(job.source)){
       if(++statementCount>MAX_STMTS)throw Error("Maksimum "+MAX_STMTS+" pernyataan SQL bagi satu pelaksanaan.");
       if(job.sqlParams!==undefined){
        if(statementCount!==1)throw Error("Parameter SQL hanya disokong bagi satu pernyataan.");
        statement.bind(job.sqlParams);
       }
       const columns=statement.getColumnNames();
       if(columns.length){
        results++;add(columns.join(" | "));
        let count=0;
        while(statement.step()){
         if(count++>=MAX_ROWS){add("… Paparan dihadkan kepada "+MAX_ROWS+" baris.");break;}
         add(statement.get().map(printable).join(" | "));
        }
       }else{
        statement.step();
        const affected=db.getRowsModified();
        if(affected>0)add("Rows affected: "+affected);
       }
      }
      if(!statementCount)add("(Tiada pernyataan SQL ditemui.)");
      else if(!results&&!stdout.length)add("SQL berjaya · "+statementCount+" pernyataan.");
     }finally{db.close();}
    }else if(lang==="cpp"){
     // Clang 22 + WASI: real, browser-only C++20 compilation and execution.
     // Isolated disposable worker. The compiler and its assets load only on request.
     const base="https://cdn.jsdelivr.net/npm/@live-codes/clang-wasm@0.3.0/";
     self.postMessage({type:"loading",detail:"Memuatkan Clang C++20 WebAssembly (~29 MB)…"});
     importScripts(base+"dist/clang-wasm.global.js");
     if(!self.clangWasm?.createCompiler)throw Error("Compiler Clang C++ tidak tersedia. Semak CDN.");
     const compiler=await self.clangWasm.createCompiler("cpp",{
      baseUrl:base+"assets/",std:"gnu++20",
      onProgress:progress=>{
       const pct=Math.max(0,Math.min(100,Math.round(Number(progress)*100)||0));
       self.postMessage({type:"loading",detail:"Memuatkan compiler Clang… "+pct+"%"});
      }
     });
     try{
      self.postMessage({type:"loading",detail:"Mengkompil dan menjalankan C++20 dalam WASI…"});
      const compilation=await compiler.run(job.source,String(job.stdin||""));
      if(compilation.stdout)emit("stdout",compilation.stdout);
      if(compilation.stderr)emit("stderr",compilation.stderr);
      const failures=Array.isArray(compilation.errors)?compilation.errors:[];
      for(const entry of failures.slice(0,8)){
       const message=String(entry).slice(0,450);
       const found=/main\.cpp:(\d+):(\d+):\s*(?:fatal\s+)?error:\s*(.+)/.exec(message);
       diagnostics.push({severity:"error",code:"CPP_COMPILE_ERROR",message,
        ...(found?{line:Number(found[1]),column:Number(found[2])}:{})});
      }
      if(compilation.exitCode===null||compilation.exitCode!==0){
       const problem=failures.length?failures[0]:"Program keluar dengan kod "+compilation.exitCode+".";
       if(!diagnostics.length)diagnostics.push({severity:"error",code:"CPP_RUNTIME_ERROR",message:String(problem).slice(0,450)});
       finish(false,String(problem).slice(0,1400));
       return;
      }
     }finally{compiler.dispose();}
    }else if(lang==="python"){
     self.postMessage({type:"loading",detail:"Memuatkan Python WebAssembly…"});
     importScripts("https://cdn.jsdelivr.net/pyodide/v0.27.8/full/pyodide.js");
     const py=await loadPyodide({indexURL:"https://cdn.jsdelivr.net/pyodide/v0.27.8/full/"});
     py.setStdout({batched:add});
     py.setStderr({batched:message=>emit("stderr",message)});
     result=await py.runPythonAsync(job.source);
    }else throw Error("Bahasa belum disokong.");
    if(result!==undefined&&result!==null)add(printable(result));
    if(assertionFailures){finish(false,assertionFailures+" ujian assert gagal.");return;}
    finish(true,"");
   }catch(error){
    const message=diagnostics.length?String(error?.message||error).slice(0,1400):report(error,lang);
    finish(false,message);
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
    else if(e.data?.type==="done")done({
     ok:e.data.ok===true,output:String(e.data.output||"").slice(0,12000),
     stdout:String(e.data.stdout||"").slice(0,12000),stderr:String(e.data.stderr||"").slice(0,12000),
     error:String(e.data.error||"").slice(0,1800),diagnostics:Array.isArray(e.data.diagnostics)?e.data.diagnostics.slice(0,8):[],
     truncated:e.data.truncated===true,limits:e.data.limits||{}
    });
   };
   worker.onerror=e=>{e.preventDefault();done({ok:false,output:"",error:"Worker runtime gagal. Semak polisi browser atau sambungan CDN.",diagnostics:[]});};
   worker.postMessage({language:job.language,source:job.source,sqlParams:job.sqlParams});
  }catch(error){done({ok:false,output:"",error:String(error?.message||error).slice(0,1800),diagnostics:[]});}
 },{once:true});
 say("","boot",{});
}
function documentFor(language){
 const external=language!=="javascript";
 // Opaque origin, worker lifecycle and strict CDN scope. No app tokens/AI credentials.
 const csp=external?
  "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net; connect-src https://cdn.jsdelivr.net; worker-src blob:; img-src 'none'; style-src 'none'; base-uri 'none'; form-action 'none'":
  "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; connect-src 'none'; worker-src blob:; img-src 'none'; style-src 'none'; base-uri 'none'; form-action 'none'";
 return '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="'+csp+'"></head><body><script>('+sandboxBootstrap.toString()+')();<\/script></body></html>';
}
function run(language,source,options={}){
 return new Promise((resolve,reject)=>{
  if(!LANGUAGES.includes(language)){reject(Error("Runtime belum tersedia."));return;}
  if(typeof source!=="string"||!source.trim()){reject(Error("Masukkan kod dahulu."));return;}
  if(source.length>MAX_SOURCE){reject(Error("Kod maksimum "+MAX_SOURCE+" aksara."));return;}
  let sqlParams;
  if(options.sqlParams!==undefined){
   const params=options.sqlParams;
   if(language!=="sql"||!Array.isArray(params)||params.length>16||
      params.some(x=>x!==null&&typeof x!=="string"&&!(typeof x==="number"&&Number.isFinite(x)))||
      JSON.stringify(params).length>4000){
     reject(Error("Parameter SQL mesti array maksimum 16 nilai ringkas."));return;
   }
   sqlParams=params;
  }
  const id="code-"+(root.crypto?.randomUUID?.()||Math.random().toString(36).slice(2));
  const frame=document.createElement("iframe");
  frame.setAttribute("sandbox","allow-scripts");
  frame.setAttribute("referrerpolicy","no-referrer");
  frame.setAttribute("aria-hidden","true");
  frame.style.cssText="position:fixed;width:0;height:0;border:0;visibility:hidden;pointer-events:none";
  let finished=false,timer,started=performance.now();
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
    frame.contentWindow.postMessage({type:"execute",id,language,source,sqlParams},"*");
   }else if(data.id===id&&data.type==="loading"){
    options.onProgress?.(String(data.detail||"Memuatkan runtime…"));
   }else if(data.id===id&&data.type==="done"&&clean()){
    resolve({
     ok:data.ok===true,output:String(data.output||"").slice(0,MAX_OUTPUT),
     stdout:String(data.stdout||"").slice(0,MAX_OUTPUT),stderr:String(data.stderr||"").slice(0,MAX_OUTPUT),
     error:String(data.error||"").slice(0,1800),diagnostics:Array.isArray(data.diagnostics)?data.diagnostics.slice(0,8):[],
     truncated:data.truncated===true,limits:Object.freeze(Object.assign({},data.limits||{}, {maxSource:MAX_SOURCE,timeoutMs:TIMEOUTS[language]})),
     runtimeMs:Math.round(performance.now()-started),language
    });
   }
  };
  if(options.signal?.aborted){reject(Error("Pelaksanaan dihentikan."));return;}
  window.addEventListener("message",message);
  options.signal?.addEventListener("abort",abort,{once:true});
  timer=setTimeout(()=>{if(clean())reject(Error("Had masa dicapai. Pelaksanaan dihentikan."));},TIMEOUTS[language]);
  frame.srcdoc=documentFor(language);document.body.appendChild(frame);
 });
}
const SMOKES=Object.freeze({
 javascript:{source:"console.log(6 * 7)",expected:"42"},
 python:{source:"print(sum([2,3,5,7]))",expected:"17"},
 typescript:{source:"const n: number=6*7; console.log(n)",expected:"42"},
 sql:{source:"SELECT 6+7 AS total;",expected:"total\n13"},
 cpp:{source:'#include <iostream>\nint main(){ std::cout << 6*7 << std::endl; }',expected:"42"}
});
async function probeLanguage(language,{signal}={}){
 const spec=SMOKES[language];
 if(!spec)return {language,ready:false,error:"Runtime belum disokong."};
 try{
  const r=await run(language,spec.source,{signal});
  return {language,ready:r.ok===true&&r.output.trim()===spec.expected,
    runtimeMs:r.runtimeMs,diagnostics:r.diagnostics};
 }catch(e){return {language,ready:false,error:String(e?.message||e).slice(0,200)};}
}
async function probe(){return (await probeLanguage("javascript")).ready;}
async function evaluate(cases,{signal,onResult}={}){
 if(!Array.isArray(cases)||cases.length<1||cases.length>24)throw Error("Gunakan 1 hingga 24 kes ujian.");
 const started=performance.now(),items=[];
 for(const item of cases){
  if(signal?.aborted)throw Error("Penilaian dihentikan.");
  if(!item||!LANGUAGES.includes(item.language)||typeof item.source!=="string")throw Error("Kes ujian tidak sah.");
  let result;
  try{result=await run(item.language,item.source,{signal});}
  catch(e){if(signal?.aborted)throw e;result={ok:false,output:"",error:String(e?.message||e),diagnostics:[],runtimeMs:0};}
  const expectedOk=item.expectOk!==false;
  const expectedOutput=typeof item.outputIncludes==="string"?item.outputIncludes:null;
  const expectedCode=typeof item.diagnosticCode==="string"?item.diagnosticCode:null;
  const passed=result.ok===expectedOk&&(!expectedOutput||(result.output||"").includes(expectedOutput))&&
   (!expectedCode||(result.diagnostics||[]).some(d=>d.code===expectedCode));
  const record=Object.freeze({name:String(item.name||"Ujian "+(items.length+1)).slice(0,90),language:item.language,
   passed,ok:result.ok,output:String(result.output||"").slice(0,1000),
   error:String(result.error||"").slice(0,300),runtimeMs:result.runtimeMs||0,
   diagnostics:(result.diagnostics||[]).slice(0,3)});
  items.push(record);onResult?.(record,items.length,cases.length);
 }
 return Object.freeze({version:"1.0",total:items.length,passed:items.filter(x=>x.passed).length,
  failed:items.filter(x=>!x.passed).length,elapsedMs:Math.round(performance.now()-started),results:Object.freeze(items)});
}
root.AksaraCodeRuntime=Object.freeze({run,probe,probeLanguage,evaluate,available:LANGUAGES,version:"0.6",limits:Object.freeze({maxSource:MAX_SOURCE,maxOutput:MAX_OUTPUT,timeouts:TIMEOUTS})});
})(window);
