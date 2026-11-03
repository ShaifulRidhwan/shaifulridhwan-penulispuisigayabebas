"use strict";
// Live evaluation is explicit, quota-consuming and needs human grades.
const fs=require("node:fs");
const questions={
 explain:["Beza haba dan suhu?","Kenapa langit kelihatan biru?","Bagaimana DNS berfungsi?","Kenapa korelasi bukan kausaliti?","Apa itu entropi?","Terangkan bias pengesahan.","Bagaimana fotosintesis?","Apa beza accuracy dan precision?","Hash berbanding encryption?","Apa fungsi UTC?"],
 technical:["Output JavaScript 2+'2'?","Kenapa Array.sort nombor mengelirukan?","Fungsi JS buang pendua tanpa ubah susunan.","Beza HTTP 401 dan 403?","Apa maksud idempotent API?","Apa jadi bila Promise.all satu reject?","Terangkan CORS dengan tepat.","Cara uji fungsi async offline?","Debouncing lawan throttling?","Risiko token API dalam frontend?"],
 critique:["Popular bermaksud benar? Kritik.","Pantas bermaksud berkualiti? Kritik.","Jawapan AI bermakna fakta sahih?","Tiada bukti ialah bukti tiada?","Bandingkan kos murah dan ketahanan.","Satu ujian lulus bermakna tiada bug?","Korelasi membuktikan sebab?","Kritikan berbanding serangan peribadi?","Latensi bukan ukuran fakta: mengapa?","Bantahan terbaik kepada hujah sendiri?"],
 creative:["Puisi bebas tentang perubahan.","Metafora asli tentang ingatan.","Dua rangkap tema cahaya dan gelap.","Kritik metafora: hujan ialah jam.","Rangkap penutup tanpa klise.","Simbol lawan tema dalam sajak.","Tiga tajuk trilogi falsafah.","Puisi ringkas tanpa rima wajib.","Narator aku bukan penulis: jelaskan.","Analisis puisi secara berimbang."],
 context:["Yang kedua tadi apa?","Kekalkan pilihan pertama sahaja.","Apa pembetulan terkini aku?","Jangan ubah Voice Live.","Arahan baru bercanggah lama: ikut mana?","Apa pilihan ketiga asal?","Default memori OFF, bukan ON.","Kenapa lampiran perlukan izin?","Kenapa kedua bukan pertama?","Sambung tanpa meneka."]
};
const cases=Object.entries(questions).flatMap(([task,arr])=>arr.map((question,i)=>({
 id:task+"-"+String(i+1).padStart(2,"0"),task,question,
 history:task==="context"?[{role:"user",content:"Pertama kelajuan, kedua ketepatan, ketiga kestabilan. Jangan ubah Voice Live."},{role:"assistant",content:"Baik."},{role:"user",content:"Utamakan ketepatan, memori default OFF."}]:[]
})));
function manifest(){return {suite:"AKSARA-V5-LIVE",mode:"manual-opt-in",total:cases.length,requires:"--live --confirm-quota AKSARA_V5_EVAL_URL",humanGradingRequired:true};}
async function run({endpoint=process.env.AKSARA_V5_EVAL_URL,count=5,preferredProvider="",fetchImpl=fetch}={}){
 const u=new URL(String(endpoint||""));
 if(u.protocol!=="https:"&&u.hostname!=="localhost"&&u.hostname!=="127.0.0.1")throw Error("HTTPS endpoint required");
 if(!/\/(?:\.netlify\/functions\/bilik-antara|api\/bilik-antara)$/.test(u.pathname))throw Error("Bilik Antara JSON endpoint required");
 const records=[];
 for(const sample of cases.slice(0,Math.max(1,Math.min(50,Math.floor(count))))){
  const started=Date.now();
  try{
   const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),23000);
   let response;
   try{response=await fetchImpl(u.href,{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({question:sample.question,history:sample.history,thoughtMode:"cahaya",
    ...(preferredProvider?{preferredProvider}:{})}),signal:ctl.signal});}
   finally{clearTimeout(timer);}
   const data=await response.json();
   records.push({id:sample.id,task:sample.task,http:response.status,provider:data.provider||"unknown",
    model:data.model||"",elapsedMs:Date.now()-started,reply:String(data.reply||"").slice(0,7000),
    claimAudit:data.claimAudit||null,humanGrade:null,requiresHumanReview:true});
  }catch(error){records.push({id:sample.id,task:sample.task,provider:"unknown",http:0,
   error:error.name==="AbortError"?"timeout":"request_failed",humanGrade:null});}
 }
 return {mode:"real-endpoint-human-grade-pending",attempted:records.length,
  note:"Preferred provider is a hint; recorded provider is actual, not forced. A response is not a correctness grade.",records};
}
async function cli(){
 if(!process.argv.includes("--live")||!process.argv.includes("--confirm-quota")){
  console.log(JSON.stringify(manifest(),null,2));return;
 }
 const c=process.argv.find(x=>x.startsWith("--count=")),p=process.argv.find(x=>x.startsWith("--prefer="));
 const out=process.argv.find(x=>x.startsWith("--output="));
 const result=await run({count:c?Number(c.slice(8)):5,preferredProvider:p?p.slice(9):""});
 if(out)fs.writeFileSync(out.slice(9),JSON.stringify(result,null,2),{mode:0o600});
 console.log(JSON.stringify({mode:result.mode,attempted:result.attempted,humanGrades:"not yet reviewed",file:out?out.slice(9):null}));
}
if(require.main===module)cli().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={cases,manifest,run};