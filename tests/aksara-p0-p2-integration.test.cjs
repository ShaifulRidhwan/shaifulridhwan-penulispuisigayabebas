"use strict";
/* Handler-level P0–P2 integration scenarios. Providers are mocked and all
 * requests remain offline: no secrets, charges, deploy or user data. */
const test=require("node:test");
const assert=require("node:assert/strict");
const {handler}=require("../netlify/functions/bilik-antara");
const originalFetch=global.fetch;
const envKeys=["AKSARA_WEB_SEARCH_ENABLED","BRAVE_SEARCH_API_KEY","GEMINI_API_KEY","AKSARA_DISABLE_REVIEW","AKSARA_HYBRID_ROUTER","AKSARA_DISABLE_RESEARCH","GROQ_API_KEY","OPENROUTER_API_KEY"];
function setup(t,overrides={}){
 const saved=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
 Object.assign(process.env,{AKSARA_WEB_SEARCH_ENABLED:"true",BRAVE_SEARCH_API_KEY:"mock-brave",
  GEMINI_API_KEY:"mock-gemini",AKSARA_DISABLE_REVIEW:"true",AKSARA_HYBRID_ROUTER:"false",AKSARA_DISABLE_RESEARCH:"false"});
 delete process.env.GROQ_API_KEY;delete process.env.OPENROUTER_API_KEY;
 Object.assign(process.env,overrides);
 let seq=0;
 t.after(()=>{
  global.fetch=originalFetch;
  for(const k of envKeys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}
 });
 return async(q,extra={})=>{
  const response=await handler({httpMethod:"POST",
   headers:{"x-nf-client-connection-ip":"p0-p2-e2e-"+(++seq)},
   body:JSON.stringify({question:q,...extra})});
  return {status:response.statusCode,data:JSON.parse(response.body)};
 };
}
const googleReply=(text,extra={})=>Response.json({candidates:[{content:{parts:[{text}]},finishReason:"STOP",...extra}]});
test("P0 integration: current search passes verified query to provider and displays cited snippets, with CAHAYA identity",async t=>{
 const ask=setup(t);let webCalls=0,googleCalls=0,system="";
 global.fetch=async(url,opts)=>{
  if(String(url).startsWith("https://api.search.brave.com/")){
   webCalls++;
   assert.match(decodeURIComponent(String(url)),/berita sains terkini/i);
   assert.doesNotMatch(String(url),/mock-brave/,"API key must remain in header");
   assert.equal(opts.headers["X-Subscription-Token"],"mock-brave");
   return Response.json({web:{results:[{title:"Laporan contoh",description:"Ringkasan maklumat awam.",url:"https://example.org/report"}]}});
  }
  if(String(url).includes("generativelanguage.googleapis.com")){
   googleCalls++;
   const payload=JSON.parse(opts.body);
   system=payload.systemInstruction?.parts?.map(x=>x.text).join("\n")||"";
   assert.match(JSON.stringify(payload.contents),/example\.org\/report/);
   return googleReply("Aksara membuat ringkasan dan menunjukkan sumber yang tersedia.");
  }
  throw Error("Network request not allowed: "+url);
 };
 const out=await ask("Cari berita sains terkini");
 assert.equal(out.status,200,JSON.stringify(out.data).slice(0,400));
 assert.equal(out.data.provider,"gemini");
 assert.equal(out.data.thoughtMode,"cahaya");
 assert.equal(out.data.sources.length,1);
 assert.equal(out.data.sources[0].url,"https://example.org/report");
 assert.match(system,/Aksara A\.I\.|Aksara/);
 assert.match(system,/CAHAYA/);
 assert.equal(webCalls,1);
 assert.ok(googleCalls>=1);
});
test("P0 integration: unverified website review never pretends URL Context succeeded",async t=>{
 const ask=setup(t);
 let braveCalls=0;
 global.fetch=async(url)=>{
  if(String(url).includes("api.search.brave.com")){braveCalls++;throw Error("Arbitrary site review must not search");}
  if(String(url).includes("generativelanguage.googleapis.com"))return googleReply("Saya sudah membaca semua halaman dan CSS.");
  throw Error("External request blocked");
 };
 const out=await ask("Review website https://example.org/my-site");
 assert.equal(out.status,200,JSON.stringify(out.data).slice(0,400));
 assert.match(out.data.reply,/belum berjaya disahkan|belum berjaya dibaca|belum dapat/i);
 assert.doesNotMatch(out.data.reply,/sudah membaca semua halaman/);
 assert.equal(out.data.sources.length,0);
 assert.equal(braveCalls,0);
});
test("P1–P2 integration: CSV aggregates and JSON output remain exact, without chat emoji",async t=>{
 const ask=setup(t);
 global.fetch=async()=>{throw Error("Local data analysis must not call external APIs");};
 const out=await ask("Balas dalam format JSON",{
  documentName:"jualan.csv",
  documentText:"[FAIL: jualan.csv]\nitem,jumlah\nBuku,11\nPen,9"
 });
 assert.equal(out.status,200,JSON.stringify(out.data).slice(0,400));
 assert.equal(out.data.model,"aksara-data-engine");
 assert.equal(out.data.outputFormat,"json");
 assert.match(out.data.reply,/^```json
/);
 const parsed=JSON.parse(out.data.reply.replace(/^```jsons*/, "").replace(/s*```$/,""));
 assert.equal(parsed.analysis.numeric.jumlah.sum,20);
 assert.equal(parsed.analysis.numeric.jumlah.mean,10);
 assert.equal(parsed.source,"user_uploaded_data");
 assert.doesNotMatch(out.data.reply,/🙂|✨/);
});
test("P2 integration: requested structured JSON from model contains valid JSON without style contamination",async t=>{
 const ask=setup(t);
 global.fetch=async(url)=>{
  if(String(url).includes("generativelanguage.googleapis.com"))return googleReply('{"status":"ok","identity":"Aksara A.I.","score":42}');
  throw Error("Unexpected outbound fetch");
 };
 const out=await ask("Jawab dalam format JSON: susun rekod asas ini",{thoughtMode:"gelap"});
 assert.equal(out.status,200);
 assert.equal(out.data.outputFormat,"json");
 const raw=out.data.reply.split("
").slice(1,-1).join("
");
 assert.equal(JSON.parse(raw).identity,"Aksara A.I.");
 assert.equal(out.data.thoughtMode,"gelap");
 assert.doesNotMatch(raw,/🙂|✨/);
});
