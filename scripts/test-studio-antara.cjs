"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const html=fs.readFileSync("studio-antara.html","utf8");
const studioCss=fs.readFileSync("studio-antara.css","utf8");
const docJs=fs.readFileSync("studio-antara.js","utf8");
const imgHtml=fs.readFileSync("studio-imej-beta.html","utf8");
const imgJs=fs.readFileSync("studio-imej-beta.js","utf8");
const manifest=fs.readFileSync("studio-imej-config.js","utf8");
const diagSource=fs.readFileSync("studio-device-diagnostics.js","utf8");
const worker=fs.readFileSync("studio-imej-sw.js","utf8");
const chat=fs.readFileSync("bilik-antara.html","utf8");
const suite=fs.readFileSync("bilik-antara-suite.js","utf8");
const sitemap=fs.readFileSync("sitemap.xml","utf8");

test("Studio has email and PDF/Word only; no heavy image runtime on ordinary page",()=>{
 for(const word of ['data-tab="email"','data-tab="document"','id="emailBody"','id="docPdf"','id="docWord"'])
  assert.ok(html.includes(word),word);
 for(const old of ['data-tab="table"','data-tab="chart"','data-tab="poster"','data-tab="image"',
 'id="tableData"','id="chartData"','id="posterTitle"','studio-imej-beta.js'])
  assert.ok(!html.includes(old),"Removed UI still in Studio: "+old);
 assert.ok(!/createPoster|drawChart|parseCSV|navigator\.gpu/.test(docJs),"Heavy/retired script remains.");
 assert.match(html,/href="studio-imej-beta\.html"/);
 const opens=(html.match(/<section\b/g)||[]).length;
 assert.equal(opens,(html.match(/<\/section>/g)||[]).length);
});
test("email/PDF/Word exports still operate without an extra paid image API",()=>{
 for(const x of ['id="emailEml"','id="emailOpen"','id="docHtml"','id="docPdf"','id="docWord"'])
  assert.match(html,new RegExp(x));
 assert.match(docJs,/message\/rfc822/);
 assert.match(docJs,/mailto:/);
 assert.match(docJs,/window\.print\(\)/);
 assert.match(docJs,/docx@9\.11\.0/);
 assert.match(docJs,/fetch\("\/\.netlify\/functions\/bilik-antara"/);
 assert.doesNotMatch(docJs,/web-txt2img|sd-turbo/);
});
test("print stylesheet keeps the page wrapper visible so PDF is not blank",()=>{
 assert.match(studioCss,/\.site\{display:block!important/);
 assert.doesNotMatch(studioCss,/\.site,\.topbar,\.intro,\.tabs/);
 assert.match(studioCss,/@page\{size:A4/);
});
test("BETA image has a separate page, explicit warning, consent and cache controls",()=>{
 for(const id of ["checkDevice","deviceStatus","deviceDetails","modelConsent","checkCache",
  "prefetchModel","backgroundModel","cancelDownload","clearModel","checkCache","activateModel",
  "generateImage","downloadImage","modelProgress","gpuStatus"]){
  assert.match(imgHtml,new RegExp('id="'+id+'"'),id);
 }
 assert.match(imgHtml,/BETA TEST/g);
 assert.match(imgHtml,/Brave Android/);
 assert.match(imgHtml,/2\.34 GiB/);
 assert.match(imgHtml,/studio-imej-config\.js\?v=1/);
 assert.match(imgHtml,/studio-device-diagnostics\.js\?v=1/);
 assert.match(imgHtml,/id="copyDiagnostic"/);
 assert.ok(imgHtml.indexOf("studio-imej-config.js")<imgHtml.indexOf("studio-imej-beta.js"));
 assert.match(imgJs,/mobile.*Android\|iPhone\|iPad\|iPod/);
 assert.match(imgJs,/if\(mobile\)\{/);
 assert.match(imgJs,/storageNeeded/);
 assert.match(imgJs,/backgroundFetch\.fetch/);
 assert.match(imgJs,/cache\.put\(url,response\)/);
 assert.match(imgJs,/typeof sdk\?\.loadModel/);
 assert.match(imgJs,/sdk\.loadModel/);
});
test("Background Fetch service worker is restricted to model files and doesn't intercept the site",()=>{
 assert.match(worker,/backgroundfetchsuccess/);
 assert.match(worker,/backgroundfetchfail/);
 assert.match(worker,/backgroundfetchabort/);
 assert.match(worker,/record\.responseReady/);
 assert.match(worker,/cache\.put\(record\.request,response\)/);
 assert.match(worker,/C\.isModelFile\(record\.request\.url\)/);
 assert.doesNotMatch(worker,/addEventListener\("fetch"/);
 const C=Function("let self={};let globalThis=self;"+manifest+";return self.StudioImejConfig")();
 assert.equal(C.files.length,3);
 assert.equal(C.cacheName,"web-txt2img-v1");
 assert.ok(C.files.every(x=>x.startsWith("https://huggingface.co/schmuell/sd-turbo-ort-web/resolve/main/")));
 assert.ok(C.modelBytes>2*1024*1024*1024);
 assert.equal(C.isModelFile("https://example.com/secret"),false);
});
test("Bilik Antara links Studio and sitemap includes both separate pages",()=>{
 assert.match(chat,/href="studio-antara\.html"/);
 assert.match(suite,/bilik-antara-studio-transfer-v1/);
 assert.match(sitemap,/studio-antara\.html/);
 assert.match(sitemap,/studio-imej-beta\.html/);
});
function browser(ua,{background=false,desktopGpu=false}={}){
 const handlers=new Map(),nodes=new Map();
 function element(id){
  if(nodes.has(id))return nodes.get(id);
  const obj={id,textContent:"",value:"",checked:false,hidden:false,disabled:true,children:[],style:{},
   addEventListener(event,fn){handlers.set(id+":"+event,fn);},
   replaceChildren(){this.children=[];},
   append(...args){this.children.push(...args);},
   appendChild(x){this.children.push(x);},
   removeAttribute(){},setAttribute(){},classList:{add(){},remove(){},toggle(){}},
   click(){const fn=handlers.get(id+":click");return fn&&fn();}};
  nodes.set(id,obj);return obj;
 }
 const doc={getElementById:element,createElement:tag=>element("anon-"+tag+"-"+Math.random())};
 const C=Function("let self={};"+manifest+";return self.StudioImejConfig")();
 const diagModule={exports:{}};
 new Function("module","window","setTimeout","clearTimeout",diagSource)(diagModule,undefined,setTimeout,clearTimeout);
 const window={StudioImejConfig:C,StudioDeviceDiagnostics:diagModule.exports,isSecureContext:true,addEventListener(){},caches:true};
 const data=new Map(),cache={
  match:async url=>data.get(String(url))||null,
  put:async(url,res)=>{data.set(String(url),res);},
  delete:async url=>data.delete(String(url))
 };
 const caches={open:async()=>cache};
 let network=0,backgroundCalls=0;
 const bg={
  async get(){return null;},
  async fetch(){backgroundCalls++;return {result:"",downloadTotal:C.modelBytes,downloaded:0,addEventListener(){},abort:async()=>true};}
 };
 const navigator={
  userAgent:ua,userAgentData:{mobile:/Android/i.test(ua)},deviceMemory:desktopGpu?16:4,hardwareConcurrency:8,
  storage:{estimate:async()=>({quota:10*1024**3,usage:0}),persist:async()=>true},
  gpu:desktopGpu?{requestAdapter:async()=>({features:new Set(["shader-f16"])})}:undefined,
  serviceWorker:background?{register:async()=>({backgroundFetch:bg}),addEventListener(){}}:undefined
 };
 const fakeFetch=async(url)=>{
  network++;
  return {ok:true,status:200,type:"cors",headers:{get:()=>String(800*1024*1024)}};
 };
 const invoke=new Function("window","document","navigator","caches","fetch","Request","AbortController","confirm","setTimeout","URL","Blob",imgJs);
 invoke(window,doc,navigator,caches,fakeFetch,class{constructor(url){this.url=url;}},class{constructor(){this.signal={aborted:false}}abort(){this.signal.aborted=true}},()=>true,()=>0,URL,Blob);
 return {window,nodes,handlers,C,data,get network(){return network},get backgroundCalls(){return backgroundCalls}};
}
test("browser device metadata is labeled as approximate and never invented",async()=>{
 const diag={exports:{}};
 new Function("module","window","setTimeout","clearTimeout",diagSource)(diag,undefined,setTimeout,clearTimeout);
 const nav={
  userAgent:"Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/130",
  userAgentData:{mobile:true,platform:"Android",
   getHighEntropyValues:async()=>({platform:"Android",platformVersion:"16",model:"Example 12 Pro",fullVersionList:[{brand:"Chromium",version:"130"}]})},
  brave:{isBrave:async()=>true},
  deviceMemory:8,hardwareConcurrency:8,
  storage:{estimate:async()=>({quota:8*1024**3,usage:1*1024**3}),persisted:async()=>false},
  gpu:{requestAdapter:async()=>({info:{description:"GPU yang dilaporkan",architecture:"sample"},
    features:new Set(["shader-f16"]),limits:{maxBufferSize:268435456,maxStorageBufferBindingSize:134217728}})}
 };
 const d=await diag.exports.inspect(nav,{secure:true,minimumStorageBytes:2*1024**3});
 assert.equal(d.platform.os,"Android");
 assert.equal(d.platform.model,"Example 12 Pro");
 assert.equal(d.browser,"Brave");
 assert.equal(d.mobile,true);
 assert.equal(d.gpu.accessible,true,"Android WebGPU adapter must still be probed");
 assert.equal(d.gpu.name,"GPU yang dilaporkan");
 assert.equal(d.memory,8);
 assert.equal(d.storage.remaining,7*1024**3);
 assert.ok(d.notes.some(note=>note.includes("BUKAN ruang fizikal")));
});
test("unknown device metadata stays unknown, not labeled as weak hardware",async()=>{
 const diag={exports:{}};
 new Function("module","window","setTimeout","clearTimeout",diagSource)(diag,undefined,setTimeout,clearTimeout);
 const report=await diag.exports.inspect({userAgent:"GenericBrowser",userAgentData:{mobile:false},
  gpu:{requestAdapter:async()=>null}}, {secure:true,minimumStorageBytes:2*1024**3});
 assert.equal(report.platform.model,diag.exports.UNKNOWN);
 assert.equal(report.memory,null);
 assert.equal(report.storage.remaining,null);
 assert.equal(report.gpu.accessible,false);
 assert.equal(report.platform.os,diag.exports.UNKNOWN);
});
test("Android crash-safe mode refuses heavy foreground model download and GPU",async()=>{
 const b=browser("Mozilla/5.0 (Linux; Android 16) AppleWebKit Brave");
 const status=await b.window.StudioImejBeta.deviceCheck();
 assert.ok(status.mobile);
 assert.ok(!status.gpuAllowed);
 b.nodes.get("modelConsent").checked=true;
 b.handlers.get("modelConsent:change")();
 assert.equal(b.nodes.get("prefetchModel").disabled,true);
 assert.equal(b.nodes.get("activateModel").disabled,true);
 await b.handlers.get("prefetchModel:click")();
 assert.equal(b.network,0,"mobile must not request huge model URLs");
});
test("Desktop prefetch caches whole model files and reuses them without repeating requests",async()=>{
 const b=browser("Mozilla/5.0 (X11; Linux x86_64) Chrome", {desktopGpu:true});
 const status=await b.window.StudioImejBeta.deviceCheck();
 assert.equal(status.gpuAllowed,true);
 b.nodes.get("modelConsent").checked=true;
 b.handlers.get("modelConsent:change")();
 await b.handlers.get("prefetchModel:click")();
 assert.equal(b.network,3);
 assert.equal(b.data.size,3);
 assert.equal(await b.window.StudioImejBeta.cacheCounts(),3);
 await b.handlers.get("prefetchModel:click")();
 assert.equal(b.network,3,"cached assets should not be re-downloaded");
});
test("Background fetch is opt-in and mobile remains GPU-blocked even if available",async()=>{
 const b=browser("Mozilla/5.0 (Linux; Android 16) Brave",{background:true});
 await b.window.StudioImejBeta.deviceCheck();
 assert.equal(b.nodes.get("backgroundModel").disabled,true);
 b.nodes.get("modelConsent").checked=true;
 b.handlers.get("modelConsent:change")();
 assert.equal(b.nodes.get("backgroundModel").disabled,false);
 await b.handlers.get("backgroundModel:click")();
 assert.equal(b.backgroundCalls,1);
 assert.equal(b.nodes.get("activateModel").disabled,true);
 assert.equal(b.network,0,"no normal fetch during background download");
});
