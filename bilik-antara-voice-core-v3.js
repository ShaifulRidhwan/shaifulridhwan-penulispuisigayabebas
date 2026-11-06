(function(root,factory){
"use strict";
const api=factory();
if(typeof module!=="undefined"&&module.exports)module.exports=api;
if(root)root.AksaraVoiceCoreV3=api;
})(typeof window!=="undefined"?window:null,function(){
"use strict";
/* Pure, privacy-preserving Voice 3.0 helpers. No audio, transcripts or keys are stored. */
const clean=value=>String(value||"")
 .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\uFE0F\u200D\u20E3]/gu,"")
 .replace(/\s+/g," ").trim();
function conversationContext(history=[],limit=12,maxChars=4600){
 const arr=Array.isArray(history)?history:[];
 const safe=arr.slice(-Math.max(1,Math.min(24,limit))).filter(x=>x&&(x.role==="user"||x.role==="assistant"))
   .map(x=>({role:x.role,content:clean(x.content).slice(0,450)})).filter(x=>x.content);
 return JSON.stringify(safe).slice(0,Math.max(400,Math.min(6000,maxChars)));
}
function mergeTranscript(previous="",incoming="",maxChars=2800){
 const before=clean(previous),after=clean(incoming);
 if(!after)return before.slice(-maxChars);
 if(!before||after.startsWith(before))return after.slice(-maxChars);
 if(before.startsWith(after))return before.slice(-maxChars);
 if(before.endsWith(after)||before.includes(after)&&after.length>=16)return before.slice(-maxChars);
 let overlap=0;
 for(let n=Math.min(before.length,after.length);n>0;n--){if(before.endsWith(after.slice(0,n))){overlap=n;break;}}
 const merged=overlap?before+after.slice(overlap):before+" "+after;
 return merged.slice(-Math.max(400,Math.min(6000,maxChars)));
}
function replyGuidance(mode="cahaya"){
 const common=[
  "VOICE V3: dengar ayat hingga lengkap, faham soalan susulan melalui topik terkini dan jangan reka fakta.",
  "Jawapan pertuturan mesti terdengar seperti dialog: jelas, terus dan tidak membaca Markdown, emoji atau simbol teknikal.",
  "Soalan mudah boleh dijawab ringkas tetapi lengkap. Soalan yang meminta sebab, cara, contoh, analisis atau penjelasan mendalam memerlukan hujah yang cukup; jangan memotong penjelasan hanya kerana mod suara.",
  "KATA SUSULAN: lagi, apa lagi, sambung, teruskan, jelaskan, tolong jelaskan, tak tahu pasal dia, kenapa, macam mana, yang tadi dan dia merujuk topik terkini. Semak giliran terakhir sebelum memilih tafsiran. Jika jelas, teruskan tanpa bertanya semula.",
  "APABILA SAMBUNG: tambah fakta atau sudut yang belum disentuh, contohnya karya, proses, teknik, sebab, kekangan atau contoh. Jangan ulang biografi, ayat pengenalan, rumusan atau gurauan yang sama. Pengulangan tak jadi baharu hanya kerana perkataan diubah.",
  "Jika pengguna membetulkan tafsiran, ikut pembetulan itu dan jangan pertahankan tekaan terdahulu. Jika benar-benar kabur selepas memeriksa konteks, tanya satu soalan pendek sahaja.",
  "Jangan beralih ke topik atau loghat baharu apabila diminta lagi atau sambung. Gaya hanya berubah selepas permintaan jelas atau pilihan gaya pada UI. Jika jawapan panjang, pecahkan mengikut idea tanpa pengakhiran berulang.",
  "Gunakan intonasi semula jadi, tunggu giliran pengguna, hormati arahan berhenti atau membisu, jangan berpura-pura mendengar apabila mikrofon dimatikan.",
  "Bezakan fakta, andaian dan maklumat semasa yang belum disemak. Jika diperlukan rujukan luar yang tiada dalam Voice, nyatakan had itu."
 ];
 if(mode==="gelap")common.push("MOD GELAP: kritikal, teliti andaian dan hujah balas dengan jelas; berani membetulkan pengguna secara hormat. Beri alasan yang boleh diuji, bukan bersetuju secara membuta tuli.");
 else common.push("MOD CAHAYA: ramah, membantu dan terangkan secara mendalam apabila soalan memerlukannya. Jangan jadi terlalu ringkas atau sekadar mengiyakan.");
 return common.join(" ");
}
function reconnectDelay(attempt=0){const count=Math.max(0,Math.min(5,Math.trunc(Number(attempt)||0)));return Math.min(6000,800*2**count);}
function phaseFromStatus(value){
 const s=String(value||"").toLowerCase();
 if(/tutup|dijeda|latar|pause/.test(s))return "paused";
 if(/gagal|tak dapat|ditolak|error|terputus$/.test(s))return "error";
 if(/renew|sambung semula|connect balik|cuba pulihkan|connection|menyambung/.test(s))return "connecting";
 if(/tengah jawab|habiskan jawapan|sedang bercakap/.test(s))return "speaking";
 if(/fikir|menjawab|sekejap aku jawab/.test(s))return "thinking";
 if(/dengar|connected|boleh sambung/.test(s))return "listening";
 return "idle";
}
return Object.freeze({conversationContext,mergeTranscript,replyGuidance,reconnectDelay,phaseFromStatus});
});
