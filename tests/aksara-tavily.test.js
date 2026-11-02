"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const Tavily=require("../netlify/functions/aksara-tavily");
const Research=require("../netlify/functions/aksara-research-workflow");
test("reject private hosts, numeric IPs, credentials and non-HTTPS URL",()=>{
 for(const s of ["http://example.com","https://127.0.0.1/admin","https://localhost/","https://192.168.1.1/",
  "https://test.internal/","https://user:pass@example.com/","https://example.com/?token=hidden",
  "https://[::1]/"])assert.equal(Tavily.safeUrl(s),null,s);
 assert.equal(Tavily.safeUrl("https://example.com/article#section"),"https://example.com/article");
});
test("extract only a user-supplied public HTTPS URL",()=>{
 assert.equal(Tavily.extractUrl("Tolong semak https://example.com/article."),"https://example.com/article");
 assert.equal(Tavily.extractUrl("Baca http://localhost/"),null);
});
test("do not send memory, private credentials, attachments or user identity to Tavily",()=>{
 const base={env:{TAVILY_API_KEY:"test"}};
 assert.equal(Tavily.eligible("Semak berita terkini",base),true);
 assert.equal(Tavily.eligible("Semak berita", {...base,attachment:true}),false);
 assert.equal(Tavily.eligible("Semak berita", {...base,privateContext:true}),false);
 assert.equal(Tavily.eligible("Semak berita", {...base,sensitive:true}),false);
 assert.equal(Tavily.eligible("Semak berita", {...base,account:true}),false);
 assert.equal(Tavily.eligible("https://localhost/admin", {...base,hasLink:true}),false);
});
test("basic web search uses Tavily API with bounded output and never leaks key to model",async()=>{
 let request;
 const fetchImpl=async (url,init)=>{request={url,init};return {
  ok:true,async json(){return {results:[{title:"New discoveries",url:"https://example.com/post",
   content:"Something happened today."}]};}};};
 const r=await Tavily.lookup("latest discoveries today",{env:{TAVILY_API_KEY:"sample-key"},fetchImpl,reserveImpl:async()=>{}});
 assert.equal(r.status,"search-snippets");assert.equal(r.sources.length,1);
 assert.equal(r.sources[0].verifiedLive,false);
 assert.equal(request.url,"https://api.tavily.com/search");
 assert.equal(JSON.parse(request.init.body).search_depth,"basic");
 assert.equal(JSON.stringify(r).includes("sample-key"),false);
});
test("URL extract returns true page text evidence, not just search snippets",async()=>{
 const fetchImpl=async()=>({ok:true,json:async()=>({results:[{url:"https://example.org/article",raw_content:"Read from the page."}]})});
 const r=await Tavily.lookup("Semak https://example.org/article",{env:{TAVILY_API_KEY:"sample-key"},fetchImpl,hasLink:true,reserveImpl:async()=>{}});
 assert.equal(r.status,"page-read");assert.equal(r.sources[0].kind,"page-extract");
 assert.equal(r.sources[0].verifiedLive,true);
});
test("Research API remains callable when Tavily is not configured",async()=>{
 const r=await Research.research("Berita terkini zaman sekarang",{search:true,hasLink:false,sensitive:false},
  {attachment:true});
 assert.equal(r.status,"not-eligible");
});

test("AKSARA disables Tavily by default without disabling Gemini URL Context",async t=>{
 const previous=process.env.AKSARA_TAVILY_ENABLED;
 const oldLookup=Tavily.lookup;
 t.after(()=>{if(previous===undefined)delete process.env.AKSARA_TAVILY_ENABLED;else process.env.AKSARA_TAVILY_ENABLED=previous;Tavily.lookup=oldLookup;});
 delete process.env.AKSARA_TAVILY_ENABLED;
 Tavily.lookup=async()=>{throw Error("Disabled Tavily must not be called");};
 const out=await Research.research("Baca https://example.org/article",{hasLink:true,search:false,sensitive:false});
 assert.equal(out.status,"tavily-disabled");
 assert.deepEqual(out.sources,[]);
 assert.match(Research.guidance(out),/Gemini URL Context/);
});
test("Tavily only enters the research workflow after explicit opt-in",async t=>{
 const previous=process.env.AKSARA_TAVILY_ENABLED;
 const oldLookup=Tavily.lookup;
 t.after(()=>{if(previous===undefined)delete process.env.AKSARA_TAVILY_ENABLED;else process.env.AKSARA_TAVILY_ENABLED=previous;Tavily.lookup=oldLookup;});
 process.env.AKSARA_TAVILY_ENABLED="true";
 let calls=0;
 Tavily.lookup=async()=>{calls++;return {status:"page-read",sources:[{url:"https://example.org/article",extract:"Mock page text",kind:"page-extract"}]};};
 const out=await Research.research("Baca https://example.org/article",{hasLink:true,search:false,sensitive:false});
 assert.equal(calls,1);assert.equal(out.status,"page-read");
});

test("fail closed when credit budget is exhausted without calling external API",async()=>{
 let calls=0;
 const out=await Tavily.lookup("unique query example for credit limit",{
  env:{TAVILY_API_KEY:"sample-key"},reserveImpl:async()=>{throw Error("limit");},
  fetchImpl:async()=>{calls++;throw Error("Unexpected");}});
 assert.equal(out.status,"local-budget-store-unavailable");assert.equal(calls,0);
});
test("durable credit counter stops at configured monthly ceiling",async()=>{
 const {reserve}=require("../netlify/functions/lib/aksara-tavily-budget");
 let value=0;
 const store={async getWithMetadata(){return value?{data:{used:value},etag:String(value)}:null;},
  async setJSON(k,data,opt){if(value&&opt.onlyIfMatch!==String(value))return {modified:false};
   value=data.used;return {modified:true};}};
 await reserve({store,cap:2});await reserve({store,cap:2});
 await assert.rejects(()=>reserve({store,cap:2}),/exhausted/);
 assert.equal(value,2);
});

test("short follow-up opens the actual user-shared URL, not an assistant-invented one",()=>{
 const history=[
  {role:"user",content:"https://shaifulridhwan-penulispuisigayabebas.netlify.app/"},
  {role:"assistant",content:"Aku boleh tengok link."}
 ];
 assert.equal(Research.followUpUrl("masuk dalam web",history),"https://shaifulridhwan-penulispuisigayabebas.netlify.app/");
 assert.equal(Research.followUpUrl("review laman tadi",history),"https://shaifulridhwan-penulispuisigayabebas.netlify.app/");
 assert.equal(Research.followUpUrl("apa pendapat kau tentang coding?",history),null);
 assert.equal(Research.followUpUrl("jangan buka web tu",history),null);
 assert.equal(Research.followUpUrl("buka laman itu",[{role:"assistant",content:"https://example.org/"}]),null);
 assert.equal(Research.followUpUrl("masuk dalam web",[{role:"user",content:"http://localhost/internal"}]),null);
});
test("live page guidance never claims browsing is absent after successful Extract",()=>{
 const message=Research.guidance({status:"page-read"});
 assert.match(message,/TAVILY EXTRACT SUDAH BERJAYA/);
 assert.match(message,/jangan kata tiada browsing tool/);
 assert.match(Research.guidance({status:"local-budget-store-unavailable"}),/BUKAN bukti kredit Tavily habis/);
});
test("render path uses one blocking core stylesheet and defers secondary assets",()=>{
 const fs=require("node:fs");
 const html=fs.readFileSync("bilik-antara.html","utf8");
 const toml=fs.readFileSync("netlify.toml","utf8");
 assert.match(html,/rel="stylesheet" href="bilik-antara\.css\?v=103">/);
 assert.match(html,/href="aksara-header\.css\?v=3" media="print" onload="this\.media='all'"/);
 assert.match(html,/href="bilik-antara-code-execution\.css\?v=1" media="print" onload="this\.media='all'"/);
 assert.match(html,/src="bilik-antara-gemini-status\.js\?v=2" defer/);
 assert.match(html,/bilik-antara-multi-ai-status\.css\?v=1" media="print"/);
 assert.equal((html.match(/href="aksara-celestial-static\.webp\?v=1" as="image"/g)||[]).length,2);
 for(const image of ["aksara-celestial-static.webp","aksara-background-cahaya-gelap.webp"]){
  const rule=toml.split("[[headers]]").find(s=>s.includes('for = "/'+image+'"'));
  assert.ok(rule?.includes("max-age=2592000"),image+" must have 30-day cache");
 }
});

test("new free Tavily API key reaches provider without requiring Netlify Blobs",async()=>{
 let count=0;
 const out=await Tavily.lookup("new no-cap search query",{env:{TAVILY_API_KEY:"sample-key"},fetchImpl:async()=>{
  count++;return {ok:true,json:async()=>({results:[{title:"Live source",url:"https://example.org/free",content:"Verified through mocked API."}]})};
 }});
 assert.equal(count,1);assert.equal(out.status,"search-snippets");
});
test("upstream auth, exhausted credits, rate limit and timeout remain distinguishable",async()=>{
 const cases=[[401,"upstream-auth-failed"],[403,"upstream-auth-failed"],[432,"upstream-credits-exhausted"],[429,"upstream-rate-limited"],[503,"upstream-unavailable"]];
 for(const [code,status] of cases){
  const r=await Tavily.lookup("https://example.org/provider-status-"+code,{env:{TAVILY_API_KEY:"sample-key"},hasLink:true,
   fetchImpl:async()=>({ok:false,status:code})});
  assert.equal(r.status,status,code);
 }
 const timed=await Tavily.lookup("https://example.org/provider-status-timeout",{env:{TAVILY_API_KEY:"sample-key"},hasLink:true,
  fetchImpl:async()=>{const error=new Error("timeout");error.name="AbortError";throw error;}});
 assert.equal(timed.status,"upstream-timeout");
});
test("explicit owner cap remains opt-in and fails closed without claiming provider credits exhausted",async()=>{
 const result=await Tavily.lookup("https://example.org/owner-cap",{env:{TAVILY_API_KEY:"sample-key",AKSARA_TAVILY_MONTHLY_CREDITS:"700"},
  hasLink:true,reserveImpl:async()=>{throw Error("Tavily monthly budget exhausted");},
  fetchImpl:async()=>{throw Error("Should never query provider");}});
 assert.equal(result.status,"local-cap-reached");
});

test("optional custom monthly cap requires an independent explicit opt-in switch",async()=>{
 let requests=0;
 const base={TAVILY_API_KEY:"sample-key",AKSARA_TAVILY_MONTHLY_CREDITS:"700"};
 const out=await Tavily.lookup("new extra disabled cap search",{env:base,
  fetchImpl:async()=>{requests++;return {ok:true,json:async()=>({results:[{url:"https://example.org/optin",title:"Source",content:"Content"}]})};}});
 assert.equal(requests,1);assert.equal(out.status,"search-snippets");
 const invalid=await Tavily.lookup("another unique cap query",{env:{...base,AKSARA_TAVILY_LOCAL_BUDGET_ENABLED:"true",AKSARA_TAVILY_MONTHLY_CREDITS:"garbage"},
  fetchImpl:async()=>{throw Error("Must not call provider");}});
 assert.equal(invalid.status,"local-cap-invalid");
});
