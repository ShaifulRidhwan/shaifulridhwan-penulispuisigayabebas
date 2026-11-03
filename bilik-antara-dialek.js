(function(root){
"use strict";
/* Voice Chat v3: single source of truth for selectable Malaysian speech styles.
   Synthesized speech remains Gemini Live Aoede; dialect accuracy varies by model. */
const dialects=[
 {id:"gaul",label:"Bahasa Gaul",words:["bahasa gaul","bahasa santai","bahasa melayu santai","melayu santai","cakap biasa","melayu biasa","tanpa loghat","tak nak loghat","tak payah loghat"],tip:"Cakap Melayu gaul Malaysia secara natural dan bersahaja. Guna do, lah, laa, wei, kot, kan, jap dan seumpamanya bila tepat pada tempatnya. Jangan sumbat setiap ayat dengan slang atau jadi parodi; kekalkan jelas, beradab dan mesra."},
 {id:"perak",label:"Perak",words:["perak"],tip:"Gunakan loghat Melayu Perak yang munasabah secara sederhana, jangan tiru loghat negeri lain."},
 {id:"kedah-penang",label:"Kedah & Penang",words:["kedah","penang","pulau pinang","pineng","utara"],tip:"Gunakan gaya Kedah atau Pulau Pinang yang bersesuaian dengan pertuturan pengguna. Hang, depa, mai dan awat boleh muncul secara semula jadi. Kedua-duanya tidak semestinya serupa, jadi elakkan mendakwa aksen tepat; jangan selit Kelantan."},
 {id:"kelantan",label:"Kelantan",words:["kelantan","kelate","klate"],tip:"Gunakan gaya Kelantan yang natural; kawe/demo boleh digunakan apabila sesuai, jangan campur kosa kata Kedah."},
 {id:"terengganu",label:"Terengganu",words:["terengganu","ganu","tranung"],tip:"Gunakan gaya Terengganu dengan berhati-hati dan jangan samakan dengan Kelantan."},
 {id:"negeri-sembilan",label:"Negeri Sembilan",words:["negeri sembilan","nogori","nismilan"],tip:"Gunakan loghat Negeri Sembilan secara sederhana dan tepat apabila mampu."},
 {id:"sabah",label:"Sabah",words:["sabah"],tip:"Gunakan gaya Melayu Sabah yang natural, jangan campur Sarawak atau menyamakan semua bahasa tempatan."},
 {id:"sarawak",label:"Sarawak",words:["sarawak"],tip:"Gunakan gaya Melayu Sarawak yang natural, jangan campur Sabah atau menyamakan semua bahasa tempatan."}
];
const normalize=value=>String(value||"").toLocaleLowerCase("ms-MY").normalize("NFD")
 .replace(/[\u0300-\u036f]/g,"").replace(/[^\p{L}\p{N}\s]/gu," ").replace(/\s+/g," ").trim();
const aliases=Object.freeze({"standard":"gaul","auto":"gaul","baku":"gaul","kedah":"kedah-penang","pulau-pinang":"kedah-penang","utara":"kedah-penang","negeri sembilan":"negeri-sembilan"});
const pick=id=>dialects.find(x=>x.id===(aliases[String(id||"").toLowerCase()]||String(id||"").toLowerCase()));
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
     const negated=f.d.id!=="gaul"&&/(?:^|\s)(?:jangan|bukan|tak nak|tak mahu|tidak mahu|tanpa)(?:\s+(?:cakap|guna|pakai|buat|loghat|dialek|campur|campurkan|gabung|gabungkan|bawa|selit|selitkan)){0,2}$/.test(prefix);
     matches.push({d:f.d,index,length:f.word.length,negated});
   }
 }
 if(!matches.length)return null;
 matches.sort((a,b)=>a.index-b.index||a.length-b.length);
 const positive=matches.filter(x=>!x.negated);
 if(!positive.length)return matches.some(x=>x.negated)?{id:"gaul",label:pick("gaul").label}:null;
 const d=positive[positive.length-1].d;
 return {id:d.id,label:d.label};
}
function instruction(id){
 const d=pick(id)||pick("gaul");
 return [
   "GAYA BAHASA VOICE YANG AKTIF: "+d.label+".",
   "Arahan ini menggantikan gaya sebelumnya. Jangan campur loghat yang bercanggah.",
   d.tip,
   "Gunakan identiti Aksara, aku/kau, pertuturan tanpa emoji. Gaya hanya mempengaruhi perkataan dan ritma, bukan suara sintesis Aoede.",
   "Jika model tidak fasih pada loghat khusus, utamakan sebutan yang boleh difahami dan Melayu santai, bukannya meneka istilah tempatan."
 ].join(" ");
}
const options=Object.freeze(dialects.map(({id,label})=>Object.freeze({id,label})));
const api=Object.freeze({detectRequest,instruction,options,has:id=>Boolean(pick(id)),label:id=>(pick(id)||pick("gaul")).label});
if(typeof module!=="undefined"&&module.exports)module.exports=api;
if(root)root.BilikAntaraDialek=api;
})(typeof window!=="undefined"?window:null);
