(function(root){
"use strict";
/* Voice Live: switch dialect only on explicit requests; no regional style state is persisted. */
const dialects=[
 {id:"utara",label:"Utara (Kedah, Perlis, Pulau Pinang)",words:["utara","kedah","perlis","pulau pinang","penang","pineng"],tip:"Utara boleh guna hang, depa, mai, awat dan sat secara semula jadi; jangan pinjam kawe, demo, guano dari Kelantan."},
 {id:"kelantan",label:"Kelantan",words:["kelantan","kelate","klate"],tip:"Kelantan boleh guna kawe dan demo bila sesuai; jangan pinjam hang, depa atau awat dari Utara."},
 {id:"terengganu",label:"Terengganu",words:["terengganu","ganu","tranung"],tip:"Bezakan Terengganu daripada Kelantan, jangan campurkan kedua-duanya."},
 {id:"perak",label:"Perak",words:["perak"],tip:"Bertutur dalam gaya Perak secara bersahaja, bukan Utara atau Kelantan."},
 {id:"negeri-sembilan",label:"Negeri Sembilan",words:["negeri sembilan","nogori","nismilan"],tip:"Gunakan loghat Negeri Sembilan secara sederhana dan tepat."},
 {id:"johor",label:"Johor",words:["johor"],tip:"Gunakan pertuturan Johor yang natural."},
 {id:"sabah",label:"Sabah",words:["sabah"],tip:"Gunakan gaya Melayu Sabah yang natural, bukan Sarawak."},
 {id:"sarawak",label:"Sarawak",words:["sarawak"],tip:"Gunakan gaya Melayu Sarawak yang natural, bukan Sabah."},
 {id:"pahang",label:"Pahang",words:["pahang"],tip:"Gunakan pertuturan Pahang yang munasabah."},
 {id:"melaka",label:"Melaka",words:["melaka"],tip:"Gunakan gaya Melaka yang natural."},
 {id:"selangor",label:"Selangor",words:["selangor"],tip:"Gunakan gaya Melayu Selangor yang bersahaja."},
 {id:"standard",label:"Bahasa Melayu Malaysia santai",words:["melayu biasa","bahasa melayu biasa","bahasa biasa","cakap biasa","melayu standard","bahasa standard","bahasa baku","tanpa loghat","tak payah loghat","jangan guna loghat","tak nak loghat"],tip:"Gunakan Melayu Malaysia santai tanpa sebarang loghat negeri khusus."}
];
const normalize=value=>String(value||"").toLocaleLowerCase("ms-MY").normalize("NFD")
 .replace(/[\u0300-\u036f]/g,"").replace(/[^\p{L}\p{N}\s]/gu," ").replace(/\s+/g," ").trim();
const forms=dialects.flatMap(d=>d.words.map(word=>({d,word,rx:new RegExp("(?:^|\\s)"+word+"(?=\\s|$)","g")})));
const commands=/(?:^|\s)(?:cuba|try|test|tukar|bertukar|beralih|alih|ganti|ubah|guna|pakai|cakap|bercakap|sembang|bertutur|balas|buat|ikut|switch)(?=\s|$)/;
function detectRequest(raw){
 const text=normalize(raw);
 if(!text||text.length>500)return null;
 const isCommand=commands.test(text)||/^(?:loghat|dialek)\s/.test(text)
  ||/(?:^|\s)(?:nak|mahu|mau|boleh)\s+(?:tak\s+)?(?:cuba|tukar|guna|pakai|cakap|bercakap|test|loghat|dialek)(?=\s|$)/.test(text)
  ||/^(?:kalau|apa kata)\s+(?:loghat|dialek)\s.+\s(?:boleh|pulak|pula)$/.test(text);
 if(!isCommand)return null;
 const matches=[];
 for(const f of forms){
  f.rx.lastIndex=0;
  for(const m of text.matchAll(f.rx)){
   const index=m.index+m[0].length-f.word.length;
   const prefix=text.slice(Math.max(0,index-50),index).trim();
   const negated=f.d.id!=="standard"&&/(?:^|\s)(?:jangan|bukan|tak nak|tak mahu|tidak mahu|tanpa)(?:\s+(?:cakap|guna|pakai|buat|loghat|dialek)){0,2}$/.test(prefix);
   matches.push({d:f.d,index,length:f.word.length,negated});
  }
 }
 if(!matches.length)return null;
 matches.sort((a,b)=>a.index-b.index||a.length-b.length);
 const positive=matches.filter(x=>!x.negated);
 if(!positive.length)return matches.some(m=>m.negated)?{id:"standard",label:dialects.find(d=>d.id==="standard").label}:null;
 const chosen=positive[positive.length-1].d;
 return {id:chosen.id,label:chosen.label};
}
function instruction(id){
 const d=dialects.find(x=>x.id===id);
 if(!d)return "Bahasa asas Melayu Malaysia santai; ikut loghat negeri apabila pengguna memintanya.";
 return [
  "LOGHAT AKTIF YANG DIPILIH PENGGUNA: "+d.label+".",
  "ARAHAN TERKINI MENGGANTIKAN SEPENUHNYA loghat terdahulu, bukan campur. Jangan guna kosa kata, partikel atau rentak loghat negeri sebelum ini walaupun muncul dalam sejarah sembang.",
  d.tip,
  "Kalau tak pasti istilah setempat, gunakan Melayu neutral, bukan dialek negeri sebelumnya. Kekalkan identiti Aksara, aku/kau, serta pertuturan tanpa emoji. Balas permintaan terkini hanya dalam gaya loghat aktif ini."
 ].join(" ");
}
const api=Object.freeze({detectRequest,instruction,label:id=>dialects.find(d=>d.id===id)?.label||"Bahasa Melayu santai"});
if(typeof module!=="undefined"&&module.exports)module.exports=api;
if(root)root.BilikAntaraDialek=api;
})(typeof window!=="undefined"?window:null);