import {test} from "node:test";
import assert from "node:assert/strict";
import Worker from "./src/index.mjs";
import Context from "../netlify/functions/aksara-context-manager.js";
import Knowledge from "../netlify/functions/aksara-knowledge-engine.js";
import Intelligence from "../netlify/functions/antara-intelligence.js";
import Hybrid from "../netlify/functions/aksara-hybrid-policy.js";
// Isolated staging integration. Real branch code and Worker adapter; model
// responses are deterministic mocks, with no deployed production requests.
const ORIGIN="https://aksara-staging.invalid";
const old={};
for(const k of ["GEMINI_API_KEY","GROQ_API_KEY","OPENROUTER_API_KEY","AKSARA_FREE_FALLBACKS","AKSARA_HYBRID_ROUTER"]){
 old[k]=process.env[k];
}
delete process.env.GEMINI_API_KEY;
delete process.env.GROQ_API_KEY;
delete process.env.OPENROUTER_API_KEY;
process.env.AKSARA_FREE_FALLBACKS="true";
process.env.AKSARA_HYBRID_ROUTER="true";
process.on("exit",()=>{
 for(const [key,value]of Object.entries(old)){
  if(value===undefined)delete process.env[key];else process.env[key]=value;
 }
});
function fixture(){
 const calls=[],quotas=[];
 const ai={run:async(model,input)=>{
  calls.push({model,input});
  const latest=input.messages?.at(-1)?.content||"";
  // A real provider is never called here; mock checks that history is carried.
  const answer=String(latest).includes("yang kedua")?"Pilihan kedua ialah IndexedDB tempatan.":
   "Aku bezakan bukti dan inferens berdasarkan maklumat yang tersedia.";
  return {response:answer};
 }};
 const stub={fetch:async(_url,options)=>{
  const input=JSON.parse(options.body);
  quotas.push(input);
  return Response.json({ok:true});
 }};
 const env={
  AI:ai,
  AKSARA_RATE_SALT:"local-staging-test-only-salt-long-enough",
  AKSARA_CONTROL:{idFromName:()=>({}),get:()=>stub},
  ASSETS:{fetch:()=>Response.json({})}
 };
 const make=(payload,path="/.netlify/functions/bilik-antara",origin=ORIGIN)=>new Request(ORIGIN+path,{
  method:"POST",headers:{"origin":origin,"content-type":"application/json","cf-connecting-ip":"192.0.2.17"},
  body:JSON.stringify(payload)
 });
 return {env,calls,quotas,make};
}
test("staging health reports configured, not live-connected, for mock AI",async()=>{
 const {env}=fixture();
 const r=await Worker.fetch(new Request(ORIGIN+"/api/aksara-health"),env,{});
 assert.equal(r.status,200);
 const json=await r.json();
 assert.equal(json.platform,"cloudflare-workers");
 assert.equal(json.services.chat,true);
 assert.equal(json.configuredProviders,1);
});
test("staging CAHAYA routes through native AI binding and retains guarded identity",async()=>{
 const x=fixture();
 const r=await Worker.fetch(x.make({question:"Terangkan beza bukti dan inferens dengan satu contoh ringkas.",thoughtMode:"cahaya"}),x.env,{});
 const body=await r.json();
 assert.equal(r.status,200,JSON.stringify({code:body.code,error:body.error}));
 assert.equal(body.provider,"workers_ai");
 assert.ok(x.calls.length>=1);
 assert.equal(x.calls[0].model,"@cf/zai-org/glm-4.7-flash");
 assert.match(x.calls[0].input.messages[0].content,/Bahasa Melayu Malaysia/);
 assert.match(x.calls[0].input.messages[0].content,/CAHAYA/);
 assert.match(body.reply,/inferens/);
 assert.ok(x.quotas.some(q=>q.kind==="chat"));
 assert.ok(x.quotas.some(q=>q.kind==="workers_ai"));
 assert.ok(x.quotas.every(q=>!JSON.stringify(q).includes("Terangkan beza bukti")));
});
test("staging GELAP delivers appropriate mode and intellectual critique guidance",async()=>{
 const x=fixture();
 const r=await Worker.fetch(x.make({
  question:"Kritik andaian tentang ketepatan satu algoritma secara mendalam. Bezakan bukti dan tafsiran.",thoughtMode:"gelap"
 }),x.env,{});
 const body=await r.json();
 assert.equal(r.status,200,JSON.stringify({code:body.code,error:body.error}));
 assert.equal(body.provider,"workers_ai");
 const system=x.calls[0].input.messages[0].content;
 assert.match(system,/GELAP/);
 assert.match(system,/bukti/i);
});
test("staging follow-up carries synthetic second choice and keeps question latest",async()=>{
 const x=fixture();
 const history=[
  {role:"user",content:"Pilihan pertama server. Pilihan kedua IndexedDB tempatan."},
  {role:"assistant",content:"Aku telah meneliti kedua-dua pilihan."}
 ];
 const r=await Worker.fetch(x.make({question:"yang kedua",history,thoughtMode:"cahaya"}),x.env,{});
 const body=await r.json();
 assert.equal(r.status,200,JSON.stringify({code:body.code,error:body.error}));
 assert.equal(body.provider,"workers_ai");
 const messages=x.calls.at(-1).input.messages;
 assert.ok(JSON.stringify(messages).includes("IndexedDB tempatan"));
 assert.match(JSON.stringify(messages.at(-1)),/yang kedua/);
 assert.match(body.reply,/IndexedDB/);
});
test("staging guards foreign Origin and does not invoke models",async()=>{
 const x=fixture();
 const r=await Worker.fetch(x.make({question:"Hai"},"/.netlify/functions/bilik-antara","https://other.invalid"),x.env,{});
 assert.equal(r.status,403);
 assert.equal(x.calls.length,0);
});
test("staging 3+1 preserves strict OpenRouter last-resort policy",()=>{
 const chosen=Hybrid.decide({available:["gemini","groq","workers_ai","openrouter"],task:"technical",thinking:"high"});
 assert.deepEqual(chosen.primaries,["gemini","groq","workers_ai"]);
 assert.equal(chosen.backup,"openrouter");
});
test("staging knowledge evidence is original and private notes are opt-in",()=>{
 const a=Knowledge.retrieve({question:"LANGIT YANG TIDAK SAMA",limit:2});
 assert.equal(a[0].title,"LANGIT YANG TIDAK SAMA");
 assert.ok(a[0].excerpt.length);
 const privateItems=Knowledge.retrieve({question:"kod sulit atlas",includePublic:false,memoryNotes:"kod sulit atlas",allowPrivate:false});
 assert.deepEqual(privateItems,[]);
});
test("staging cognitive selects evidence control for verifiable claims",()=>{
 const question="Sahkan dakwaan ini menggunakan sumber rasmi yang boleh diperiksa";
 const intent=Intelligence.analyzeIntent(question,false),profile=Intelligence.cognitiveProfile(question,[],intent,"gelap");
 assert.equal(profile.evidenceRequired,true);
 assert.match(Intelligence.cognitiveGuidance(profile),/GERBANG BUKTI/);
});
