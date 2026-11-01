"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const Context=require("../netlify/functions/aksara-context-manager");
const Knowledge=require("../netlify/functions/aksara-knowledge-engine");
const Registry=require("../netlify/functions/aksara-model-registry");
const Intelligence=require("../netlify/functions/antara-intelligence");

test("Context 3.0 keeps a relevant earlier correction and latest turn in order",()=>{
 const history=[{role:"user",content:"Jangan ubah kerangka AKSARA, kekalkan route 3+1."}];
 for(let i=0;i<10;i++)history.push({role:i%2?"assistant":"user",content:"Perbincangan teknikal "+i});
 history.push({role:"assistant",content:"Kita masih fokus pada otak AKSARA."});
 const chosen=Context.selectHistory(history,"yang tadi",{maxChars:1500,keepRecent:3});
 assert.ok(chosen.some(m=>m.content.includes("Jangan ubah kerangka")));
 assert.equal(chosen.at(-1).content,history.at(-1).content);
 assert.ok(chosen.every((m,i)=>i===0||history.indexOf(m)>history.indexOf(chosen[i-1])));
});
test("Context budgets are enforced even when newest messages exceed the budget",()=>{
 const history=[{role:"assistant",content:"a".repeat(1000)},
  {role:"user",content:"b".repeat(250)},
  {role:"assistant",content:"Jawapan terkini."},
  {role:"system",content:"Rahsia tidak boleh jadi history"}];
 const chosen=Context.selectHistory(history,"sambung",{maxChars:30,keepRecent:6});
 assert.ok(chosen.reduce((n,m)=>n+m.content.length,0)<=30);
 assert.deepEqual(chosen.map(m=>m.content),["Jawapan terkini."]);
 assert.ok(Context.composeTurn("Soalan terkini",["Nota sumber"]).endsWith("[TAMAT SOALAN TERKINI]"));
 assert.match(Context.composeTurn("Soalan terkini",["Nota sumber"]),/Soalan terkini/);
});
test("Cognitive 3.0 recognizes elliptical follow-ups and requires evidence calibration",()=>{
 const h=[{role:"user",content:"Bandingkan dua cadangan."},{role:"assistant",content:"Cadangan A dan B."}];
 const follow=Intelligence.cognitiveProfile("yang kedua",h,Intelligence.analyzeIntent("yang kedua",false));
 assert.equal(follow.focus,"contextual");
 assert.equal(follow.followUp,true);
 const fact="Semak fakta terkini dan berikan sumber rasmi";
 const p=Intelligence.cognitiveProfile(fact,[],Intelligence.analyzeIntent(fact,false));
 assert.equal(p.evidenceRequired,true);
 assert.match(Intelligence.cognitiveGuidance(p),/GERBANG BUKTI/);
 assert.match(Intelligence.cognitiveGuidance(p),/belum disahkan/);
});
test("Registry 3.0 observes reliability not alleged answer quality and retains 3+1 semantics",()=>{
 const providers=[{id:"groq"},{id:"workers_ai"},{id:"openrouter"}];
 assert.equal(Registry.select(providers,{task:"technical",thinking:"high"}).at(-1).id,"openrouter");
 for(let i=0;i<4;i++)Registry.observe("groq",{ok:false,latencyMs:23000});
 const ranked=Registry.select(providers,{task:"technical",thinking:"medium"});
 assert.equal(ranked[0].id,"workers_ai");
 assert.equal(Registry.diagnostics().find(x=>x.provider==="groq").avgMs,0);
 assert.deepEqual(Registry.select(providers,{images:true}).map(x=>x.id),["openrouter"]);
});
test("Knowledge 2.0 retrieves verified public text and never exposes private notes without consent",()=>{
 const publicResult=Knowledge.retrieve({question:"Petik puisi LANGIT YANG TIDAK SAMA",limit:5});
 const source=publicResult.find(x=>x.title==="LANGIT YANG TIDAK SAMA");
 assert.ok(source,"Known published poem should be indexed");
 assert.equal(source.kind,"public");
 assert.equal(source.source,"karya-index.json");
 assert.ok(source.excerpt.length>10);
 assert.equal(Knowledge.retrieve({question:"rahsia delta",includePublic:false,
  memoryNotes:"rahsia delta",allowPrivate:false}).length,0);
 const allowed=Knowledge.retrieve({question:"rahsia delta",includePublic:false,
  memoryNotes:"rahsia delta",allowPrivate:true});
 assert.equal(allowed[0].kind,"private");
 assert.match(allowed[0].excerpt,/rahsia delta/);
});
test("Knowledge excerpts select a matching source section rather than inventing a quote",()=>{
 const text="Ini perenggan tentang laut dan ombak.\n\n"+
  "Bahagian kuantum membincangkan persoalan dan ketidakpastian.";
 const excerpt=Knowledge.selectExcerpt("kuantum ketidakpastian",text);
 assert.match(excerpt,/kuantum/);
 assert.ok(text.includes(excerpt));
 assert.doesNotMatch(Knowledge.format([]),/rujukan palsu/);
});
