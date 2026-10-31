"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const Identity=require("../bilik-antara-identity");
test("Aksara model-grounding must acknowledge DeepSeek via OrcaRouter while preserving honest status",()=>{
 for(const text of [Identity.PROVIDER_FACTS,Identity.RUNTIME_PROMPT,Identity.CORE_PROMPT]){
  assert.match(text,/DeepSeek/,"Shared identity must explain indirect DeepSeek availability");
  assert.match(text,/OrcaRouter/);
  assert.match(text,/free_quota_exhausted/);
  assert.match(text,/bukan API DeepSeek langsung/);
  assert.match(text,/bukan penyedia kelima/);
  assert.match(text,/Jangan dakwa Aksara tiada integrasi DeepSeek/);
  assert.match(text,/Jangan dakwa.*Connected/);
 }
 assert.equal(Identity.TEXT_PROVIDERS.length,4,"DeepSeek is a downstream model, not a fifth provider");
});
