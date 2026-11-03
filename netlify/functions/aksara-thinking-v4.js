"use strict";
/* Thinking V4: one request-local reasoning plan and independent answer depth.
 * No network calls, persistence, private reasoning transcript or automatic rerun.
 */
const V3=require("./aksara-thinking-v3");
const DETAIL=/(?:detail|terperinci|mendalam|perincian|perincikan|panjang lebar|kupas|huraikan|elaborate|in.depth|thorough|jelaskan lagi|terangkan lagi|explain lebih|lebih jelas|jelaskan lebih|terangkan lebih|lebih panjang|lebih detail|langkah demi langkah|jangan ringkas|tak nak ringkas|tak mahu ringkas)/i;
const SHORT=/(?:ringkaskan|secara ringkas|jawab ringkas|jawab pendek|jawab padat|satu ayat|1 ayat|tl;dr|brief|tak perlu panjang|jangan panjang)/i;
const FOLLOWUP=/^(?:lagi|sambung|teruskan|lanjutkan|jelaskan lagi|terangkan lagi|lebih detail|lebih mendalam|lebih terperinci)[?.!\s]*$/i;
const COMPLEX=new Set(["explain","technical","research","critique","hypothetical"]);
function answerDepth({question="",intent={},history=[]}={}){
 const q=String(question||"").trim().slice(0,32000);
 const hasHistory=Array.isArray(history)&&history.some(x=>x?.role==="assistant");
 if(intent.reaction)return {level:"ringkas",reason:"reaction",explicit:false};
 if(intent.sensitive||intent.task==="support"||intent.simpleCalculation)
  return {level:"berisi",reason:"sensitive_or_simple",explicit:false};
 if(DETAIL.test(q)||(hasHistory&&FOLLOWUP.test(q)))
  return {level:"mendalam",reason:hasHistory&&FOLLOWUP.test(q)?"detailed_followup":"explicit_detail",explicit:true};
 if(SHORT.test(q))return {level:"ringkas",reason:"explicit_short",explicit:true};
 return {level:"berisi",reason:COMPLEX.has(intent.task)?"substantive_explanation":"default",explicit:false};
}
function planRequest({question="",mode="cahaya",intent={},profile={},basePlan={},history=[]}={}){
 const depth=V3.depth({question,mode,intent,profile,base:basePlan});
 const verbosity=answerDepth({question,intent,history});
 let effort=depth.plan.thinkingLevel;
 // Carry over the old effective model effort, but report it consistently.
 if(effort==="low"&&["creative","explain","technical"].includes(intent.task)&&
   !intent.simpleCalculation&&!intent.reaction&&!intent.sensitive)effort="medium";
 const tokens=Math.max(Number(depth.plan.maxTokens)||2500,
  verbosity.level==="mendalam"&&!intent.sensitive?4400:0);
 return Object.freeze({
  plan:{...depth.plan,thinkingLevel:effort,maxTokens:tokens},
  effort,reason:depth.reason,answerDepth:verbosity.level,
  depthReason:verbosity.reason,explicitDetail:verbosity.level==="mendalam"&&verbosity.explicit,
  dualPerspective:V3.dualPerspective(question,{sensitive:!!(intent.sensitive||intent.task==="support")}),
  mode:mode==="gelap"?"gelap":"cahaya"});
}
function answerGuidance(request,{intent={},history=[]}={}){
 if(intent.sensitive||intent.task==="support"||intent.simpleCalculation)return "";
 if(intent.task==="creative")
  return "\nKELENGKAPAN KARYA 4.0: Ikut genre, format, bilangan bahagian dan panjang yang diminta. Jangan menukar karya menjadi penerangan.";
 if(request.answerDepth==="ringkas")
  return "\nPANJANG JAWAPAN 4.0 (RINGKAS): Pengguna mahu jawapan padat. Berikan inti dan cukup alasan tanpa meleret.";
 if(request.answerDepth==="mendalam")
  return "\nPANJANG JAWAPAN 4.0 (MENDALAM): Pengguna meminta penerangan LEBIH LENGKAP. Jangan jawab satu atau dua ayat, jangan sekadar parafrasa respons terdahulu. Berikan jawapan terus, sebab/mekanisme, beberapa sudut relevan, contoh konkrit yang tepat apabila sesuai, implikasi dan batas penting. Lazimnya 3–6 perenggan berisi bagi soalan penerangan, bukan kuota wajib. Jangan cipta fakta atau pengisi."+
   (Array.isArray(history)&&history.some(x=>x?.role==="assistant")?
     " Susulan ini perlu MENAMBAH isi baharu yang tiada dalam respons sebelumnya.":"");
 return "\nPANJANG JAWAPAN 4.0 (BERISI): CAHAYA bukan bermaksud jawapan pendek dan GELAP bukan bermaksud esei panjang. Jawab inti dahulu, beri sebab atau mekanisme dan contoh jika soalan perlu penerangan. Untuk soalan terbuka, 2–4 perenggan yang bermakna biasanya sesuai; untuk fakta mudah, jawab terus. Jangan potong isi kerana soalan pengguna ringkas.";
}
function argumentVerification({question="",intent={},profile={}}={}){
 if(intent.sensitive||intent.task==="support"||intent.task==="creative")return "";
 const demand=intent.task==="critique"||profile.focus==="argument"||
  /(?:bantah|sanggah|kritik|hujah|uji dakwaan|semak premis|counterargument)/i.test(question);
 return demand?"\nSEMAK HUJAH 4.0: Pastikan dakwaan memang memerlukan bantahan sebelum menyanggah. Bezakan premis, bukti tersedia, tafsiran dan bantahan terkuat. Uji juga kelemahan bantahan itu sendiri; akui dakwaan yang benar dan ketidakpastian. Jangan jadikan GELAP pembangkang automatik atau mendakwa fact-check telah dijalankan tanpa sumber.":"";
}
function evidenceState({research={},sources=[],ownedPage=false}={}){
 return ownedPage||research?.status==="page-read"?"page_text":
  Array.isArray(sources)&&sources.length?"search_excerpt":"no_external_evidence";
}
function guidance({request,question="",intent={},profile={},history=[],research={},sources=[],ownedPage=false}={}){
 const lines=[
  V3.argumentGuidance({question,intent,profile,mode:request.mode}),
  V3.continuityGuidance(history),
  V3.stanceGuidance({question,history,mode:request.mode,sensitive:!!intent.sensitive}),
  V3.evidenceGuidance({question,intent,research,sources,ownedPage}),
  V3.dualGuidance(request.dualPerspective),
  answerGuidance(request,{intent,history}),
  argumentVerification({question,intent,profile}),
  intent.sensitive||intent.task==="support"||intent.task==="creative"?"":"\nSEMAKAN KELENGKAPAN 4.0: Sebelum menghantar, pastikan jawapan benar-benar menjawab permintaan dan tidak terhenti terlalu awal. Jika diminta lebih detail, tambah alasan, contoh dan implikasi yang belum diterangkan. Jangan cipta sumber, hasil ujian, kepastian atau nama alat. Ini semakan arahan kualiti, bukan panggilan AI tambahan."
 ].filter(Boolean);
 return {guidance:lines.join("\n"),evidenceState:evidenceState({research,sources,ownedPage})};
}
function auditReply({reply="",request={},intent={},outputFormat=""}={}){
 // Heuristic signal, NOT a verified grade or a reason to silently spend quota.
 const text=String(reply||"");
 const wordCount=(text.match(/[\p{L}\p{N}]+/gu)||[]).length;
 const issues=[];
 if(!text.trim())issues.push("empty");
 else if(request.answerDepth==="mendalam"&&!intent.sensitive&&intent.task!=="support"&&
  intent.task!=="creative"&&outputFormat!=="json"&&!text.includes(String.fromCharCode(96).repeat(3))&&wordCount<75)
  issues.push("too_brief_for_requested_detail");
 return {status:issues.length?"needs_review":"complete_by_heuristic",
  issueCodes:issues,wordCount,accuracyVerified:false};
}
module.exports={answerDepth,planRequest,answerGuidance,argumentVerification,
 evidenceState,guidance,auditReply};
