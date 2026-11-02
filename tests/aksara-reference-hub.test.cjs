"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const Hub=require("../bilik-antara-knowledge-hub.js");
const Endpoint=require("../netlify/functions/aksara-reference-hub.js");
const Research=require("../netlify/functions/aksara-research-workflow.js");
const lines=file=>fs.readFileSync(file,"utf8");
const request=(data,ip="knowledge-hub-unit")=>({httpMethod:"POST",
 body:JSON.stringify(data),headers:{"x-nf-client-connection-ip":ip}});
test("carian karya awam berfungsi tanpa AI, indeks vektor atau kandungan peribadi",()=>{
 const works=JSON.parse(lines("karya-index.json"));
 assert.ok(works.length>=30);
 const hits=Hub.searchWorks(works,"aporia");
 assert.ok(hits.length>=1);
 assert.equal(hits[0].title,"ANTARA TAHU DAN APORIA");
 assert.equal(typeof hits[0].excerpt,"string");
 assert.ok(hits[0].excerpt.length<=175);
 assert.deepEqual(Hub.searchWorks(works,"zzxx-yang-tidak-ada"),[]);
 assert.equal(Hub.MODES.length,4);
 const source=lines("bilik-antara-knowledge-hub.js");
 assert.doesNotMatch(source,/localStorage\.setItem|sessionStorage\.setItem|sendBeacon|XMLHttpRequest/);
 assert.match(source,/fetch\("karya-index\.json"/);
 assert.match(source,/fetch\("\/\.netlify\/functions\/aksara-reference-hub"/);
});
test("pautan awam sahaja; URL dalaman, fail, credentials dan javascript ditolak",()=>{
 assert.equal(Hub.publicUrl("https://ms.wikipedia.org/wiki/Falsafah"),"https://ms.wikipedia.org/wiki/Falsafah");
 for(const bad of ["http://example.com/","javascript:alert(1)","file:///etc/passwd",
  "https://localhost/private","https://127.0.0.1/admin","https://192.168.1.1/",
  "https://hello.local/","https://user:pw@example.com/","https://site.com:8080/"]){
  assert.equal(Hub.publicUrl(bad),null,bad);
 }
});
test("endpoint menolak data peribadi, URL arbitrari dan kaedah lain",async()=>{
 assert.equal(Endpoint.cleanQuery("falsafah"),"falsafah");
 for(const q of ["a","https://example.com","test@contoh.org","12345678901","<script>"]){
  assert.equal(Endpoint.cleanQuery(q),"",q);
 }
 assert.equal((await Endpoint.handler({httpMethod:"GET"})).statusCode,405);
 assert.equal((await Endpoint.handler(request({action:"url",query:"falsafah"}))).statusCode,400);
 assert.equal((await Endpoint.handler(request({action:"wikipedia",query:"https://example.com"}))).statusCode,400);
 assert.equal((await Endpoint.handler({httpMethod:"POST",body:"not-json"})).statusCode,400);
});
test("kalkulator sebenar guna parser SafeTools, bukan eval, dan ralat dibezakan",async()=>{
 const a=await Endpoint.handler(request({action:"calculate",expression:"(12+8)*3"}));
 assert.equal(a.statusCode,200);
 const data=JSON.parse(a.body);assert.equal(data.result,60);
 assert.match(data.source,/bukan jawapan AI/);
 const b=await Endpoint.handler(request({action:"calculate",expression:"7/0"}));
 assert.equal(b.statusCode,422);
 assert.match(JSON.parse(b.body).error,/Pembahagian sifar/);
 const c=await Endpoint.handler(request({action:"calculate",expression:"process.exit(1)"}));
 assert.equal(c.statusCode,422);
 assert.equal("Cache-Control" in a.headers,true);
});
test("Wikipedia menggunakan API host terhad dan senarai sumber sebenar",async()=>{
 const original=global.fetch,calls=[];
 global.fetch=async(url)=>{
  const u=String(url);calls.push(u);
  assert.match(u,/^https:\/\/(?:ms|en)\.wikipedia\.org\//);
  if(u.includes("list=search"))return {ok:true,json:async()=>({query:{search:[{title:"Falsafah"}]}})};
  return {ok:true,json:async()=>({title:"Falsafah",
   extract:"Falsafah merupakan kajian sistematik mengenai pengetahuan, realiti, kewujudan dan nilai.",
   content_urls:{desktop:{page:u.includes("ms.wikipedia.org")?"https://ms.wikipedia.org/wiki/Falsafah":"https://en.wikipedia.org/wiki/Falsafah"}}})};
 };
 try{
  const response=await Endpoint.handler(request({action:"wikipedia",query:"falsafah"},"wikipedia-case"));
  assert.equal(response.statusCode,200,response.body);
  const data=JSON.parse(response.body);
  assert.equal(data.status,"ada_hasil");assert.ok(data.sources.length>=1);
  assert.ok(data.sources.every(s=>/^https:\/\/(?:ms|en)\.wikipedia\.org\/wiki\//.test(s.url)));
  assert.ok(calls.length>=2);
  const searched=await Research.research("Cari rujukan Wikipedia tentang falsafah",
    {search:true,hasLink:false,sensitive:false},{enabled:true,attachment:false,account:false,privateContext:false});
  assert.equal(searched.status,"encyclopedia");
  assert.ok(searched.sources.length>=1);
 }finally{global.fetch=original;}
});
test("UI Melayu dan pautan arkib kekal, tanpa mengubah consent/routing/Voice",()=>{
 const html=lines("bilik-antara.html");
 const code=lines("bilik-antara-code-status.js");
 const home=lines("gaya-bebas.js");
 assert.match(html,/Empat penyedia AI teks · Gemini 1–4/);
 assert.match(code,/Lima bahasa boleh menjalankan kod, termasuk C\+\+20/);
 assert.match(html,/bilik-antara-knowledge-hub\.js\?v=1/);
 assert.match(html,/id="knowledgeDialog"/);
 assert.match(home,/new URLSearchParams\(location\.search\)\.get\('karya'\)/);
 assert.match(home,/p\[0\] === requestedTitle/);
 assert.match(lines("netlify/functions/aksara-research-workflow.js"),/Wikipedia disebut secara khusus/);
 assert.match(html,/id="contextFallback"/);
 assert.match(html,/id="allowOpenRouterImages"/);
 assert.ok(html.length<80000,"HTML utama mesti kekal bawah 80 KB");
});
