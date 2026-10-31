"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const Identity=require("../bilik-antara-identity");
test("Aksara model-grounding must acknowledge DeepSeek via NVIDIA while preserving honest status",()=>{
 for(const text of [Identity.PROVIDER_FACTS,Identity.RUNTIME_PROMPT,Identity.CORE_PROMPT]){
  assert.match(text,/DeepSeek/,"Shared identity must explain indirect DeepSeek availability");
  assert.match(text,/NVIDIA/);
  assert.match(text,/sambungan NVIDIA Connected/);
  assert.match(text,/bukan API DeepSeek langsung/);
  assert.match(text,/bukan penyedia kelima/);
  assert.match(text,/DeepSeek melalui NVIDIA NIM/);
  assert.match(text,/Jangan dakwa.*Connected/);
 }
 assert.equal(Identity.TEXT_PROVIDERS.length,4,"DeepSeek is a downstream model, not a fifth provider");
});
