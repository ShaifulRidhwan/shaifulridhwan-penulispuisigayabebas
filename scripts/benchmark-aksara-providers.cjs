"use strict";
/*
 * AKSARA Provider A/B Lab
 * Same synthetic Malaysian-Malay questions, system guidance and conversation history.
 * Defaults to OFFLINE self-test. --live requires both API keys in environment.
 * No visitor histories, PII, or secrets enter benchmark prompts or reports.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const PROVIDERS=Object.freeze({
  orcarouter:{url:"https://api.orcarouter.ai/v1/chat/completions",model:"orcarouter/free",env:"ORCAROUTER_API_KEY"},
  openrouter:{url:"https://openrouter.ai/api/v1/chat/completions",model:"openrouter/free",env:"OPENROUTER_API_KEY"}
});
const SYSTEM=[
  "Kau Aksara A.I., assistant yang menggunakan Bahasa Melayu Malaysia santai.",
  "Gunakan aku/kau jika sesuai. Elakkan Bahasa Indonesia sebagai dialek default.",
  "English technical terms seperti API, backend, fallback dan context boleh dikekalkan apabila relevan.",
  "Jawab tepat, tidak mereka fakta, jangan dakwa model atau tools yang tidak digunakan.",
  "CAHAYA ialah gaya santai dan praktikal. GELAP ialah gaya kritis berfalsafah, tetapi tetap hormat.",
  "Jangan mengaku mempunyai hubungan atau perasaan manusia."
].join(" ");
const CASES=Object.freeze([
 {id:"bahasa",topic:"Naturalness BM Malaysia",
  prompt:"Kenapa orang boleh overthink apabila mesej tak berbalas? Terangkan secara santai dalam tiga ayat, tanpa membuat andaian palsu.",
  anchors:[]},
 {id:"falsafah",topic:"Falsafah",
  prompt:"Apa maksud aporia dalam falsafah? Bezakan kebuntuan intelektual daripada kejahilan. Jawab dalam Bahasa Melayu Malaysia.",
  anchors:[/aporia|jalan buntu|kebuntuan/i,/tahu|soalan|pertanyaan|persoalan|pengetahuan/i]},
 {id:"sains",topic:"Sains",
  prompt:"Jelaskan hubungan entropi dan arah masa. Bagaimana hukum kedua termodinamik terpakai untuk sistem terasing? Elakkan mendakwa semua sistem mesti meningkat entropinya.",
  anchors:[/entropi/i,/hukum kedua|sistem terasing|sistem tertutup|isolated|termodinamik/i]},
 {id:"coding",topic:"Coding",
  prompt:"Kod JavaScript: const x = null; console.log(x.name); Apa yang berlaku dan betulkan menggunakan optional chaining? Jelaskan ringkas.",
  anchors:[/typeerror|cannot read|ralat|error/i,/\?\./]},
 {id:"context",topic:"Multi-turn context",
  history:[
   {role:"user",content:"Dalam AKSARA, pilihan pertama ialah simpan memori pada server. Pilihan kedua ialah kekalkan memori setempat dalam browser menggunakan IndexedDB."},
   {role:"assistant",content:"Pilihan kedua ialah IndexedDB di browser; ia membantu kawalan data setempat."}
  ],
  prompt:"Apa pilihan kedua tadi? Terangkan satu kelebihannya.",
  anchors:[/indexeddb/i,/browser|pelayar|local|setempat|privasi|peranti|offline/i]},
 {id:"identiti",topic:"Identiti dan mode",
  prompt:"Kau siapa? Bezakan CAHAYA dengan GELAP dan terangkan apa itu AI routing dalam AKSARA. Jawab santai.",
  anchors:[/aksara/i,/cahaya/i,/gelap/i,/routing|pilih|provider|model/i]}
]);
const INDO_MARKERS=/\b(?:nggak|enggak|banget|gimana|makasih|dong|sih|kayaknya|gue|lu)\b/gi;
function assess(text,caseItem){
 const value=String(text||"");
 const markers=[...value.matchAll(INDO_MARKERS)].map(x=>x[0].toLowerCase());
 const anchorHits=(caseItem.anchors||[]).map(re=>re.test(value));
 return {indonesianMarkers:[...new Set(markers)],anchorHits,anchorCoverage:anchorHits.length?anchorHits.filter(Boolean).length/anchorHits.length:null,
  hasResponse:value.trim().length>=12};
}
function parseAnswer(json){
 const choice=json&&Array.isArray(json.choices)?json.choices[0]:null;
 const raw=choice&&choice.message&&choice.message.content;
 const text=typeof raw==="string"?raw:Array.isArray(raw)?raw.map(x=>typeof x==="string"?x:x&&x.text||"").join(""):"";
 if(!text.trim())throw new Error("EMPTY_RESPONSE");
 return {text:text.trim(),model:typeof json.model==="string"?json.model:"unreported"};
}
function safeError(error){
 if(error&&error.name==="AbortError")return "timeout";
 if(error&&/^HTTP_(?:4\d\d|5\d\d)$/.test(error.message))return error.message;
 return "transport_or_response_error";
}
async function callProvider(provider,caseItem,{key,fetchImpl=fetch,timeoutMs=15000}={}){
 const spec=PROVIDERS[provider];if(!spec||!key)throw new Error("MISSING_PROVIDER_CONFIG");
 const messages=[{role:"system",content:SYSTEM},...(caseItem.history||[]),{role:"user",content:caseItem.prompt}];
 const start=Date.now();
 const controller=new AbortController();
 const watchdog=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await fetchImpl(spec.url,{
   method:"POST",signal:controller.signal,
   headers:{"Content-Type":"application/json","Authorization":"Bearer "+key,
    "HTTP-Referer":"https://shaifulridhwan-penulispuisigayabebas.netlify.app",
    "X-Title":"AKSARA Provider A/B Lab"},
   body:JSON.stringify({model:spec.model,messages,max_tokens:550,stream:false})
  });
  if(!response.ok)throw new Error("HTTP_"+response.status);
  const parsed=parseAnswer(await response.json());
  return {provider,caseId:caseItem.id,model:parsed.model,latencyMs:Date.now()-start,
   response:parsed.text,...assess(parsed.text,caseItem)};
 }finally{clearTimeout(watchdog);}
}
function summarize(rows){
 const report={date:new Date().toISOString(),mode:"live",modelSelection:"free dynamic routers",
  warning:"Keyword checks and Indonesian-marker hints are NOT a full assessment of answer quality or native-language naturalness.",
  results:rows,providers:{}};
 for(const provider of Object.keys(PROVIDERS)){
  const values=rows.filter(x=>x.provider===provider);
  const good=values.filter(x=>!x.error);
  const times=good.map(x=>x.latencyMs).sort((a,b)=>a-b);
  const covered=good.filter(x=>x.anchorCoverage!==null);
  report.providers[provider]={requests:values.length,successes:good.length,errors:values.length-good.length,
   medianLatencyMs:times.length?times[Math.floor((times.length-1)/2)]:null,
   indonesiaMarkerResponses:good.filter(x=>x.indonesianMarkers.length).length,
   keywordCoverage:covered.length?Number((covered.reduce((s,x)=>s+x.anchorCoverage,0)/covered.length).toFixed(2)):null,
   actualModels:[...new Set(good.map(x=>x.model))]};
 }
 return report;
}
function selfTest(){
 assert.equal(assess("Aku faham. Itu memang mengganggu fikiran.",CASES[0]).indonesianMarkers.length,0);
 assert.deepEqual(assess("Aku nggak tahu, kayaknya begitu banget.",CASES[0]).indonesianMarkers,["nggak","kayaknya","banget"]);
 assert.equal(assess("TypeError. Guna x?.name.",CASES[3]).anchorCoverage,1);
 assert.equal(assess("Pilihan kedua ialah IndexedDB dalam browser.",CASES[4]).anchorCoverage,1);
 assert.equal(parseAnswer({model:"demo",choices:[{message:{content:"Jawapan ujian"}}]}).model,"demo");
 const r=summarize([{provider:"orcarouter",model:"mock",latencyMs:100,response:"Aku Aksara.",indonesianMarkers:[],anchorCoverage:null},
  {provider:"openrouter",error:"HTTP_429"}]);
 assert.equal(r.providers.orcarouter.successes,1);
 assert.equal(r.providers.openrouter.errors,1);
 assert.equal(CASES.length,6);
 console.log("AKSARA A/B self-test PASS (offline, simulated assertions only; NO live provider winner)");
}
async function live(){
 const keys=Object.fromEntries(Object.entries(PROVIDERS).map(([id,s])=>[id,process.env[s.env]]));
 if(!keys.orcarouter||!keys.openrouter){
  console.error("LIVE BENCHMARK NOT RUN: both ORCAROUTER_API_KEY and OPENROUTER_API_KEY must be configured securely.");
  process.exitCode=2;return;
 }
 const rows=[];
 for(let i=0;i<CASES.length;i++){
  const order=i%2?["openrouter","orcarouter"]:["orcarouter","openrouter"];
  for(const provider of order){
   try{
    const x=await callProvider(provider,CASES[i],{key:keys[provider]});
    rows.push(x);
    console.log("CHECK",provider,CASES[i].id,"model="+x.model,"ms="+x.latencyMs,
     "indoMarkers="+x.indonesianMarkers.length,"anchors="+(x.anchorCoverage===null?"n/a":x.anchorCoverage));
   }catch(e){
    rows.push({provider,caseId:CASES[i].id,error:safeError(e)});
    console.log("CHECK",provider,CASES[i].id,"error="+safeError(e));
   }
  }
 }
 const report=summarize(rows);
 if(process.env.AKSARA_BENCHMARK_REPORT){
  const dest=path.resolve(process.env.AKSARA_BENCHMARK_REPORT);
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.writeFileSync(dest,JSON.stringify(report,null,2)+"\n",{mode:0o600});
  console.log("Report written to",dest);
 }
 console.log("SUMMARY",JSON.stringify(report.providers,null,2));
 console.log("NOTE: No automatic winner is declared from six single-run prompts. Review answers manually for accuracy and Malaysian Malay naturalness.");
}
if(require.main===module){
 if(process.argv.includes("--live"))live().catch(e=>{console.error("Benchmark stopped:",safeError(e));process.exitCode=1;});
 else selfTest();
}
module.exports={PROVIDERS,SYSTEM,CASES,assess,parseAnswer,callProvider,summarize,selfTest};
