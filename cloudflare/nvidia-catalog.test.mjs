import {test} from "node:test";
import assert from "node:assert/strict";
import {isChatId,chatCatalog} from "./src/nvidia-catalog.mjs";
test("NVIDIA dynamic chat catalog excludes specialized APIs",()=>{
 const res=chatCatalog({data:[
  {id:"nvidia/nemotron-3.5-lightning-30b-a3b"},
  {id:"deepseek-ai/deepseek-v4.1-flash"},
  {id:"z-ai/glm-5-3-flash"},
  {id:"mistralai/mistral-large-4"},
  {id:"nvidia/nemotron-3.5-embed-1b"},
  {id:"nvidia/nemotron-3.5-rerank-8b"},
  {id:"nvidia/nemotron-parse-2.0"},
  {id:"nvidia/nemotron-3.5-lightning-30b-a3b"},
  {id:"invalid model/name"},
  {id:"nvidia/nemotron-vision-image-generation"}
 ]});
 assert.equal(res.length,4);
 assert.deepEqual(res.map(x=>x.id).sort(),["deepseek-ai/deepseek-v4.1-flash",
  "mistralai/mistral-large-4","nvidia/nemotron-3.5-lightning-30b-a3b","z-ai/glm-5-3-flash"].sort());
 assert.equal(res.find(x=>x.id==="deepseek-ai/deepseek-v4.1-flash").trialEndpointLabel,true);
 assert.ok(res.every(x=>x.status==="listed"));
});
test("IDs must be basic model identifiers, no hidden URL or open redirect",()=>{
 for(const id of ["http://evil.net/model","../../etc/passwd","nvidia/x\nAuthorization: Bearer 123",
  "nvidia/embed-model","nvidia/llama-rerank","nvidia/mistral-image","nvidia/tts-nemotron"]){
  assert.equal(isChatId(id),false,id);
 }
 assert.equal(isChatId("nvidia/nemotron-3.5-lightning-30b-a3b"),true);
});
test("catalog returns at most requested count, with no free production promises",()=>{
 const arr=Array.from({length:40},(_,i)=>({id:"mistralai/mistral-chat-"+i}));
 const models=chatCatalog({data:arr},8);
 assert.equal(models.length,8);
 assert.ok(models.every(m=>!Object.hasOwn(m,"productionEntitlement")));
});
