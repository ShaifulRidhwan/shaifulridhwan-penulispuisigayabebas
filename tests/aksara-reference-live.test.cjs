"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const Endpoint=require("../netlify/functions/aksara-reference-hub.js");
const Hub=require("../bilik-antara-knowledge-hub.js");
const read=path=>fs.readFileSync(path,"utf8");
const request=(data,ip="unit-reference-live")=>({httpMethod:"POST",
 body:JSON.stringify(data),headers:{"x-nf-client-connection-ip":ip}});
test("Wikipedia: hanya topik awam; URL, emel, nombor panjang dan host arbitrari ditolak",()=>{
 assert.equal(Endpoint.cleanQuery("falsafah"),"falsafah");
 for(const q of ["a","https://example.com","test@contoh.org","12345678901","<script>"]){
  assert.equal(Endpoint.cleanQuery(q),"",q);
 }
 assert.equal(Hub.safeLink("https://127.0.0.1/"),null);
});
test("Kira terus menggunakan parser SafeTools sedia ada, bukan eval atau model AI",async()=>{
 const a=await Endpoint.handler(request({action:"calculate",expression:"(12+8)*3"}));
 assert.equal(a.statusCode,200);
 assert.equal(JSON.parse(a.body).result,60);
 assert.match(JSON.parse(a.body).source,/bukan jawapan AI/);
 const b=await Endpoint.handler(request({action:"calculate",expression:"7/0"}));
 assert.equal(b.statusCode,422);
 assert.match(JSON.parse(b.body).error,/Pembahagian sifar/);
 assert.equal((await Endpoint.handler(request({action:"calculate",expression:"process.exit()"}))).statusCode,422);
 assert.equal((await Endpoint.handler(request({action:"unknown",query:"falsafah"}))).statusCode,400);
});
test("Carian Wikipedia memanggil modul Wikimedia awam sahaja, tanpa sebarang URL arbitrari",async()=>{
 const original=global.fetch,calls=[];
 global.fetch=async(url)=>{
  const u=String(url);calls.push(u);
  assert.match(u,/^https:\/\/(?:ms|en)\.wikipedia\.org\//);
  if(u.includes("list=search"))return {ok:true,json:async()=>({query:{search:[{title:"Aporia"}]}})};
  return {ok:true,json:async()=>({title:"Aporia",type:"standard",
   extract:"Aporia ialah konsep falsafah mengenai kebuntuan hujah dan keraguan dalam ilmu pengetahuan.",
   content_urls:{desktop:{page:u.includes("ms.wikipedia.org")?
    "https://ms.wikipedia.org/wiki/Aporia":"https://en.wikipedia.org/wiki/Aporia"}}})};
 };
 try{
  const out=await Endpoint.handler(request({action:"wikipedia",query:"aporia"},"live-lookup-example"));
  assert.equal(out.statusCode,200);
  const data=JSON.parse(out.body);
  assert.equal(data.status,"ada_hasil");
  assert.ok(data.sources.length>=1);
  assert.ok(data.sources.every(x=>/^https:\/\/(?:ms|en)\.wikipedia\.org\/wiki\//.test(x.url)));
  assert.ok(calls.length>=2);
 }finally{global.fetch=original;}
});
test("Pusat Rujukan v3.1 menyimpan tab dan privasi sedia ada, menambah hasil terus serta pautan karya",()=>{
 const html=read("bilik-antara.html"),hub=read("bilik-antara-knowledge-hub.js");
 assert.match(hub,/knowledgeWikiSearch/);
 assert.match(hub,/knowledgeWikiResults/);
 assert.match(hub,/knowledgeCalcRun/);
 assert.match(hub,/referencePost/);
 assert.match(hub,/index\.html\?karya=/);
 assert.match(hub,/Sediakan soalan Wikipedia dalam chat/);
 assert.match(hub,/ba:session-changed/);
 assert.match(html,/bilik-antara-knowledge-hub\.js\?v=2/);
 assert.match(html,/bilik-antara-knowledge-hub\.css\?v=2/);
 assert.match(html,/bilik-antara-code-status\.js\?v=21/);
 assert.match(read("index.html"),/gaya-bebas\.js\?v=3/);
 assert.match(read("gaya-bebas.js"),/new URLSearchParams\(location\.search\)\.get\('karya'\)/);
 assert.doesNotMatch(hub,/localStorage\.setItem|sessionStorage\.setItem|sendBeacon/);
 assert.match(html,/id="contextFallback"/);
 assert.ok(html.length<80000);
});
