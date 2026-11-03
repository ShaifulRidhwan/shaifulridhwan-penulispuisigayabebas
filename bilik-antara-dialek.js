(function(root){
"use strict";
/* Voice Chat v3: single source of truth for selectable Malaysian speech styles.
   Synthesized speech remains Gemini Live Aoede; dialect accuracy varies by model. */
const dialects=[
 {id:"auto",label:"Bahasa Melayu Santai",words:["bahasa melayu santai","bahasa santai","cakap biasa","melayu biasa","bahasa biasa","tanpa loghat","tak payah loghat","tak nak loghat"],tip:"Cakap bahasa Melayu Malaysia santai, mesra dan jelas. Gunakan aku/kau. Jangan paksa loghat negeri."},
 {id:"gaul",label:"Bahasa Gaul",words:["bahasa gaul","cakap gaul","gaya gaul","slang malaysia","slang melayu"],tip:"Cakap Melayu gaul Malaysia yang bersahaja. Ungkapan seperti do, lah, laa, wei, kot, kan dan jap boleh digunakan bila kena tempat. Jangan penuhkan setiap ayat dengan slang, jangan reka dialek atau meniru stereotaip. Kekalkan makna jelas dan adab."},
 {id:"baku",label:"Bahasa Melayu Baku",words:["bahasa baku","bahasa melayu baku","bahasa formal","melayu formal"],tip:"Cakap bahasa Melayu baku yang jelas dan natural, tetap gunakan aku/kau sebagai identiti Aksara."},
 {id:"utara",label:"Utara (umum)",words:["loghat utara","dialek utara","orang utara"],tip:"Gaya utara secara umum dan sederhana. Jangan campur Kelantan atau Sabah."},
 {id:"perlis",label:"Perlis",words:["perlis"],tip:"Gunakan gaya percakapan Melayu Perlis yang munasabah, jangan dakwa sebutan tepat jika model tidak mampu."},
 {id:"kedah",label:"Kedah",words:["kedah"],tip:"Gaya Melayu Kedah, dengan hang, depa, mai atau awat apabila bersesuaian. Jangan paksa setiap ayat."},
 {id:"pulau-pinang",label:"Pulau Pinang",words:["pulau pinang","penang","pineng"],tip:"Gaya percakapan Melayu Pulau Pinang yang munasabah; bezakan daripada negeri lain jika boleh."},
 {id:"perak",label:"Perak",words:["perak"],tip:"Gaya pertuturan Melayu Perak secara sederhana dan bersahaja."},
 {id:"selangor",label:"Selangor",words:["selangor"],tip:"Bahasa Melayu santai lembah Klang/Selangor, tidak berlebih-lebihan."},
 {id:"negeri-sembilan",label:"Negeri Sembilan",words:["negeri sembilan","nogori","nismilan"],tip:"Gunakan loghat Negeri Sembilan yang munasabah, tidak campur stereotaip."},
 {id:"melaka",label:"Melaka",words:["melaka"],tip:"Gunakan gaya Melayu Melaka yang natural dan tidak dibuat-buat."},
 {id:"johor",label:"Johor",words:["johor"],tip:"Gunakan gaya Melayu Johor yang natural."},
 {id:"pahang",label:"Pahang",words:["pahang"],tip:"Gunakan gaya Melayu Pahang yang munasabah, elakkan istilah yang tidak pasti."},
 {id:"terengganu",label:"Terengganu",words:["terengganu","ganu","tranung"],tip:"Gaya Terengganu; jangan samakan sepenuhnya dengan Kelantan."},
 {id:"kelantan",label:"Kelantan",words:["kelantan","kelate","klate"],tip:"Gaya Kelantan dengan kawe/demo jika sesuai. Jangan campur hang/depa Utara."},
 {id:"sabah",label:"Sabah",words:["sabah"],tip:"Gaya Melayu Sabah yang natural, jangan samakan dengan Sarawak atau semua bahasa peribumi Sabah."},
 {id:"sarawak",label:"Sarawak",words:["sarawak"],tip:"Gaya Melayu Sarawak yang natural, jangan samakan dengan Sabah atau semua bahasa peribumi Sarawak."},
 {id:"kuala-lumpur",label:"Kuala Lumpur",words:["kuala lumpur","kl"],tip:"Gaya Melayu Kuala Lumpur yang santai, tak perlu karikatur bahasa bandar."},
 {id:"putrajaya",label:"Putrajaya",words:["putrajaya"],tip:"Bahasa Melayu Malaysia santai yang biasa digunakan di Putrajaya."},
 {id:"labuan",label:"Labuan",words:["labuan"],tip:"Gaya Melayu Labuan yang munasabah; jangan dakwa ia seragam bagi semua penduduk."}
];
const normalize=value=>String(value||"").toLocaleLowerCase("ms-MY").normalize("NFD")
 .replace(/[\u0300-\u036f]/g,"").replace(/[^\p{L}\p{N}\s]/gu," ").replace(/\s+/g," ").trim();
const aliases=Object.freeze({"standard":"auto","negeri sembilan":"negeri-sembilan","penang":"pulau-pinang"});
const pick=id=>dialects.find(x=>x.id===(aliases[String(id||"").toLowerCase()]||id));
const forms=dialects.flatMap(d=>d.words.map(word=>({d,word,rx:new RegExp("(?:^|\\s)"+word+"(?=\\s|$)","g")})));
const commands=/(?:^|\s)(?:cuba|try|test|tukar|bertukar|beralih|alih|ganti|ubah|guna|pakai|cakap|bercakap|sembang|bertutur|balas|buat|ikut|switch|pilih)(?=\s|$)/;
function detectRequest(raw){
 const text=normalize(raw);
 if(!text||text.length>500)return null;
 const isCommand=commands.test(text)||/^(?:loghat|dialek|bahasa gaul)\s/.test(text)
  ||/(?:^|\s)(?:nak|mahu|mau|boleh)\s+(?:tak\s+)?(?:cuba|tukar|guna|pakai|cakap|bercakap|test|loghat|dialek)(?=\s|$)/.test(text);
 if(!isCommand)return null;
 const matches=[];
 for(const f of forms){
   f.rx.lastIndex=0;
   for(const m of text.matchAll(f.rx)){
     const index=m.index+m[0].length-f.word.length;
     const prefix=text.slice(Math.max(0,index-50),index).trim();
     const negated=f.d.id!=="auto"&&/(?:^|\s)(?:jangan|bukan|tak nak|tak mahu|tidak mahu|tanpa)(?:\s+(?:cakap|guna|pakai|buat|loghat|dialek|campur|campurkan|gabung|gabungkan|bawa|selit|selitkan)){0,2}$/.test(prefix);
     matches.push({d:f.d,index,length:f.word.length,negated});
   }
 }
 if(!matches.length)return null;
 matches.sort((a,b)=>a.index-b.index||a.length-b.length);
 const positive=matches.filter(x=>!x.negated);
 if(!positive.length)return matches.some(x=>x.negated)?{id:"auto",label:pick("auto").label}:null;
 const d=positive[positive.length-1].d;
 return {id:d.id,label:d.label};
}
function instruction(id){
 const d=pick(id)||pick("auto");
 return [
   "GAYA BAHASA VOICE YANG AKTIF: "+d.label+".",
   "Arahan ini menggantikan gaya sebelumnya. Jangan campur loghat yang bercanggah.",
   d.tip,
   "Gunakan identiti Aksara, aku/kau, pertuturan tanpa emoji. Gaya hanya mempengaruhi perkataan dan ritma, bukan suara sintesis Aoede.",
   "Jika model tidak fasih pada loghat khusus, utamakan sebutan yang boleh difahami dan Melayu santai, bukannya meneka istilah tempatan."
 ].join(" ");
}
const options=Object.freeze(dialects.map(({id,label})=>Object.freeze({id,label})));
const api=Object.freeze({detectRequest,instruction,options,has:id=>Boolean(pick(id)),label:id=>(pick(id)||pick("auto")).label});
if(typeof module!=="undefined"&&module.exports)module.exports=api;
if(root)root.BilikAntaraDialek=api;
})(typeof window!=="undefined"?window:null);
