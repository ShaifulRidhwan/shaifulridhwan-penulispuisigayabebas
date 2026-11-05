"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const Hub=require("../bilik-antara-knowledge-hub.js");
const Research=require("../netlify/functions/aksara-research-workflow.js");
const Observe=require("../bilik-antara-observability.js");
const poems=require("../karya-index.json");
const read=path=>fs.readFileSync(path,"utf8");
test("Karya: carian setempat menggunakan tajuk/teks arkib sebenar, tanpa mereka puisi",()=>{
 const found=Hub.rankPoems(poems,"aporia",7);
 assert.ok(found.length>=1);
 assert.equal(found[0].title,"ANTARA TAHU DAN APORIA");
 assert.ok(found[0].lines.join(" ").includes("Jemari"));
 assert.ok(Hub.rankPoems(poems,"graviti",7).some(p=>p.title==="MEMILIH UNTUK MENGORBIT"));
 assert.ok(Hub.rankPoems(poems,"",7).length===7);
 assert.deepEqual(Hub.rankPoems(poems,"qwertyuiopnotthere",7),[]);
 assert.equal(Hub.rankPoems([{title:"<img onerror=alert(1)>",lines:["x"]}],"",7)[0].title,
 "<img onerror=alert(1)>");
 assert.ok(!read("bilik-antara-knowledge-hub.js").includes("new Function("));
});
test("Pautan selamat: tidak memaparkan URL peribadi atau protokol berbahaya",()=>{
 for(const url of ["javascript:alert(1)","http://example.com","https://127.0.0.1/private",
  "https://192.168.0.12","https://10.0.0.1","https://169.254.169.254","https://localhost",
  "https://user:password@example.com","https://internal.local/","file:///etc/passwd","not-a-url"]){
  assert.equal(Hub.safeLink(url),null,url);
 }
 assert.equal(Hub.safeLink("https://ms.wikipedia.org/wiki/Aporia"),"https://ms.wikipedia.org/wiki/Aporia");
 assert.equal(Hub.safeLink("https://example.com"),"https://example.com/");
});
test("Wikipedia/URL ialah draf soalan, bukan dakwaan laman sudah dibaca",()=>{
 assert.match(Hub.wikipediaQuestion("aporia"),/Cari rujukan Wikipedia tentang aporia/);
 assert.equal(Hub.wikipediaQuestion(""),"");
 assert.ok(Hub.wikipediaQuestion("a".repeat(250)).length<=120,"Wikipedia query fits existing backend eligibility");
 assert.equal(Hub.calculationQuestion("(12+8)*3"),"Kira (12+8)*3");
 assert.equal(Hub.calculationQuestion("process.exit()"),"");
 assert.equal(Hub.urlQuestion("http://127.0.0.1/"),"");
 assert.match(Hub.urlQuestion("https://example.com/artikel"),/Nyatakan sama ada bacaan URL berjaya/);
 const source=read("bilik-antara-knowledge-hub.js");
 assert.match(source,/input\.dispatchEvent\(new Event\("input"/);
 assert.match(source,/dialog\.close\(\);input\.focus/);
 assert.match(source,/fetch\("karya-index\.json"/);
 assert.doesNotMatch(source,/localStorage|sessionStorage|sendBeacon|XMLHttpRequest|apiKey|\.transcript/);
});
test("Wikipedia yang diminta secara jelas menggunakan laluan ensiklopedia, bukan carian generik",async()=>{
 assert.equal(Research.isWikipediaRequest("Cari rujukan Wikipedia tentang aporia"),true);
 assert.equal(Research.isWikipediaRequest("cari berita teknologi terkini"),false);
 const oldFetch=global.fetch,oldFlag=process.env.ENABLE_FREE_WIKIMEDIA;
 let wikipediaCalls=0;
 global.fetch=async url=>{
  const u=String(url);
  assert.ok(/^https:\/\/(ms|en)\.wikipedia\.org\//.test(u),"Only encyclopedia endpoints: "+u);
  wikipediaCalls++;
  return {ok:true,json:async()=>u.includes("list=search")?
   {query:{search:[{title:"Aporia"}]}}:
   {title:"Aporia",type:"standard",extract:"Aporia merupakan konsep falsafah mengenai kebuntuan dan keraguan dalam hujah.",
    content_urls:{desktop:{page:u.startsWith("https://ms.")?
     "https://ms.wikipedia.org/wiki/Aporia":"https://en.wikipedia.org/wiki/Aporia"}}}};
 };
 process.env.ENABLE_FREE_WIKIMEDIA="true";
 try{
  const out=await Research.research("Cari rujukan Wikipedia tentang aporia",
   {search:true,hasLink:false,sensitive:false},{enabled:true,attachment:false,account:false,privateContext:false});
  assert.equal(out.status,"encyclopedia");
  assert.ok(out.sources.length>=1);
  assert.equal(out.sources[0].kind,"encyclopedia");
  assert.equal(out.sources[0].verifiedLive,false);
  assert.ok(wikipediaCalls>=2);
 }finally{
  global.fetch=oldFetch;
  if(oldFlag===undefined)delete process.env.ENABLE_FREE_WIKIMEDIA;
  else process.env.ENABLE_FREE_WIKIMEDIA=oldFlag;
 }
});
test("Status sumber ialah ringkasan, bukan pengesahan halaman penuh",()=>{
 assert.equal(Observe.classifyResearch({toolsUsed:["wikipedia_summary"],sourceCount:2}).label,
  "Ringkasan Wikipedia diperoleh");
 const backend=read("netlify/functions/bilik-antara.js");
 assert.match(backend,/researchResult\.status==="encyclopedia".*\["wikipedia_summary"\]/);
});
test("Penerangan Melayu, empat penyedia dan lima runtime kekal tanpa perubahan routing",()=>{
 const html=read("bilik-antara.html"),code=read("bilik-antara-code-status.js");
 assert.match(html,/Empat penyedia AI teks termasuk empat sambungan Gemini/);
 assert.doesNotMatch(html,/Four text providers/);
 assert.match(code,/Lima runtime untuk menjalankan kod termasuk C\+\+20/);
 assert.doesNotMatch(code,/Five executable runtimes including C\+\+20/);
 assert.match(html,/id="knowledgeHub"/);
 assert.match(html,/bilik-antara-knowledge-hub\.js\?v=2/);
 assert.match(html,/bilik-antara-knowledge-hub\.css\?v=2/);
 assert.ok(Buffer.byteLength(html,"utf8")<100000,"Original HTML performance limit");
 assert.match(read("bilik-antara-knowledge-hub.js"),/ba:session-changed/);
});
