"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const Agent=require("../netlify/functions/aksara-agent-tools-v7");

test("P0 public tool batch executes at most two unique knowledge searches",()=>{
 const calls=[
  {name:"knowledge_search",args:{query:"puisi"}},
  {name:"knowledge_search",args:{query:" PUISI "}},
  {name:"calculate",args:{expression:"2+2"}},
  {name:"knowledge_search",args:{query:"LANGIT YANG TIDAK SAMA"}},
  {name:"knowledge_search",args:{query:"sastera"}}
 ];
 const x=Agent.run(calls);
 assert.equal(x.responses.length,2);
 assert.equal(x.executedCount,2);
 assert.equal(x.privateMemoryAllowed,false);
 assert.equal(x.extraProviderRequests,0);
 assert.ok(x.responses.every(r=>r.name==="knowledge_search"&&Array.isArray(r.response.results)));
});
test("P0 tool runner refuses arbitrary tools, invalid arguments and private context",()=>{
 const bad=Agent.run([
  {name:"shell",args:{command:"rm -rf /"}},
  {name:"knowledge_search",args:{query:"a".repeat(301)}},
  {name:"knowledge_search",args:{query:{private:true}}}
 ]);
 assert.equal(bad.responses.length,0);
 assert.equal(bad.executedCount,0);
});
