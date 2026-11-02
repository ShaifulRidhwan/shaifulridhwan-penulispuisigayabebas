"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),
 fs=require("node:fs"),vm=require("node:vm");
const Hub=require("../bilik-antara-reference-hub.js");
const Research=require("../netlify/functions/aksara-research-workflow");
const poems=require("../karya-index.json");
const read=file=>fs.readFileSync(file,"utf8");

test("Pusat Rujukan mencari petikan karya sebenar, bukan teks rekaan",()=>{
 const rows=Hub.searchWorks(poems,"aporia");
 assert.ok(rows.length>=1);
 assert.equal(rows[0].title,"ANTARA TAHU DAN APORIA");
 assert.equal(rows[0].preview,poems.find(p=>p.title===rows[0].title).lines.filter(Boolean).slice(0,2).join(" ").slice(0,145));
 assert.equal(Hub.searchWorks(poems,"cinta",5).length<=5,true);
 assert.deepEqual(Hub.searchWorks(poems,""),[]);
 assert.deepEqual(Hub.searchWorks(poems,"zzzzwwqqvv"),[]);
 assert.deepEqual(Hub.searchWorks([{id:1,title:"Test",lines:["Hai"]}],"test")[0].title,"Test");
});

test("Pautan awam disahkan secara konservatif; tiada URL rahsia atau rangkaian peribadi",()=>{
 const safe=Hub.safePublicUrl;
 assert.equal(safe("https://ms.wikipedia.org/wiki/Aporia#Sejarah"),"https://ms.wikipedia.org/wiki/Aporia");
 for(const value of [
  "http://example.org/a","https://127.0.0.1/x","https://10.1.2.3/",
  "https://172.16.0.1/a","https://192.168.1.2/","https://localhost/",
  "https://intranet.local/x","https://user:pass@example.org",
  "https://example.org/path?access_token=abc","javascript:alert(1)",
  "https://[::1]/","https://example.com:9443/"
 ])assert.equal(safe(value),null,value);
 const src=Hub.safeSources([
  {title:"Aporia",url:"https://ms.wikipedia.org/wiki/Aporia"},
  {title:"Duplicate",url:"https://ms.wikipedia.org/wiki/Aporia"},
  {title:"Private",url:"https://192.168.1.2/private"},
  {title:"JS",url:"javascript:alert(1)"}
 ]);
 assert.deepEqual(src,[{title:"Aporia",url:"https://ms.wikipedia.org/wiki/Aporia"}]);
});

test("Sediakan soalan tidak menghantar permintaan dan Wikipedia berada dalam had rujukan awam",()=>{
 const w=Hub.question("wikipedia","falsafah absurd");
 assert.equal(w.question,"Cari rujukan Wikipedia tentang falsafah absurd");
 assert.ok(w.question.length<=120);
 assert.match(Hub.question("wikipedia","").error,/topik/);
 assert.match(Hub.question("wikipedia","https://contoh.org").error,/topik/);
 const u=Hub.question("pautan","https://ms.wikipedia.org/wiki/Falsafah");
 assert.match(u.question,/Baca teks halaman ini/);
 assert.match(Hub.question("pautan","https://127.0.0.1/private").error,/HTTPS/);
 assert.match(Hub.question("karya","ANTARA TAHU DAN APORIA").question,/karya Shaiful Ridhwan/);
 assert.equal(Hub.question("kira","").question,"Kira (12+8)*3");
 assert.ok(Hub.TABS.includes("pautan"));
});

test("Wikipedia terus ke ensiklopedia walaupun intent carian biasa mengesan 'cari'",async()=>{
 const oldFetch=global.fetch,oldEnv=process.env.ENABLE_FREE_WIKIMEDIA;
 let calls=0;
 delete process.env.ENABLE_FREE_WIKIMEDIA;
 global.fetch=async url=>{
  calls++;
  const u=new URL(url),lang=u.hostname.split(".")[0];
  const data=u.pathname.includes("/w/api.php")?
   {query:{search:[{title:"Falsafah"}]}}:
   {title:"Falsafah",extract:"Falsafah merangkumi persoalan asas tentang pengetahuan, realiti dan akal manusia.",
    content_urls:{desktop:{page:"https://"+lang+".wikipedia.org/wiki/Falsafah"}}};
  return new Response(JSON.stringify(data),{status:200,headers:{"content-type":"application/json"}});
 };
 try{
  const result=await Research.research("Cari rujukan Wikipedia tentang falsafah",{search:true,sensitive:false,hasLink:false});
  assert.equal(result.status,"encyclopedia");
  assert.ok(result.sources.length>0);
  assert.ok(result.sources.every(x=>x.kind==="encyclopedia"&&x.verifiedLive===false));
  assert.ok(calls>=3);
  const before=calls;
  const privateResult=await Research.research("Cari rujukan Wikipedia tentang falsafah",{search:true,sensitive:false,hasLink:false},{privateContext:true});
  assert.equal(privateResult.status,"not-eligible");
  assert.equal(calls,before,"Private context cannot trigger Wiki requests");
 }finally{
  global.fetch=oldFetch;
  if(oldEnv===undefined)delete process.env.ENABLE_FREE_WIKIMEDIA;
  else process.env.ENABLE_FREE_WIKIMEDIA=oldEnv;
 }
});

test("Rujukan, sumber terakhir dan arkib boleh diakses tanpa auto-submit atau API tambahan",()=>{
 const html=read("bilik-antara.html"),hub=read("bilik-antara-reference-hub.js"),
  css=read("bilik-antara-reference-hub.css"),index=read("gaya-bebas.js");
 assert.ok(html.includes("bilik-antara-reference-hub.js?v=1"));
 assert.ok(html.includes("bilik-antara-reference-hub.css?v=1"));
 assert.match(html,/id="referenceHub"/);
 assert.doesNotMatch(html,/data-knowledge-question=/);
 assert.ok(html.length<80000);
 assert.doesNotThrow(()=>new vm.Script(hub));
 assert.match(hub,/karya-index\.json/);
 assert.match(hub,/dialog\.open\)ensureWorks\(\)/,"Public index only loaded when reference modal is open");
 assert.doesNotMatch(hub,/requestSubmit\(|submit\(\)|localStorage\.setItem|sessionStorage\.setItem/);
 assert.match(hub,/ba:session-changed/);
 assert.match(hub,/ba:cleared/);
 assert.match(hub,/rel="noopener noreferrer"/);
 assert.match(css,/\[hidden\]\{display:none!important\}/);
 assert.match(index,/new URLSearchParams\(location\.search\)\.get\('cari'\)/);
 assert.match(index,/worksEl\.querySelectorAll\('\.work'\)\.length === 1/);
 assert.match(read("bilik-antara-observability.js"),/Ringkasan Wikipedia diperoleh/);
});

test("Penerangan dua status kini Melayu tanpa mengubah kontrak runtime atau provider",()=>{
 const code=read("bilik-antara-code-status.js"),html=read("bilik-antara.html");
 assert.match(code,/Lima runtime boleh melaksanakan kod, termasuk C\+\+20/);
 assert.match(code,/Pratonton HTML\/CSS berjalan dalam sandbox/);
 assert.doesNotMatch(code,/Five executable runtimes including C\+\+20/);
 assert.match(html,/Empat penyedia teks dengan empat slot Gemini/);
 assert.doesNotMatch(html,/Four text providers/);
 assert.match(code,/window\.AksaraCodeHealth\.create\(\)/);
 assert.match(html,/id="multiAiDialog"/);
});
