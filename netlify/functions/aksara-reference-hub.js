"use strict";
/* AKSARA Pusat Rujukan · carian Wikipedia awam tanpa API berbayar.
 * Endpoint tidak menerima URL sasaran, nota peribadi, sejarah, atau muatan fail.
 * Hanya utiliti Wikipedia sedia ada yang menyekat host kepada ms/en.wikipedia.org.
 */
const {publicReferences}=require("./antara-free-research");
const SafeTools=require("./aksara-safe-tools");
const attempts=new Map();
const TIME_WINDOW_MS=60000,MAX_PER_MINUTE=12;
const noStore={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store, max-age=0","X-Content-Type-Options":"nosniff"};
const respond=(statusCode,data,headers={})=>({statusCode,headers:{...noStore,...headers},body:JSON.stringify(data)});
function cleanQuery(input){
 if(typeof input!=="string")return "";
 const q=input.normalize("NFKC").trim().replace(/\s+/g," ");
 if(q.length<3||q.length>85||/[\u0000-\u001f<>]/.test(q)||/https?:|@|(?:\+?\d[\d\s().-]*){8,}/i.test(q))return "";
 if(!/[\p{L}]/u.test(q))return "";
 return q;
}
function throttle(identity,now=Date.now()){
 // Had perlindungan terbaik sahaja: fungsi serverless tidak mempunyai storan bersama.
 const key=String(identity||"anon").slice(0,120);
 // Fungsi serverless boleh hidup lama; buang rekod tamat supaya peta tidak berkembang tanpa batas.
 if(attempts.size>500){
  for(const [id,entry] of attempts)if(now-entry.start>=TIME_WINDOW_MS)attempts.delete(id);
  while(attempts.size>500)attempts.delete(attempts.keys().next().value);
 }
 const state=attempts.get(key);
 if(!state||now-state.start>=TIME_WINDOW_MS){attempts.set(key,{start:now,count:1});return 0;}
 if(state.count>=MAX_PER_MINUTE)return Math.max(1,Math.ceil((state.start+TIME_WINDOW_MS-now)/1000));
 state.count++;return 0;
}
async function handler(event={}){
 if(event.httpMethod!=="POST")return respond(405,{error:"Gunakan permintaan POST."},{Allow:"POST"});
 if(typeof event.body!=="string"||event.body.length>1100)return respond(413,{error:"Permintaan terlalu panjang."});
 let body;
 try{body=JSON.parse(event.isBase64Encoded?Buffer.from(event.body,"base64").toString("utf8"):event.body);}catch(_){return respond(400,{error:"Format permintaan tidak sah."});}
 if(!body||typeof body!=="object"||Array.isArray(body))return respond(400,{error:"Format permintaan tidak sah."});
 if(body.action==="calculate"){
  if(typeof body.expression!=="string"||body.expression.length>120)return respond(400,{error:"Ungkapan matematik tidak sah."});
  const result=SafeTools.execute({name:"calculate",arguments:{expression:body.expression}},{enabled:true,allowKnowledge:false});
  return result.ok?respond(200,{status:"berjaya",expression:body.expression,result:result.result,source:"Pengiraan matematik setempat pada pelayan, bukan jawapan AI."}):
   respond(422,{status:"gagal",error:result.error});
 }
 if(body.action!=="wikipedia")return respond(400,{error:"Hanya carian Wikipedia dan pengiraan terhad dibenarkan."});
 const query=cleanQuery(body.query);
 if(!query)return respond(400,{error:"Masukkan topik umum antara 3 hingga 85 aksara, tanpa URL atau data peribadi."});
 const headers=event.headers||{};
 const wait=throttle(headers["x-nf-client-connection-ip"]||headers["X-Nf-Client-Connection-Ip"]||"shared");
 if(wait)return respond(429,{error:"Terlalu banyak carian. Cuba sebentar lagi.",retryAfterSeconds:wait},{"Retry-After":String(wait)});
 try{
  const raw=await publicReferences("rujukan Wikipedia "+query,{hasLink:false,sensitive:false},false,false);
  const sources=(Array.isArray(raw)?raw:[]).filter(x=>typeof x.url==="string"&&
   /^https:\/\/(?:ms|en)\.wikipedia\.org\/wiki\//i.test(x.url)).slice(0,3)
   .map(x=>({title:String(x.title||"Wikipedia").slice(0,130),
    url:x.url,excerpt:String(x.extract||"").slice(0,600),
    language:x.url.startsWith("https://ms.")?"ms":"en"}));
  return respond(200,{status:sources.length?"ada_hasil":"belum_disahkan",sources,
   note:sources.length?"Ringkasan Wikipedia awam, bukan audit fakta menyeluruh.":
    "Tiada hasil yang dapat disahkan, atau Wikipedia tidak dapat dicapai."});
 }catch(_){return respond(503,{status:"tidak_tersedia",sources:[],error:"Wikipedia tidak dapat disemak."});}
}
module.exports={handler,cleanQuery,throttle};
