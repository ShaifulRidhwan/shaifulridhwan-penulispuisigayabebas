"use strict";
/*
 * AKSARA Thinking Architecture 3.0, request-local and deterministic.
 * Both presentation modes share the same model router, facts and privacy rules.
 * No provider calls, persistent memory or hidden reasoning transcript.
 */
const RANK=Object.freeze({low:0,medium:1,high:2});
const GENERIC_REFLECTIVE=/\b(?:manusia|kebenaran|kepercayaan|jujur)\b/i;
const DEEP_SIGNALS=/(?:\b(?:falsafah|filosofi|eksistensial|absurd|nihilis|epistemologi|paradoks|moral|etika|hipokrasi|premis|bantahan|percanggahan|kontradiksi|kritik|analisis|bandingkan|banding|bukti|hujah|trade.off|alternatif|andaian|risiko)\b|makna hidup|tujuan hidup|mengapa.*wujud|pura.pura|kepura.puraan|secara mendalam|terperinci|langkah demi langkah|dua perspektif)/i;
const SIMPLE_FACT=/^(?:apa|apakah|siapa|bila|bilakah|di mana|kenapa|mengapa|bagaimana|berapa|what|why|how)\b/i;
const EMOTION_SAFETY=/(?:\bsedih\b|\bkrisis\b|\bbahaya\b|\bkecemasan\b|\btrauma\b|\bpanik\b)/i;
const CHALLENGE=/(?:\b(?:kritik|sanggah|bantah|debat|hujah|premis|bukti|kontradiksi|percanggahan|dakwaan|sahih|hipokrasi)\b|betul ke|benarkah|uji (?:idea|logik|hujah)|cari kelemahan)/i;
const NEW_EVIDENCE=/(?:\b(?:bukti|rujukan|sumber|dokumen|laporan|log|data|kajian|statistik|screenshot|tangkapan skrin)\b|sebenarnya ada bukti)/i;
const CORRECTION=/(?:\b(?:silap|ralat|betulkan|pembetulan|salah|bukan)\b|maksud aku|aku maksudkan|sebenarnya)/i;
function normalized(value){return value==="gelap"?"gelap":"cahaya";}
function depth({question="",mode="cahaya",intent={},profile={},base={}}={}){
 const q=String(question||"").trim().slice(0,32000);
 const current=RANK[base.thinkingLevel]===undefined?"low":base.thinkingLevel;
 const soft={...base};
 if(!q||intent.sensitive||intent.task==="support"||EMOTION_SAFETY.test(q)||intent.simpleCalculation||intent.reaction)
  return {plan:soft,reason:"existing_sensitive_or_simple_contract",raised:false};
 const complex=DEEP_SIGNALS.test(q)||["argument","decision","philosophy","debugging","research"].includes(profile.focus)||
  intent.task==="critique"||intent.task==="hypothetical"||intent.depth==="high"||intent.attachment;
 const ordinaryShort= q.length<=105&&SIMPLE_FACT.test(q)&&!complex;
 const veryShort= q.length<=38&&/^(?:woi|hai|hello|hi|hmm+|okay|ok|baik|apa khabar|cerita sikit)[!?.\s]*$/i.test(q);
 // Prevent keyword-only philosophy inflation for "kenapa manusia tidur".
 if(ordinaryShort||veryShort){
  const floor=ordinaryShort&&intent.task==="explain"?"medium":"low";
  const downgrade=RANK[current]>RANK[floor]?floor:current;
  return {plan:{...soft,thinkingLevel:downgrade,maxTokens:Math.min(Number(soft.maxTokens)||3200,3200)},
   reason:"short_direct_question",raised:false};
 }
 const needsHigh=complex&&(
  ["critique","hypothetical"].includes(intent.task)||
  ["argument","decision","philosophy"].includes(profile.focus)&&(
   intent.depth==="high"||q.length>110||CHALLENGE.test(q))||
  /(?:mendalam|terperinci|secara kritis|uji hujah|semak premis|kontradiksi)/i.test(q)
 );
 const target=needsHigh?"high":complex?"medium":current;
 const chosen=RANK[target]>RANK[current]?target:current;
 // GELAP is more challenging only when justified by the task, not by "manusia" alone.
 const level=normalized(mode)==="gelap"&&GENERIC_REFLECTIVE.test(q)&&!DEEP_SIGNALS.test(q)&&
  ["general","explain"].includes(intent.task)&&profile.focus==="general"?
  (RANK[current]===2?"medium":current):chosen;
 const max=level==="high"?Math.max(Number(soft.maxTokens)||0,5600):
  level==="medium"?Math.max(Number(soft.maxTokens)||0,3400):Number(soft.maxTokens)||2500;
 return {plan:{...soft,thinkingLevel:level,maxTokens:max},reason:needsHigh?"multi_step_or_argument":complex?"task_complexity":"original_plan",
  raised:RANK[level]>RANK[current]};
}
function dualPerspective(question,{sensitive=false}={}){
 if(sensitive)return false;
 const q=String(question||"").trim().slice(0,1200);
 if(!q||EMOTION_SAFETY.test(q))return false;
 // Only explicit requests; mentioning "cahaya" and "gelap" in a poem is not consent.
 if(/(?:\b(?:dua|kedua.dua|both)\s+(?:sudut|perspektif|pandangan|mod|mode)\b|\bdual perspective\b)/i.test(q))
  return /(?:\b(?:jawab|ulas|huraikan|analisis|jelaskan|beri|berikan|tunjuk|lihat|nilai|bandingkan|cuba|pandangan)\b|dua sudut|dual perspective)/i.test(q);
 if(/(?:\bcahaya\b.{0,48}\bgelap\b|\bgelap\b.{0,48}\bcahaya\b)/i.test(q))
  return /(?:\b(?:jawab|analisis|ulas|huraikan|perspektif|sudut|dua mod|both modes)\b)/i.test(q)&&
   !/^(?:apa|apakah)\s+(?:beza|perbezaan|itu|maksud)\s+(?:mod|mode)?\s*(?:cahaya|gelap)/i.test(q);
 return false;
}
function argumentGuidance({question="",intent={},profile={},mode="cahaya"}={}){
 if(intent.sensitive||intent.task==="support"||intent.task==="creative")return "";
 const challenge=intent.task==="critique"||profile.focus==="argument"||
  (CHALLENGE.test(question)&&/^(?:kritik|sanggah|bantah|semak|uji|nilai|adakah|benarkah)/i.test(String(question).trim()));
 if(!challenge)return "";
 const dark=normalized(mode)==="gelap";
 return "\nINTEGRITI HUJAH 3.0: Kenal pasti dakwaan utama, andaian yang diperlukan, bukti yang benar-benar ada, bantahan terkuat dan kesimpulan bersyarat. Jangan paparkan lima label secara mekanikal jika satu ayat sudah cukup. "+(dark?"Jangan bantah dakwaan yang benar semata-mata untuk kelihatan kritis.":"Terangkan bantahan dengan bahasa praktikal dan mudah difahami.")+
  " Bezakan korelasi daripada sebab-akibat. Jangan reka sumber, motivasi orang atau statistik.";
}
function continuityGuidance(history){
 const rows=Array.isArray(history)?history.filter(x=>x&&["assistant","user"].includes(x.role)&&typeof x.content==="string").slice(-12):[];
 if(rows.length<2)return "";
 // Never serialize a new copy of the history or store remembered user traits.
 return "\nKONSISTENSI RENTAS MOD 3.0: Gunakan fakta dan pembetulan yang sudah ada dalam sejarah permintaan. Jika pengguna bertukar CAHAYA/GELAP, gaya dan fokus analisis boleh berubah, tetapi fakta yang disokong, keputusan pengguna dan had sumber tidak berubah tanpa bukti baharu. Jika jawapan terdahulu salah, akui dan betulkan secara jelas. Jangan dakwa mempunyai sejarah yang tidak dihantar.";
}
function stanceGuidance({question="",history=[],mode="cahaya",sensitive=false}={}){
 if(sensitive)return "";
 const q=String(question||"");
 const previous=Array.isArray(history)&&history.some(x=>x?.role==="assistant");
 if(!previous)return "";
 const correction=CORRECTION.test(q),evidence=NEW_EVIDENCE.test(q),challenge=CHALLENGE.test(q);
 if(!correction&&!challenge&&!evidence)return "";
 return "\nKONSISTENSI PENDIRIAN 3.0: "+(correction?"Semak teguran terhadap jawapan terdahulu dan betulkan kesilapan sebenar tanpa mempertahankan ego. ":"")+
  (evidence?"Pengguna mungkin memberi bukti baharu; periksa kandungan dan kesahihan sebelum mengubah kesimpulan. ":"")+
  (challenge?"Kritik dakwaan dengan alasan yang dapat diperiksa, bukan kerana tekanan atau cabaran berulang. ":"")+
  (normalized(mode)==="gelap"?"Jangan menjadi pembangkang automatik. ":"")+
  "Jika tiada bukti baharu, jangan mengubah kepastian hanya kerana dakwaan diulang.";
}
function evidenceGuidance({question="",intent={},research={},sources=[],ownedPage=false}={}){
 if(intent.sensitive||intent.task==="support")return "";
 const status=String(research?.status||"");
 const n=Array.isArray(sources)?sources.length:0;
 if(!intent.search&&!intent.hasLink&&!CHALLENGE.test(question))return "";
 const read=!!ownedPage||status==="page-read";
 const query=n?read?"page_text":"search_excerpt":"no_external_evidence";
 const rule=query==="page_text"?
  "Teks halaman awam telah diterima sebagai data. Itu bukan bukti semakan visual, ketepatan semua dakwaan atau perilaku runtime.":
  query==="search_excerpt"?
  "Rujukan carian hanya petikan atau metadata. Jangan dakwa kandungan penuh URL telah dibaca.":
  "Tiada sumber luar yang berjaya diperoleh setakat ini. Jangan dakwa carian web berjaya atau fakta terkini telah diverifikasi.";
 return "\nDISIPLIN SUMBER 3.0 ("+query+"): "+rule+
  " Asingkan fakta daripada tafsiran. Audit padanan kata v5 bukan verifikasi kebenaran.";
}
function dualGuidance(active){
 return !active?"":"\nDUAL PERSPECTIVE 3.0: Pengguna secara jelas meminta dua sudut. Jawab dalam SATU respons model, dengan dua tajuk tepat: **CAHAYA** dan **GELAP**. CAHAYA ringkas, mudah dan praktikal. GELAP memeriksa premis dan bantahan berasas tanpa bercanggah fakta. Kedua-duanya mesti berkongsi bukti, tarikh, keputusan dan had yang sama. Bezakan interpretasi, bukan menggandakan fakta atau mengarang sumber. Jangan dakwa dua model API, dua panggilan bebas atau semakan berasingan. Selepas dua sudut, rumusan satu ayat jika membantu.";
}
function planRequest({question="",mode="cahaya",intent={},profile={},plan={},history=[],research={},sources=[],ownedPage=false}={}){
 const selected=depth({question,mode,intent,profile,base:plan});
 const dual=dualPerspective(question,{sensitive:!!(intent.sensitive||intent.task==="support")});
 return {plan:selected.plan,reason:selected.reason,dualPerspective:dual,
  guidance:[argumentGuidance({question,intent,profile,mode}),continuityGuidance(history),
   stanceGuidance({question,history,mode,sensitive:!!intent.sensitive}),
   evidenceGuidance({question,intent,research,sources,ownedPage}),dualGuidance(dual)].filter(Boolean).join("\n"),
  evidenceState:ownedPage||research?.status==="page-read"?"page_text":
    Array.isArray(sources)&&sources.length?"search_excerpt":"no_external_evidence"};
}
module.exports={depth,dualPerspective,argumentGuidance,continuityGuidance,stanceGuidance,evidenceGuidance,dualGuidance,planRequest};
