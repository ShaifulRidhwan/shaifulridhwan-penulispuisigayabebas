"use strict";
const Context=require("../netlify/functions/aksara-context-manager");
const Evidence=require("../netlify/functions/aksara-evidence-audit");
const Vision=require("../netlify/functions/aksara-vision-diagnostics");
const Failure=require("../netlify/functions/aksara-failure-diagnostics");
const Prompt=require("../netlify/functions/aksara-prompt-optimizer");
function run(){
 const cases=[];
 const history=[{role:"user",content:"Pilihan pertama ialah server. Pilihan kedua ialah IndexedDB di browser."},
  ...Array.from({length:10},(_,i)=>({role:i%2?"assistant":"user",content:"Topik rawak "+i+" tanpa pilihan lama."}))];
 for(let i=0;i<10;i++)
  cases.push({group:"context",pass:Context.selectHistory(history,"yang kedua tadi",{keepRecent:3,maxChars:2400}).some(x=>x.content.includes("IndexedDB"))});
 const levels=["page_text","grounded_search","search_excerpt","links_only","no_external_evidence"];
 for(let i=0;i<10;i++){
  const level=levels[i%5],tools={page_text:["owned_page_html"],grounded_search:["google_search"],
   search_excerpt:["browser_search"],links_only:[],no_external_evidence:[]}[level];
  const sources=level==="no_external_evidence"?[]:[{url:"https://example.org/article"}];
  cases.push({group:"evidence",pass:Evidence.summarize({sources,toolsUsed:tools}).level===level});
 }
 const visions=[
  {media:[],provider:"gemini",reply:"OK",expected:"not_requested"},
  {media:[{mimeType:"image/jpeg"}],provider:"gemini",reply:"Jawapan",expected:"model_replied_accuracy_unverified"},
  {media:[{mimeType:"image/webp"}],provider:"openrouter",reply:"Jawapan",consent:true,expected:"model_replied_accuracy_unverified"},
  {media:[{mimeType:"image/png"}],provider:"",reply:"",expected:"consent_required"},
  {media:[{mimeType:"image/png"}],provider:"",reply:"",consent:true,expected:"not_verified"}
 ];
 for(let i=0;i<10;i++){const x=visions[i%5];cases.push({group:"vision",pass:Vision.inspect(x).status===x.expected});}
 const errors=[
  [{status:429},"quota_or_rate_limit"],[{status:413},"payload_too_large"],
  [{status:401},"authentication"],[{status:404},"model_unavailable"],
  [{status:503},"upstream_or_network"],[{status:504},"timeout"],
  [{status:400},"bad_request"],[{code:"CAPABILITY_UNAVAILABLE",status:503},"capability_unavailable"],
  [{code:"CANCELLED",status:499},"cancelled"],
  [{status:400,reason:"location_restricted"},"region_restricted"]
 ];
 for(const [x,expected] of errors)cases.push({group:"diagnostics",pass:Failure.category(x)===expected});
 for(let i=0;i<10;i++){
  const text="A"+i+"\nB\nA"+i;
  cases.push({group:"prompt",pass:Prompt.audit(text).exactDuplicates===1&&Prompt.compose([text],{dedupeExact:true}).split("\n").length===2});
 }
 const passed=cases.filter(x=>x.pass).length;
 return {suite:"AKSARA-V4",mode:"offline-contract-only",total:50,passed,failed:50-passed,
  caveat:"NOT a live AI quality or vision/OCR benchmark",cases};
}
if(require.main===module){const x=run();console.log(JSON.stringify(x,null,2));if(x.failed)process.exitCode=1;}
module.exports={run};
