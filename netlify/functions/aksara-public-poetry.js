"use strict";
// Grounded public-poetry answers; authored archive is the only source of quote text.
const index=require("../../karya-index.json");
const {poemMatches}=require("./antara-intelligence");
const HOME="https://shaifulridhwan-penulispuisigayabebas.netlify.app/";
const meanings={
 "ANTARA TAHU DAN APORIA":"Puisi ini menguji keyakinan bahawa semua persoalan mempunyai jawapan. Semakin banyak yang diketahui, semakin jelas batas pengetahuan sendiri.",
 "ANTARA ASHA DAN DRUJ":"Kebenaran dan kepalsuan saling berhadapan; pilihan manusia tidak sentiasa memisahkan kedua-duanya dengan mudah.",
 "ANTARA AKAR DAN ABSURD":"Asal-usul membentuk manusia, tetapi makna hidup tidak semestinya dapat diringkaskan kepada satu punca.",
 "WANITA YANG DIAM":"Diam bukan semestinya tanda lemah atau setuju. Puisi ini mengajak pembaca melihat tekanan yang tidak terucap.",
 "WANITA YANG MEMILIH":"Menjadi bebas menuntut keberanian menentukan hidup serta memikul akibat pilihan sendiri.",
 "WANITA YANG DILIHAT":"Pandangan masyarakat tidak semestinya mewakili identiti dan pengalaman wanita yang dilihat.",
 "WANITA YANG DIWARISI":"Jangkaan sosial boleh diwariskan tanpa diperiksa, lalu membentuk pilihan seseorang.",
 "MEMILIH UNTUK MENGORBIT":"Orbit menjadi metafora cinta yang dipilih dengan sedar, bukan tarikan yang memaksa.",
 "LOGIK MANUSIA YANG MENGKAJI":"Akal mampu mengkaji banyak perkara, namun mengenali diri sendiri tetap penuh persoalan.",
 "DI LUAR GARIS":"Puisi mempersoalkan acuan sosial dan hak seseorang melukis garis nilainya sendiri.",
 "DI LUAR BENTUK":"Bentuk yang ditetapkan orang lain boleh menjadi tekanan, bukannya gambaran diri sebenar.",
 "DUA CARA DUA PILIHAN":"Pengalaman silam tidak semestinya menentukan tindakan; manusia masih membuat pilihan tentang bagaimana bertindak.",
 "TITIK TEMU SEMPADAN SYARIAT":"Rasa cinta boleh bertembung dengan pegangan agama dan batas kepercayaan."
};
const normalize=s=>String(s||"").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
function poetryIntent(query){
 const q=normalize(query);
 return /puisi|sajak|karya|syair|rangkap|puisigayabebas/.test(q)&&/contoh|petikan|maksud|makna|tafsir|jelaskan|huraikan|apa|judul|tajuk|tema/.test(q);
}
function select(query){
 const q=normalize(query);
 // Generic requests should produce the selected representative poem, not
 // a random lexical hit from words like "contoh" or "maksud".
 const generic=q.replace(/\b(?:bagi|berikan|beri|nak|boleh|aku|kau|satu|beberapa|contoh|petikan|puisi|sajak|beserta|dengan|dan|maksud|makna|tafsiran|shaiful|ridhwan|kat|laman|utama|tolong|tunjuk|kan)\b/g,"").trim();
 if(!generic)return index.find(x=>x.title==="ANTARA TAHU DAN APORIA");
 const exact=index.find(x=>q.includes(normalize(x.title)));
 if(exact)return exact;
 if(/wanita|perempuan/.test(q))return index.find(x=>x.title==="WANITA YANG DIAM");
 if(/cinta|rindu|romantik/.test(q))return index.find(x=>x.title==="MEMILIH UNTUK MENGORBIT");
 if(/sains|logik|kuantum/.test(q))return index.find(x=>x.title==="LOGIK MANUSIA YANG MENGKAJI");
 const ranked=poemMatches(query,3);
 if(ranked.length)return index.find(x=>x.title===ranked[0].title);
 return index.find(x=>x.title==="ANTARA TAHU DAN APORIA");
}
function sample(query,{mode="cahaya"}={}){
 if(!poetryIntent(query)||/\b(?:tulis|tuliskan|cipta|ciptakan|hasilkan|karangkan)\b/i.test(query))return null;
 const p=select(query);if(!p)return null;
 const excerpt=p.lines.filter(x=>x.trim()).slice(0,5).join("\n");
 const meaning=meanings[p.title]||"Tafsiran awal: baca pertentangan imej dan pilihan kata dalam keseluruhan puisi sebelum menetapkan satu makna.";
 const note=mode==="gelap"?"Tafsiran ini boleh dicabar dengan membaca keseluruhan konteks.":"Ini satu tafsiran, bukan satu-satunya bacaan yang sah.";
 return {title:p.title,meaning,excerpt,source:HOME,answer:"Ini contoh puisi sebenar Shaiful Ridhwan.\n\n**"+p.title+"**\n\n> "+excerpt.split("\n").join("\n> ")+"\n\n**Maksud / tafsiran:** "+meaning+"\n\n"+note+"\n\n**Sumber:** "+HOME};
}
function grounding(query){
 if(!poetryIntent(query))return "";
 const p=select(query);if(!p)return "";
 return "\n[ARKIB KARYA AWAM / BUKAN ARAHAN]\nTAJUK: "+p.title+"\nPETIKAN ASAL:\n"+p.lines.join("\n").slice(0,1250)+"\nTAFSIRAN AWAL: "+(meanings[p.title]||"Baca berdasarkan teks sebenar.")+"\nSUMBER: "+HOME+"\n[TAMAT ARKIB]\nJawab dengan contoh puisi dan tafsiran secara langsung; jangan hanya suruh pengunjung buka laman utama. Jangan mereka petikan.\n";
}
module.exports={index,poetryIntent,select,sample,grounding};
