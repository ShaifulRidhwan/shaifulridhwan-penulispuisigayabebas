"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const Skills=require("../netlify/functions/aksara-skills-v1");
const select=(question,intent={},profile={},more={})=>Skills.plan({question,intent,profile,env:{},...more});
test("Metadata-only catalog; no playbook prompt for ordinary chat",()=>{
 const c=Skills.catalog();
 assert.equal(c.length,6);
 assert.ok(c.every(x=>x.id&&x.description&&!x.instructions));
 assert.deepEqual(select("Hai",{task:"conversation"}).active,[]);
 assert.equal(Skills.guidance(select("Hai",{task:"conversation"})),"");
});
test("Code debugging activates only for actionable technical problems",()=>{
 const s=select("Audit bug dalam GitHub repo aku",{task:"technical"},{focus:"debugging"});
 assert.deepEqual(s.active,["code-debug"]);
 assert.match(Skills.guidance(s),/Jangan dakwa telah membaca repo/);
 assert.deepEqual(select("Apa itu API?",{task:"explain"}).active,[]);
});
test("Web research labels real evidence tiers without exaggeration",()=>{
 const s=select("Semak berita terkini",{task:"research",search:true});
 assert.deepEqual(s.active,["web-research"]);
 assert.match(Skills.guidance(s,{researchStatus:"search-snippets",sourceCount:3}),/Hanya petikan carian/);
 assert.match(Skills.guidance(s,{researchStatus:"page-read",sourceCount:1}),/Teks halaman diperoleh/);
 assert.match(Skills.guidance(s,{researchStatus:"page-read",sourceCount:0}),/Tiada sumber web/);
 assert.equal(Skills.evidenceTier({hasOwnedPage:true}),"owned-page-text");
});
test("Documents, data, creativity and critical reasoning use separate procedures",()=>{
 assert.deepEqual(select("Semak dokumen PDF",{task:"explain"},{},{hasDocument:true}).active,["document-review"]);
 assert.deepEqual(select("Semak lampiran",{task:"explain"},{},{hasMedia:true}).active,["document-review"]);
 assert.match(Skills.guidance(select("Semak lampiran",{task:"explain"},{},{hasMedia:true})),/Tiada teks dokumen/);
 assert.deepEqual(select("Analisis CSV ini",{task:"technical"}).active,["data-analysis"]);
 assert.deepEqual(select("Tulis puisi 4 rangkap",{task:"creative"}).active,["creative-writing"]);
 assert.deepEqual(select("Uji hujah aku",{task:"critique",debate:true}).active,["critical-review"]);
 assert.deepEqual(select("Terjemah e-mel",{task:"creative"}).active,[]);
});
test("Privacy, reactions, simple math and OFF switch bypass skill injection",()=>{
 for(const i of [{task:"research",search:true,sensitive:true},{task:"support"},{task:"conversation",reaction:true},{task:"technical",simpleCalculation:true}])
  assert.deepEqual(select("Audit bug dan web",i,{focus:"debugging"}).active,[]);
 assert.equal(Skills.plan({question:"fix bug",intent:{task:"technical"},env:{AKSARA_SKILLS_ENABLED:"false"}}).status,"disabled");
});
test("User secrets cannot be echoed into selected system guidance",()=>{
 const secret="SECRET_TOKEN_12345";
 const s=select("Audit bug "+secret,{task:"technical"},{focus:"debugging"});
 assert.ok(!Skills.guidance(s).includes(secret));
 assert.ok(!JSON.stringify(s).includes(secret));
});
test("At most two playbooks per request",()=>{
 const s=select("Audit bug repo GitHub, semak berita terkini, uji hujah",{task:"technical",search:true,debate:true},{focus:"debugging"});
 assert.deepEqual(s.active,["code-debug","web-research"]);
});
test("Main chat integration retains existing cognitive prompt and voice route",()=>{
 const src=fs.readFileSync("netlify/functions/bilik-antara.js","utf8");
 assert.match(src,/const Skills=require\("\.\/aksara-skills-v1"\)/);
 assert.match(src,/Skills\.plan\(/);
 assert.match(src,/Skills\.guidance\(/);
 assert.match(src,/cognitiveGuidance\(cognition\)/);
 assert.match(src,/if\(payload\.voiceFallback===true\)/);
});
