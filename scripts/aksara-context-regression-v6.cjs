"use strict";
/* 12 request-local synthetic multi-turn regression cases; no live AI calls. */
const Context=require("../netlify/functions/aksara-context-manager");
const Guard=require("../netlify/functions/aksara-context-consistency-v6");
const initial=[
 {role:"user",content:"Pilihan pertama kelajuan, kedua ketepatan, ketiga kestabilan."},
 {role:"assistant",content:"Terdapat tiga pilihan."},
 {role:"user",content:"Pembetulan: utamakan ketepatan, kekalkan Voice Live."},
 {role:"assistant",content:"Baik."}
];
const noise=Array.from({length:15},(_,i)=>({role:i%2?"assistant":"user",content:"Perbualan lain tentang topik nombor "+i+"."}));
const trials=[
 {id:"correction",rows:initial,question:"maksud aku yang terkini?",check:p=>p.latestCorrectionPresent&&p.followUp},
 {id:"ordinal-two",rows:[...initial,...noise],question:"yang kedua",check:p=>p.requestedOrdinal===2&&p.followUp},
 {id:"ordinal-three",rows:[...initial,...noise],question:"yang ketiga",check:p=>p.requestedOrdinal===3},
 {id:"no-memory",rows:[],question:"hai",check:p=>p.hasHistory===false&&p.stored===false},
 {id:"user-only",rows:[{role:"user",content:"Kekalkan bahasa Melayu."}],question:"lagi",check:p=>p.latestCorrectionPresent},
 {id:"later-correction",rows:[...initial,{role:"user",content:"Jangan ubah pilihan semasa."}],question:"yang tadi",check:p=>p.correctionCount>=2},
 {id:"no-fake-fact",rows:[{role:"assistant",content:"Contoh hipotetikal."}],question:"apa buktinya",check:p=>p.followUp},
 {id:"case-insensitive",rows:[{role:"user",content:"SEBENARNYA jangan usik."}],question:"yang tadi",check:p=>p.latestCorrectionPresent},
 {id:"mode-swap",rows:[...initial,{role:"user",content:"Sekarang GELAP, kekalkan fakta."}],question:"sambung",check:p=>p.latestCorrectionPresent&&p.stored===false},
 {id:"short",rows:initial,question:"teruskan",check:p=>p.followUp},
 {id:"no-followup",rows:initial,question:"Apakah itu fotosintesis?",check:p=>!p.followUp},
 {id:"third-choice",rows:[{role:"user",content:"Cadangan 1. A\nCadangan 2. B\nCadangan 3. C"},...noise],
  question:"yang ketiga",check:p=>p.requestedOrdinal===3}
];
function run(){
 const tests=trials.map(x=>{
  const p=Guard.inspect(x.rows,x.question);
  const selected=Context.selectHistory(x.rows,x.question,{maxChars:1400,keepRecent:5});
  const score=x.check(p);
  const referenced=x.id==="ordinal-two"?selected.some(m=>m.content.includes("kedua ketepatan")):
   x.id==="third-choice"?selected.some(m=>m.content.includes("Cadangan 3. C")):true;
  return {id:x.id,pass:!!score&&referenced,selectedTurns:selected.length};
 });
 return {suite:"AKSARA-V6-CONTEXT",mode:"offline_synthetic_no_persistent_memory",
   total:tests.length,passed:tests.filter(x=>x.pass).length,failed:tests.filter(x=>!x.pass).length,
   accuracyOfLiveModelNotVerified:true,tests};
}
if(require.main===module){const x=run();console.log(JSON.stringify(x,null,2));if(x.failed)process.exitCode=1;}
module.exports={trials,run};
