"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const Web=require("../netlify/functions/aksara-web-search");
const Research=require("../netlify/functions/aksara-research-workflow");
const Data=require("../netlify/functions/aksara-data-analysis");
const Structured=require("../netlify/functions/aksara-structured-output");
const I=require("../netlify/functions/antara-intelligence");
const H=require("../netlify/functions/aksara-hybrid-policy");
const CF=require("../netlify/functions/aksara-context-manager");
const html=fs.readFileSync("bilik-antara.html","utf8");
const chat=fs.readFileSync("netlify/functions/bilik-antara.js","utf8");
test("P0: public web search is disabled without explicit opt-in and key",async()=>{
 let calls=0;
 const out=await Web.search("berita teknologi terkini",{env:{},fetchImpl:async()=>{calls++;throw Error("MUST_NOT_CALL");}});
 assert.equal(out.sources.length,0);assert.equal(calls,0);
 assert.equal(Web.eligible("I have a secret password",{env:{AKSARA_WEB_SEARCH_ENABLED:"true",BRAVE_SEARCH_API_KEY:"mock"}}),false);
});
test("P0: public web search never sends attachment, history, URL or private input",async()=>{
 const env={AKSARA_WEB_SEARCH_ENABLED:"true",BRAVE_SEARCH_API_KEY:"mock"};
 for(const opts of [{attachment:true},{privateContext:true},{sensitive:true},{hasLink:true}]){
  assert.equal(Web.eligible("Semak berita sains terkini",{env,...opts}),false);
 }
 assert.equal(Web.eligible("Review https://example.com/page",{env}),false);
 assert.equal(Web.eligible("sains nama@example.com",{env}),false);
});
test("P0: mock search returns real provider URLs and clearly marks excerpts as snippets",async()=>{
 let endpoint,call;
 const env={AKSARA_WEB_SEARCH_ENABLED:"true",BRAVE_SEARCH_API_KEY:"mock"};
 const out=await Web.search("berita sains terkini",{env,fetchImpl:async(url,opts)=>{
  endpoint=url;call=opts;
  return {ok:true,json:async()=>({web:{results:[
   {title:"Official results",url:"https://example.org/article",description:"Evidence summary"},
   {title:"Private link",url:"http://localhost/admin",description:"Rejected"}
  ]}})};
 }});
 assert.ok(endpoint.startsWith("https://api.search.brave.com/res/v1/web/search?"));
 assert.equal(call.method,"GET");assert.equal(call.redirect,"manual");
 assert.equal(call.headers["X-Subscription-Token"],"mock");
 assert.equal(out.status,"search-snippets");
 assert.equal(out.sources.length,1);
 assert.equal(out.sources[0].verifiedLive,false);
 assert.equal(out.sources[0].url,"https://example.org/article");
});
test("P0: research gives honest unavailable status without search credentials",async()=>{
 const old=process.env.AKSARA_WEB_SEARCH_ENABLED;
 const key=process.env.BRAVE_SEARCH_API_KEY;
 delete process.env.AKSARA_WEB_SEARCH_ENABLED;delete process.env.BRAVE_SEARCH_API_KEY;
 try{
  const out=await Research.research("Berita sains terkini",{search:true,sensitive:false,hasLink:false},{enabled:true});
  assert.equal(out.sources.length,0);
  assert.match(Research.guidance(out),/Tiada sumber luaran/);
 }finally{
  if(old===undefined)delete process.env.AKSARA_WEB_SEARCH_ENABLED;else process.env.AKSARA_WEB_SEARCH_ENABLED=old;
  if(key===undefined)delete process.env.BRAVE_SEARCH_API_KEY;else process.env.BRAVE_SEARCH_API_KEY=key;
 }
});
test("P0: URL intent and fallbacks never claim a page was reviewed without retrieval",()=>{
 assert.equal(I.analyzeIntent("review web https://example.com",false).hasLink,true);
 assert.match(chat,/URL belum dibaca/);
 assert.match(chat,/unverifiedReview/);
 assert.match(html,/Aku tak dapat sahkan kandungan URL itu/);
 assert.match(html,/URL DIRUJUK DARIPADA SEJARAH PENGGUNA/);
});
test("P0: old URL may be omitted by limited history but explicit followup anchor survives",()=>{
 const rows=[{role:"user",content:"https://example.com/old"}];
 for(let i=0;i<15;i++)rows.push({role:i%2?"assistant":"user",content:"Perbualan tentang perkara lain "+i});
 const out=CF.selectHistory(rows,"review link tadi",{maxChars:2000,keepRecent:5});
 assert.equal(out.some(x=>x.content.includes("example.com/old")),false);
 assert.match(html,/const priorLink=urlFollowUp/);
});
test("P1: supported attachments include local DOCX, CSV and JSON, but not unsafe URL parsing",()=>{
 assert.match(html,/bilik-antara-docx\.js\?v=1/);
 assert.match(html,/const content=ext==="docx"\?await window\.AksaraDocx\.read\(file\):await file\.text\(\)/);
 assert.match(html,/\.json,\.docx,\.pdf/);
});
function fakeDocx(xml,deflate=false){
 const filename=Buffer.from("word/document.xml"),body=Buffer.from(xml),compressed=deflate?require("node:zlib").deflateRawSync(body):body,local=Buffer.alloc(30),central=Buffer.alloc(46),end=Buffer.alloc(22);
 local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(deflate?8:0,8);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(body.length,22);local.writeUInt16LE(filename.length,26);
 central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(deflate?8:0,10);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(body.length,24);central.writeUInt16LE(filename.length,28);
 const offset=local.length+filename.length+compressed.length;
 end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(central.length+filename.length,12);end.writeUInt32LE(offset,16);
 const zip=Buffer.concat([local,filename,compressed,central,filename,end]);
 return {size:zip.length,arrayBuffer:async()=>zip.buffer.slice(zip.byteOffset,zip.byteOffset+zip.byteLength)};
}
test("P1: DOCX extracts document XML only, without fetching dependencies",async()=>{
 const window={};
 const env={window,DataView,Uint8Array,TextDecoder,Blob,DecompressionStream,Response,Error,Math,String,Number,ArrayBuffer,module:{exports:{}}};
 vm.runInNewContext(fs.readFileSync("bilik-antara-docx.js","utf8"),env);
 const file=fakeDocx('<?xml version="1.0"?><w:document xmlns:w="urn:word"><w:body><w:p><w:r><w:t>Satu &amp; dua</w:t></w:r></w:p></w:body></w:document>');
 const text=await window.AksaraDocx.read(file);
 assert.equal(text,"Satu & dua");
});
test("P1: actual DEFLATE-compressed DOCX is extracted without CDN",async()=>{
 const window={};
 const env={window,DataView,Uint8Array,TextDecoder,Blob,DecompressionStream,Response,Error,Math,String,Number,ArrayBuffer,module:{exports:{}}};
 vm.runInNewContext(fs.readFileSync("bilik-antara-docx.js","utf8"),env);
 const file=fakeDocx('<w:document xmlns:w="urn:word"><w:body><w:p><w:r><w:t>Fail DOCX mampat</w:t></w:r></w:p></w:body></w:document>',true);
 const out=await window.AksaraDocx.read(file);
 assert.equal(out,"Fail DOCX mampat");
});
test("P1: no implicit AI code execution after capability routing",()=>{
 const policy=H.decide({task:"technical",hasTools:true,available:["gemini","groq","workers_ai"]});
 assert.equal(policy.geminiFirst,true);
 const code=fs.readFileSync("bilik-antara-code-chat.js","utf8");
 assert.match(code,/run\.addEventListener\("click"/);
 assert.match(code,/never auto-execute/);
});
test("P2: CSV quoted fields and exact numeric aggregates",()=>{
 const s=Data.analyze("sample.csv","name,price,qty\n\"Buku, satu\",12.5,2\nBuku dua,7.5,4\n");
 assert.equal(s.rows,2);assert.equal(s.preview[0].name,"Buku, satu");
 assert.equal(s.numeric.price.sum,20);assert.equal(s.numeric.qty.mean,3);
});
test("P2: JSON list supports numerical data with deterministic output",()=>{
 const payload=Data.fromAttachment("sample.json",'[FAIL: sample.json]\n[{"x":1},{"x":3}]');
 assert.equal(payload.ok,true);assert.equal(payload.summary.numeric.x.mean,2);
 const rendered=Data.jsonReply(payload);
 assert.equal(JSON.parse(rendered).analysis.rows,2);
});
test("P2: malformed data is rejected and never executed",()=>{
 const bad=Data.fromAttachment("sample.json","[FAIL: sample.json]\n{not valid json}");
 assert.equal(bad.ok,false);
 assert.throws(()=>Data.parseCsv('a\n"unterminated'),/tidak lengkap/);
});
test("P2: structured model JSON is valid or explicitly wrapped without inventing a schema",()=>{
 assert.equal(Structured.wantsJson("Balas dalam format JSON"),true);
 const good=Structured.render('{"x":1}',true);
 assert.equal(good.validJson,true);
 assert.equal(JSON.parse(good.reply.slice(7,-3).trim()).x,1);
 const fallback=Structured.render("Plain model answer",true);
 assert.equal(JSON.parse(fallback.reply.slice(7,-3).trim()).answer,"Plain model answer");
 assert.equal(Structured.render("Jawapan",false).reply,"Jawapan");
});
test("P2: backend invokes data engine and structured renderer on live and fallback",()=>{
 assert.match(chat,/Data\.fromAttachment/);
 assert.match(chat,/Data\.format\(dataReport\)/);
 assert.match(chat,/Structured\.render\(reliableReply/);
 assert.match(chat,/Structured\.render\(reactionReply/);
});
