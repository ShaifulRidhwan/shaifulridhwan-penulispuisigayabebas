"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const H=require("../netlify/functions/antara-intelligence");
const Brain=require("../bilik-antara-brain");
const {handler}=require("../netlify/functions/bilik-antara");
process.env.GEMINI_API_KEY="fake-test-key";
process.env.GEMINI_MODEL="gemini-3.6-flash";
const calls=[];
global.fetch=async(url,opts)=>{
  const body=JSON.parse(opts.body);
  calls.push({url,body});
  const review=body.generationConfig&&body.generationConfig.responseMimeType==="application/json";
  const answer=review?JSON.stringify({
    critique:"Premis perlu dibezakan daripada kesimpulan.",
    revision:"",
    argumentMap:[{label:"Kebebasan memerlukan pilihan",type:"premis",refersTo:null},{label:"Tak semua pilihan sama bebas",type:"bantahan",refersTo:1}],
    truthAudit:[{claim:"Kebebasan mutlak terbukti",status:"bersumber",note:"Sebenarnya tidak disahkan",sourceIndex:99}],
    thoughtLedger:[{idea:"Kebebasan dan tanggungjawab",status:"soalan_terbuka"}],
    hypothesis:"Dalam dunia tanpa dusta, privasi mungkin berubah."
  }):"Hujah ini boleh dibedah tanpa menghina orang.";
  return {ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:answer}]},finishReason:"STOP",
    groundingMetadata:{groundingChunks:[{web:{uri:"https://example.org/source",title:"Rujukan Ujian"}}]}}],usageMetadata:{totalTokenCount:42}})};
};
function latestPrimary(){return [...calls].reverse().find(c=>c.body.generationConfig.responseMimeType!=="application/json").body;}
function event(body,id){
  return {httpMethod:"POST",headers:{origin:"https://shaifulridhwan-penulispuisigayabebas.netlify.app","x-nf-client-connection-ip":"test-"+id},body:JSON.stringify(body)};
}
test("Text Gemini shares intelligent personality core with Voice Live without voice-only constraints",async()=>{
 const response=await handler(event({question:"Terangkan graviti secara mudah."},"shared-brain-core"));
 assert.equal(response.statusCode,200);
 const instruction=latestPrimary().systemInstruction.parts[0].text;
 assert.ok(instruction.includes(Brain.CORE));
 assert.ok(instruction.includes(Brain.TEXT_DELIVERY));
 assert.ok(!Brain.CORE.includes("teks/Markdown"));
 assert.match(Brain.VOICE_GUIDANCE,/KECERDASAN ADAPTIF/);
 assert.match(instruction,/PENERANGAN:/);
});
test("one automatic intelligence: no user mode required or honored",async()=>{
  const a=await handler(event({question:"Hai, salam?"},"hi"));
  assert.equal(a.statusCode,200);
  assert.equal(JSON.parse(a.body).aiMode,"automatic");
  assert.equal(latestPrimary().generationConfig.thinkingConfig.thinkingLevel,"minimal");
  const b=await handler(event({question:"Hai lagi",insightMode:"bedah"},"nomode"));
  assert.equal(b.statusCode,200);
  assert.equal(latestPrimary().generationConfig.thinkingConfig.thinkingLevel,"minimal");
});
test("deep argument generates second-pass review, map, and uncertain truth audit",async()=>{
  const r=await handler(event({question:"Kritik hujah aku: mengapa paradoks kebebasan memilih perlu diuji?"},"deep"));
  const obj=JSON.parse(r.body);
  assert.equal(r.statusCode,200);
  assert.equal(obj.aiMode,"automatic");
  assert.equal(obj.reviewApplied,true);
  assert.ok(obj.argumentMap.length>0);
  assert.equal(obj.truthAudit[0].status,"belum_disahkan");
  assert.ok(obj.thoughtLedger.length);
  assert.equal(calls.at(-2).body.generationConfig.thinkingConfig.thinkingLevel,"high");
});
test("free-mode research, code and URL context without any selector",async()=>{
  await handler(event({question:"Berita terkini kajian sains?"},"search"));
  assert.ok(!latestPrimary().tools||!latestPrimary().tools.some(t=>t.google_search),"Paid search must be disabled in RM0 mode");
  await handler(event({question:"Kirakan integral x kuasa dua dari 1 hingga 100"},"math"));
  assert.ok(latestPrimary().tools.some(t=>t.code_execution));
  await handler(event({question:"Baca https://example.com dan ulas kandungan"},"url"));
  assert.ok(latestPrimary().tools.some(t=>t.url_context));
});
test("concept-aware literary retrieval uses only published works",()=>{
  const ranked=H.poemMatches("wanita yang diwarisi");
  assert.ok(ranked.length>0);
  assert.match(H.poemContext("puisi wanita yang diwarisi"),/WANITA YANG DIWARISI/);
  assert.equal(H.poemContext("qwerty01234 nonsense"),"");
});
test("media: PDF/image/audio/video allowed with limits and carried inline",async()=>{
  for(const mime of ["application/pdf","image/png","audio/mpeg","video/mp4"]){
    const r=await handler(event({question:"Analisis lampiran ini",media:{name:"sampel",mimeType:mime,data:"QUJDRA=="}},"media"+mime));
    assert.equal(r.statusCode,200);
    const content=latestPrimary().contents.at(-1).parts;
    assert.equal(content[1].inlineData.mimeType,mime);
    assert.equal(content[1].inlineData.data,"QUJDRA==");
    assert.ok(!r.body.includes("QUJDRA=="));
  }
});
test("short recorded voice takes fast path without tools or second-pass review",async()=>{
 const before=calls.length;
 const r=await handler(event({question:"Jawab rakaman ini",voiceFallback:true,
  media:{name:"suara.webm",mimeType:"audio/webm",data:"QUJDRA=="}},"voice-fast"));
 assert.equal(r.statusCode,200);
 const answer=JSON.parse(r.body);
 assert.equal(answer.mode,"recorded-voice");
 assert.equal(answer.reviewApplied,false);
 assert.ok(answer.reply.length>0);
 assert.equal(calls.length,before+1,"fast audio must only make one Gemini request");
 const request=calls.at(-1).body;
 assert.equal(request.contents[0].parts[1].inlineData.mimeType,"audio/webm");
 assert.ok(!request.tools?.length,"fast audio must skip optional tools");
 assert.equal(request.generationConfig.maxOutputTokens,950);
});
test("recorded voice retries a temporary Google 503 once, then replies",async()=>{
 const old=global.fetch;let times=0;
 try{
  global.fetch=async()=>{
   times++;
   if(times===1)return {ok:false,status:503,json:async()=>({error:{status:"UNAVAILABLE"}})};
   return {ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:"Aku dengar soalan kau."}]}}]})};
  };
  const r=await handler(event({question:"Jawab rakaman ini",voiceFallback:true,
    media:{mimeType:"audio/webm",data:"QUJDRA=="}},"voice-retry503"));
  assert.equal(r.statusCode,200);
  assert.equal(times,2);
  assert.match(JSON.parse(r.body).reply,/Aku dengar/);
 }finally{global.fetch=old;}
});
test("persistent Gemini 503 remains retryable without falsely claiming success",async()=>{
 const old=global.fetch;let attempts=0;
 try{
  global.fetch=async()=>{attempts++;return {ok:false,status:503,json:async()=>({})};};
  const r=await handler(event({question:"Rakaman",voiceFallback:true,
    media:{mimeType:"audio/webm",data:"QUJDRA=="}},"voice-still503"));
  assert.equal(r.statusCode,503);
  assert.equal(attempts,2);
  assert.match(JSON.parse(r.body).error,/Cuba lagi tanpa merakam semula/);
 }finally{global.fetch=old;}
});
test("session summaries and thoughts included as untrusted user data",async()=>{
  const r=await handler(event({question:"Sambung analisis",
    summary:"Terdahulu kami pertikai kemerdekaan.",
    thoughtLedger:[{idea:"Premis yang belum dibuktikan",status:"premis"}]},"session"));
  assert.equal(r.statusCode,200);
  assert.match(latestPrimary().contents.at(-1).parts[0].text,/Terdahulu kami pertikai/);
  assert.ok(!latestPrimary().systemInstruction.parts[0].text.includes("Terdahulu kami pertikai"));
});
test("probe and opt-in conversational compaction",async()=>{
  const before=calls.length;
  const ping=await handler(event({probe:true},"probe"));
  assert.equal(ping.statusCode,200);
  assert.equal(JSON.parse(ping.body).geminiVerified,false);
  assert.equal(calls.length,before);
  const r=await handler(event({summarize:true,history:[
    {role:"user",content:"A"},{role:"assistant",content:"B"},
    {role:"user",content:"C"},{role:"assistant",content:"D"}]},"summary"));
  assert.equal(r.statusCode,200);
  assert.ok(JSON.parse(r.body).summary);
});
test("invalid origin, unsupported media, request size, and empty prompt rejected",async()=>{
  const origin=await handler({httpMethod:"POST",headers:{origin:"https://other.example"},body:"{}"});
  assert.equal(origin.statusCode,403);
  assert.equal((await handler(event({},"empty"))).statusCode,400);
  assert.equal((await handler(event({question:"Test",media:{mimeType:"application/x-msdownload",data:"QUJDRA=="}},"badfile"))).statusCode,400);
  assert.equal((await handler(event({question:"Test",media:{mimeType:"image/png",data:"A".repeat(5000000)}},"bigfile"))).statusCode,400);
  assert.equal((await handler(event({huge:"x".repeat(5450000)},"size"))).statusCode,413);
});


test("ordinary explanation stays conversational rather than forcing debate",async()=>{
  const start=calls.length;
  const response=await handler(event({question:"Kenapa langit berwarna biru?"},"explain-normal"));
  assert.equal(response.statusCode,200);
  const first=calls[start].body;
  assert.match(first.systemInstruction.parts[0].text,/PENERANGAN:/);
  assert.equal(first.generationConfig.thinkingConfig.thinkingLevel,"minimal");
  assert.equal(first.generationConfig.maxOutputTokens,2500);
  assert.equal(calls.length,start+1,"Ordinary factual explanation should not trigger a second API call");
});
test("hard technical tasks get adaptive output headroom and correctness review",async()=>{
  const start=calls.length;
  const reply=await handler(event({question:"Semak ketepatan analisis mendalam tentang algoritma dan ralat kod Python ini: for i in range(4): print(i)"},"technical-deep"));
  assert.equal(reply.statusCode,200);
  const first=calls[start].body;
  assert.equal(first.generationConfig.thinkingConfig.thinkingLevel,"high");
  assert.equal(first.generationConfig.maxOutputTokens,10000);
  assert.match(first.systemInstruction.parts[0].text,/PENYELESAIAN:/);
  assert.equal(JSON.parse(reply.body).reviewApplied,true);
});
test("follow-up inherits previous research, but explicit new task resets tools",async()=>{
  const prev=[{role:"user",content:"Apa berita teknologi terkini?"},{role:"assistant",content:"Ringkasan semasa."}];
  await handler(event({question:"Teruskan",history:prev},"follow-up-research"));
  assert.match(latestPrimary().systemInstruction.parts[0].text,/MAKLUMAT:/);
  assert.ok(!latestPrimary().tools||!latestPrimary().tools.some(t=>t.google_search),"No paid search on follow-up");
  await handler(event({question:"Tulis sajak asli",history:prev},"new-task"));
  assert.match(latestPrimary().systemInstruction.parts[0].text,/KREATIF:/);
  assert.ok(!latestPrimary().tools||!latestPrimary().tools.some(t=>t.google_search));
});
test("tool offers are not falsely reported as tool executions",async()=>{
  const response=await handler(event({question:"Jalankan kod Python untuk mengira regresi data ini"},"tool-fidelity"));
  const parsed=JSON.parse(response.body);
  assert.ok(parsed.toolsOffered.includes("code_execution"));
  assert.deepEqual(parsed.toolsUsed,[],"Fake Gemini response did not actually execute any tool");
});
test("standalone URL doesn't waste search grounding quota",async()=>{
  await handler(event({question:"Ringkaskan https://example.org/report"},"url-only"));
  const used=latestPrimary().tools;
  assert.ok(used.some(t=>t.url_context));
  assert.ok(!used.some(t=>t.google_search));
});

test("multiple attachments are allowed when total payload fits",async()=>{
 const a={name:"a.pdf",mimeType:"application/pdf",data:"QUJDRA=="};
 const b={name:"b.png",mimeType:"image/png",data:"QUJDRA=="};
 const response=await handler(event({question:"Bandingkan empat lampiran",media:[a,b,a,b]},"multi-media"));
 assert.equal(response.statusCode,200);
 const parts=latestPrimary().contents.at(-1).parts;
 assert.equal(parts.length,5);
 assert.equal(parts[1].inlineData.mimeType,"application/pdf");
 assert.equal(parts[2].inlineData.mimeType,"image/png");
});
test("longer messages are preserved, and oversized ones receive explicit errors",async()=>{
 const question="Terangkan dengan contoh: "+("huraian ".repeat(300));
 const good=await handler(event({question},"long-question"));
 assert.equal(good.statusCode,200);
 assert.equal(latestPrimary().contents.at(-1).parts[0].text.slice(0,question.trim().length),question.trim());
 const tooLong=await handler(event({question:"a".repeat(32001)},"overlong-question"));
 assert.equal(tooLong.statusCode,413);
});
test("memory context capacity is increased without moving it to system instructions",async()=>{
 const notes="Aku lebih suka contoh. ".repeat(100);
 const r=await handler(event({question:"Terangkan sains",memoryNotes:notes},"extended-memory"));
 assert.equal(r.statusCode,200);
 const content=latestPrimary().contents.at(-1).parts[0].text;
 assert.ok(content.includes(notes.trim()));
 assert.ok(!latestPrimary().systemInstruction.parts[0].text.includes(notes.trim()));
});
