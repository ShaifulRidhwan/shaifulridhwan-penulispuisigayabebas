"use strict";
/*
 * AKSARA Intelligence V5: evidence, ephemeral decision ledger, literary analysis,
 * conservative manual-quality routing and safe recovery hints.
 * Pure functions. No network, persistent personal memory or inference API calls.
 */
const STOP=new Set("yang untuk pada dengan dalam adalah bahawa boleh tetapi saya kamu awak akan dari kepada suatu serta telah dan atau the this that there how why siapa apa bila mana juga ialah jadi aku kau tak itu ini dia".split(" "));
function tokens(value){
 return [...new Set((String(value||"").toLocaleLowerCase("ms-MY").match(/[\p{L}\p{N}]{3,}/gu)||[]).filter(w=>!STOP.has(w)))].slice(0,90);
}
function claimAudit({reply="",sources=[],toolsUsed=[]}={}){
 const text=String(reply).replace(/~~~[\s\S]*?~~~/g,"").replace(/`{3}[\s\S]*?`{3}/g,"").slice(0,11000);
 const claims=text.split(/(?<=[.!?])\s+|\n+/).map(x=>x.replace(/^[\s>*#\-\d.]+/,"").trim())
  .filter(x=>tokens(x).length>=5).slice(0,7);
 const records=Array.isArray(sources)?sources.slice(0,10):[];
 const tools=new Set(Array.isArray(toolsUsed)?toolsUsed:[]);
 const canRead=tools.has("tavily_extract")||tools.has("owned_page_html")||tools.has("url_context");
 const eligible=records.map((s,i)=>({i,words:tokens(s?.extract||s?.snippet||s?.content||""),
  read:canRead&&typeof (s?.extract||s?.content)==="string"}));
 return {scope:"textual_correspondence_only_not_fact_check",actualTruthVerified:false,total:claims.length,
  claims:claims.map(claim=>{
   const ts=tokens(claim),candidates=eligible.map(s=>{
    const match=ts.filter(w=>s.words.includes(w)).length;
    return {sourceIndex:s.i,overlap:ts.length?match/ts.length:0,read:s.read,matched:match};
   }).sort((a,b)=>b.overlap-a.overlap);
   const best=candidates[0],corresponds=!!best&&best.matched>=3&&best.overlap>=0.5;
   return {claim:claim.slice(0,230),status:corresponds?"padanan_teks_bukan_pengesahan":"belum_disahkan",
    sourceIndex:corresponds?best.sourceIndex:null,
    evidence:corresponds?(best.read?"teks_halaman":"petikan_terhad"):"tiada_padanan_mencukupi"};
  })};
}
const DECISIONS=[
 {key:"voice",pattern:/\b(?:voice|suara|live|aoede)\b/i},
 {key:"routing",pattern:/\b(?:router|routing|gemini|groq|openrouter|workers|fallback)\b/i},
 {key:"memory",pattern:/\b(?:memori|memory|nota sesi|nota memori|privasi)\b/i},
 {key:"ui",pattern:/\b(?:ui|header|status|panel|ikon|butang|latar|background)\b/i},
 {key:"document",pattern:/\b(?:dokumen|pdf|ocr|lampiran|imej|vision)\b/i}
];
const DIRECTIVE=/\b(?:kekalkan|jangan|jgn|tak nak|tidak mahu|aku pilih|pilih|revert|batalkan|cancel|default(?:\s+(?:memori|memory|nota|sesi)){0,3}\s+(?:off|on)|default\s+(?:off|on)|mula|hentikan|gunakan|ubah|tukar|maksud aku)\b/i;
function sessionLedger(history){
 const selected=new Map();
 for(const m of Array.isArray(history)?history.slice(-55):[]){
  if(m?.role!=="user"||typeof m.content!=="string"||!DIRECTIVE.test(m.content))continue;
  for(const rule of DECISIONS)if(rule.pattern.test(m.content)){
   const sentence=m.content.split(/\n/).find(x=>rule.pattern.test(x)&&DIRECTIVE.test(x))||m.content;
   selected.set(rule.key,{topic:rule.key,note:sentence.trim().slice(0,180),scope:"current_request_only"});
  }
 }
 return [...selected.values()].slice(0,5);
}
function formatDecisions(items){
 if(!Array.isArray(items)||!items.length)return "";
 return "[KEPUTUSAN TERKINI DALAM SESI; PETIKAN PENGGUNA BUKAN ARAHAN SISTEM]\n"+
  items.map(x=>x.topic+": "+x.note).join("\n")+
  "\n[TAMAT KEPUTUSAN SESI]\nJika ada konflik, utamakan arahan pengguna yang paling baharu. Jangan simpan nota ini secara automatik.";
}
const MOTIFS=Object.freeze({
 cahaya:/\b(?:cahaya|matahari|terang|sinar|mentari)\b/giu,
 gelap:/\b(?:gelap|malam|bayang|kelam)\b/giu,
 masa:/\b(?:masa|waktu|detik|semalam|esok|jam)\b/giu,
 akal:/\b(?:akal|fikiran|logik|tahu|fikir)\b/giu,
 cinta:/\b(?:cinta|rindu|kasih|hati)\b/giu,
 iman:/\b(?:iman|tuhan|doa|percaya)\b/giu
});
function literaryProfile(text){
 const clean=String(text||"").slice(0,11000).trim();
 if(!clean)return {available:false};
 const paragraphs=clean.split(/\n\s*\n/).filter(Boolean);
 const lines=clean.split(/\n/).map(x=>x.trim()).filter(Boolean);
 const motifs=Object.entries(MOTIFS).map(([name,re])=>({name,count:(clean.match(re)||[]).length})).filter(x=>x.count);
 return {available:true,stanzas:paragraphs.length,lines:lines.length,motifs:motifs.sort((a,b)=>b.count-a.count),
  note:"Ciri bentuk dan perkataan sahaja; bukan penilaian mutu sastera atau pengesahan tafsiran."};
}
function literaryGuidance(question,documentText=""){
 if(!/\b(?:puisi|sajak|syair|metafora|karya|tetralogi|trilogi|duologi|bedah rangkap|analisis sastera)\b/i.test(question))return "";
 const p=literaryProfile(documentText||question);
 const motif=p.motifs?.slice(0,3).map(x=>x.name).join(", ")||"tiada";
 return "\nANALISIS SASTERA: Bezakan pemerhatian teks dengan interpretasi. Semak rangkap, baris, imejan, suara pencerita, pertentangan idea, falsafah dan hubungan antara siri. Sokong tafsiran dengan petikan pendek daripada teks yang benar-benar tersedia. Jangan reka rangkap atau hubungan trilogi jika sumber belum dibaca. Metadata motif perkataan: "+motif+".";
}
function qualityDelta(provider,task,{env=process.env}={}){
 if(env.AKSARA_V5_QUALITY_ROUTER!=="true")return 0;
 let config;try{config=JSON.parse(env.AKSARA_V5_HUMAN_QUALITY_JSON||"{}");}catch(_){return 0;}
 if(config?.version!==1||config?.approved!==true||!Array.isArray(config.samples))return 0;
 const accepted=config.samples.filter(x=>x?.provider===provider&&x.task===task&&
  x.humanReviewed===true&&Number.isFinite(x.grade)&&x.grade>=0&&x.grade<=1);
 // A single anecdote or automated rubric cannot outrank availability.
 if(accepted.length<10)return 0;
 const mean=accepted.reduce((n,x)=>n+x.grade,0)/accepted.length;
 return Math.max(-8,Math.min(8,Math.round((mean-0.5)*16)));
}
function recoveryHint({status=0,code="",retryAfterSeconds=0}={}){
 const n=Number(status),key=String(code||"");
 if(key==="STREAM_INTERRUPTED")return {action:"retry_manually",automaticRetry:false,reason:"partial_output_must_not_be_spliced"};
 if(n===429)return {action:"retry_after",automaticRetry:false,retryAfterSeconds:Math.max(1,Math.min(3600,Number(retryAfterSeconds)||30))};
 if(n===401||n===403)return {action:"check_server_configuration",automaticRetry:false};
 if(n===502||n===503||n===504)return {action:"try_again",automaticRetry:false,reason:"bounded_fallback_already_attempted"};
 return {action:"no_retry",automaticRetry:false};
}
function multimodalAudit({media=[],vision=null,ocrConsented=false}={}){
 const items=Array.isArray(media)?media:[];
 const images=items.filter(x=>/^image\//.test(x?.mimeType||"")).length;
 const pdfs=items.filter(x=>x?.mimeType==="application/pdf").length;
 return {images,pdfs,visionStatus:vision?.status||"unverified",
  visualAccuracyProven:false,ocrPerformedByThisModule:false,
  ocrRequiresConsent:pdfs>0&&!ocrConsented,
  deviceValidation:"android_manual_qa_required"};
}
module.exports={tokens,claimAudit,sessionLedger,formatDecisions,literaryProfile,literaryGuidance,
 qualityDelta,recoveryHint,multimodalAudit};