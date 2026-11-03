"use strict";
/* 20 synthetic Malay literary examples. Offline = structure and motif contracts,
 * not proof that a language model understands metaphor or philosophy.
 */
const V5=require("../netlify/functions/aksara-intelligence-v5");
const Sampling=require("./aksara-balanced-sampling-v6.cjs");
const cases=[
 ["Akar dan waktu","Akar mengingat pagi\nWaktu menyimpan nama",1,2,"masa"],
 ["Cahaya dua rangkap","Cahaya menulis\nBayang menjawab\n\nMatahari menyambut\nGelap berundur",2,4,"cahaya"],
 ["Iman","Tuhan dalam doa\nAkal bertanya",1,2,"iman"],
 ["Rindu","Rindu di hati\nCinta tidak selesai",1,2,"cinta"],
 ["Entropi","Jam melangkah\nMasa menghilang",1,2,"masa"],
 ["Gelap","Malam tidak menjerit\nBayang tidak bersalah",1,2,"gelap"],
 ["Bebas","Aku memilih jalan\nAku menanggung akibat",1,2,null],
 ["Tiada motif","Daun jatuh\nAir mengalir",1,2,null],
 ["Rangkap tiga","Satu suara\n\nDua suara\n\nTiga suara",3,3,null],
 ["Aporia","Aku tahu\nAkal tidak pasti",1,2,"akal"],
 ["Kontras","Terang melihat\nGelap membalas",1,2,"gelap"],
 ["Imejan","Matahari di hujung kota\nCahaya dalam tingkap",1,2,"cahaya"],
 ["Sunyi","Ruang tidak menjawab\nJendela terbuka",1,2,null],
 ["Nadi","Hati menyimpan cerita\nBuku tidak bersuara",1,2,"cinta"],
 ["Doa","Doa menutup malam\nPercaya mencari cahaya",1,2,"iman"],
 ["Masa II","Waktu berulang\nJam menunggu detik",1,2,"masa"],
 ["Akal II","Logik menolak\nFikiran bertanya",1,2,"akal"],
 ["Matahari","Mentari di utara\nMalam di selatan",1,2,"cahaya"],
 ["Gelap II","Kelam tinggal\nSiluet hilang",1,2,"gelap"],
 ["Iman II","Iman tidak memaksa\nPercaya memerlukan alasan",1,2,"iman"]
].map(([title,text,stanzas,lines,motif],i)=>({id:"literary-"+(i+1),task:"literary",title,text,stanzas,lines,motif}));
function offline(){
 const results=cases.map(c=>{
  const p=V5.literaryProfile(c.text),actualMotifs=(p.motifs||[]).map(x=>x.name);
  return {id:c.id,pass:p.stanzas===c.stanzas&&p.lines===c.lines&&(!c.motif||actualMotifs.includes(c.motif)),
   stanzas:p.stanzas,lines:p.lines,motifs:actualMotifs};
 });
 return {suite:"AKSARA-V6-LITERARY",mode:"offline_structure_contract_only",total:results.length,
  passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).length,
  philosophicalAccuracyVerified:false,humanQualityGraded:false,results};
}
async function live({endpoint=process.env.AKSARA_V6_LITERARY_EVAL_URL,count=3,fetchImpl=fetch}={}){
 const url=new URL(endpoint||"");
 if(url.protocol!=="https:"&&!["localhost","127.0.0.1"].includes(url.hostname))throw Error("HTTPS needed");
 if(!/\/(?:\.netlify\/functions\/bilik-antara|api\/bilik-antara)$/.test(url.pathname))throw Error("Use Aksara chat endpoint");
 const rows=[];
 for(const c of Sampling.pick(cases,Math.max(1,Math.min(10,count)))){
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),23000);
  try{
   const r=await fetchImpl(url.href,{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({question:"Analisis metafora, suara pencerita dan falsafah pada puisi ini. Jangan reka maksud yang tiada bukti.\n"+c.text,
     thoughtMode:"gelap",history:[]}),signal:ctl.signal});
   const data=await r.json();
   rows.push({id:c.id,http:r.status,provider:data.provider||"unknown",model:data.model||"",
    reply:String(data.reply||"").slice(0,7000),humanGrade:null,requiresHumanReview:true});
  }catch(e){rows.push({id:c.id,http:0,error:e.name==="AbortError"?"timeout":"request_failed",humanGrade:null});}
  finally{clearTimeout(timer);}
 }
 return {mode:"live_requires_human_review",attempted:rows.length,results:rows};
}
async function cli(){
 if(!process.argv.includes("--live")||!process.argv.includes("--confirm-quota")){
  const x=offline();console.log(JSON.stringify(x,null,2));if(x.failed)process.exitCode=1;return;
 }
 const a=process.argv.find(x=>x.startsWith("--count="));
 const x=await live({count:a?Number(a.slice(8)):3});
 console.log(JSON.stringify({mode:x.mode,attempted:x.attempted,graded:false},null,2));
}
if(require.main===module)cli().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={cases,offline,live};
