"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Tavily=require("../netlify/functions/aksara-tavily");
const env={TAVILY_API_KEY:"test-only"};
function mock(body,fn=()=>{}){
 return async(url,init)=>{
  fn(url,init);
  return {ok:true,status:200,text:async()=>JSON.stringify(body)};
 };
}
test("Tavily blocks internal URLs and credentials",()=>{
 for(const url of ["http://example.org/a","https://localhost/a","https://127.0.0.1/a","https://192.168.1.1/a","https://internal.local/a","https://example.com:444/a","https://u:p@example.com/a"])
  assert.equal(Tavily.safeUrl(url),null);
 assert.ok(Tavily.safeUrl("https://example.org/reading"));
});
test("Tavily sends only a public explicit query, never secrets",async()=>{
 assert.equal(Tavily.searchable("Search my private password",{}),false);
 assert.equal(Tavily.searchable("What happened in 2026?",{}),true);
 assert.equal(Tavily.searchable("What happened?",{attachment:true}),false);
 let seen=false;
 const response=await Tavily.search("What happened in 2026?",{
  env,fetchImpl:mock({results:[{title:"Example",url:"https://example.org/article",content:"A public snippet"}]},(url,init)=>{
   seen=true;assert.equal(url,"https://api.tavily.com/search");
   assert.equal(init.headers.Authorization,"Bearer test-only");
   const input=JSON.parse(init.body);assert.equal(input.search_depth,"basic");
   assert.equal(input.include_raw_content,false);
  })
 });
 assert.equal(seen,true);
 assert.equal(response.status,"search-snippets");
 assert.equal(response.sources[0].verifiedLive,false);
});
test("Tavily URL Reader uses extract only for eligible public HTTPS",async()=>{
 assert.equal(Tavily.extractable("Review https://localhost/admin"),false);
 let sent=null;
 const result=await Tavily.extract("Review https://example.org/article",{
  env,fetchImpl:mock({results:[{url:"https://example.org/article",raw_content:"# This page was retrieved.\nSource text."}]},(url,init)=>{
   assert.equal(url,"https://api.tavily.com/extract");sent=JSON.parse(init.body);
  })
 });
 assert.deepEqual(sent.urls,["https://example.org/article"]);
 assert.equal(sent.extract_depth,"basic");
 assert.equal(result.status,"page-read");
 assert.equal(result.sources[0].kind,"page-content");
});
