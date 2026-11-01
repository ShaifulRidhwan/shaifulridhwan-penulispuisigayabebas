"use strict";
// Grounded public-poetry answers; authored archive is the only source of quote text.
const index=require("../../karya-index.json");
const {poemMatches}=require("./antara-intelligence");
const HOME="https://shaifulridhwan-penulispuisigayabebas.netlify.app/";
const meanings={
 "TRAGEDI SESEORANG MENCINTAIMU":"Puisi ini membezakan kebolehan menyayangi orang lain daripada kesediaan mempercayai bahawa diri sendiri layak disayangi.",
 "TERLALU LAMA MENJADI KUAT":"Beban memenuhi keperluan orang lain boleh mengaburkan identiti dan keperluan diri sendiri.",
 "ANTARA KLASIK BAHASA PASAR":"Percanggahan antara bahasa klasik dengan bahasa santai sebenarnya menjadi cara pencerita mencari suaranya sendiri.",
 "LANGIT YANG TIDAK SAMA":"Langit menandakan perbezaan dunia dan kemungkinan; cinta tidak semestinya menjanjikan kehidupan bersama.",
 "TIDAK PERNAH TIDAK AKAN":"Pencerita mempertahankan pilihan hatinya walaupun wujud pertentangan antara rasa, akal dan batas yang dipercayainya.",
 "LUKA YANG TAK BERSUARA":"Ketabahan yang dilihat orang luar mungkin menyembunyikan beban emosi yang sukar dijelaskan.",
 "YANG TINGGAL HANYA MASA":"Perpisahan boleh meninggalkan kerinduan bukan sahaja terhadap seseorang, tetapi juga terhadap masa yang pernah dikongsi.",
 "DUA SISI DALAM DIRI":"Akal dan hati tidak seharusnya saling menafikan; mendengar satu pihak sahaja boleh menghilangkan keseimbangan diri.",
 "SEBUAH SENI KEBOHONGAN":"Surat yang pudar melambangkan maklumat yang tidak lengkap; manusia kadangkala melengkapkan ruang kosong dengan kepercayaan sendiri.",
 "PARADOKS TERLALU MANUSIA":"Manusia boleh menginginkan ruang peribadi sambil tetap mahu dirindui; keperluan yang bertentangan itu tidak mudah dihukum.",
 "AKSARA KUNO YANG DILUPAKAN":"Peralihan Rencong, Jawi dan Rumi menunjukkan sejarah tulisan; yang dipersoalkan ialah hubungan kita dengan warisan bacaan.",
 "SESUATU YANG DIPAKSA DIAM":"Pencerita mempersoalkan kebiasaan menahan perasaan dan mengingatkan pentingnya memberikan ruang kepada diri sendiri.",
 "YANG TIDAK PERLU DIDIRIKAN":"Keindahan tidak selalu terletak pada binaan yang megah; kehadiran seseorang boleh mengubah ukuran keindahan.",
 "RESONANS AKSARA":"Istilah resonans menghubungkan sains dan sastera untuk menunjukkan bagaimana pertemuan mengubah bahasa dan arah perasaan.",
 "BILA BEBAS SEDIKIT TERSESAT":"Pencarian intelektual akhirnya bertemu dengan pengakuan bahawa akal mempunyai batas dan iman turut memberi kerangka makna.",
 "TRAGEDI TERLALU MEMAHAMI":"Usaha memahami alasan orang lain boleh menjadi cara menangguhkan keputusan untuk melindungi diri.",
 "ANTARA DOSA DAN TAUBAT":"Diksi klasik menggambarkan pertentangan antara kesilapan, penyesalan dan harapan untuk kembali kepada rahmat Tuhan.",
 "PENYATA TANPA AUDIT":"Bahasa perakaunan menjadi metafora untuk cinta yang tidak boleh disahkan melalui kiraan dan bukti seperti transaksi.",
 "MEMILIH SISI BURUK":"Cermin retak menggambarkan pilihan cara melihat diri; perubahan bermula apabila seseorang menyoal identiti lama yang memerangkapnya.",
 "MEMILIH SISI KUAT":"Fail dan arahan delete menjadi metafora pengalaman lama; melepaskan pola yang tidak membantu memerlukan keberanian.",
 "ANTARA CAHAYA DAN GELAP":"Catatan ringkas ini menolak pilihan mutlak antara dua kutub; ruang di antaranya menjadi tempat manusia memahami kehidupan.",
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
