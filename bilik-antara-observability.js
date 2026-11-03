/* AKSARA Pemerhatian v2 · Voice, Lampiran, Penyelidikan
 * Semua pemerhatian ialah metadata setempat. Tiada prompt, fail, audio, URL,
 * API key, transkrip atau kandungan perbualan disimpan atau dihantar.
 */
(function(root,factory){
 "use strict";
 const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root&&root.document){root.AksaraObserve=api;api.mount(root);}
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const PHASES=Object.freeze(["dipilih","membaca","sedia","separa","gagal","kosong","dihantar"]);
 const HEALTH=Object.freeze(["tidak_diuji","menunggu","tersambung","terputus","menyambung_semula"]);
 const safeCount=n=>Number.isFinite(Number(n))?Math.max(0,Math.min(100,Math.floor(Number(n)))):0;
 function classifyResearch(data={}){
  const used=Array.isArray(data.toolsUsed)?data.toolsUsed.filter(x=>typeof x==="string"):[],
   count=safeCount(data.sourceCount),trace=String(data.urlTraceStatus||"");
  if(data.requestFailed)return {state:"gagal",label:"Permintaan gagal",count:0};
  const evidence=data.evidenceProfile;
  if(evidence&&evidence.scope==="tool_metadata_not_fact_verification"){
   const labels={page_text:"Teks halaman diperoleh",grounded_search:"Carian bersumber",
    search_excerpt:"Petikan carian sahaja",links_only:"Pautan ada, bacaan belum disahkan",
    no_external_evidence:"Tiada bukti sumber luaran"};
   const label=labels[evidence.level];
   if(label)return {state:evidence.level,label,count:safeCount(evidence.sourceCount)};
  }
  if(data.mode==="local-limitation")return {state:"belum_disahkan",label:"Sumber belum disahkan",count:0};
  if(trace==="success"&&used.includes("url_context"))return {state:"dibaca",label:"URL dibaca sebagai teks",count};
  if(used.includes("tavily_extract")||used.includes("owned_page_html"))return {state:"dibaca",label:"Teks halaman diperoleh",count};
  if(used.includes("google_search")&&count>0)return {state:"dirujuk",label:"Carian Google bersumber",count};
  if(used.includes("wikipedia_summary")&&count>0)return {state:"ringkasan",label:"Ringkasan Wikipedia diperoleh",count};
  if(used.includes("publisher_rss")&&count>0)return {state:"ringkasan",label:"Tajuk dan pautan RSS",count};
  if(used.includes("tavily_search")||data.researchStatus==="search-snippets")return {state:"ringkasan",label:"Petikan carian sahaja",count};
  if(used.includes("groq_browser_search")||used.includes("browser_search"))return {state:"carian",label:"Carian web digunakan; URL khusus belum disahkan",count};
  if(count>0)return {state:"pautan",label:"Pautan diberi, bacaan belum disahkan",count};
  return {state:"tiada",label:"Tiada bukti carian web untuk respons ini",count:0};
 }
 function create(){
  let attachment={phase:"kosong",count:0,failed:0,pdfPages:0},research={state:"tiada",label:"Belum ada respons disemak",count:0};
  function file(event={}){
   const phase=PHASES.includes(event.phase)?event.phase:"gagal";
   attachment={phase,count:safeCount(event.count),failed:safeCount(event.failed),pdfPages:safeCount(event.pdfPages)};
   return attachment;
  }
  function web(event={}){
   research=classifyResearch(event);
   return research;
  }
  function resetWeb(){research={state:"tiada",label:"Belum ada respons disemak",count:0};return research;}
  return Object.freeze({file,web,resetWeb,snapshot:()=>({attachment:{...attachment},research:{...research}})});
 }
 function mount(win){
  const doc=win.document,state=create();
  function details(id,title,parent,before){
   if(!parent)return null;
   const d=doc.createElement("details");d.id=id;d.className="aksara-observe-v2";
   const s=doc.createElement("summary");s.textContent=title;
   const content=doc.createElement("div");content.className="aksara-observe-body";content.setAttribute("role","status");
   d.append(s,content);
   if(before)parent.insertBefore(d,before);else parent.append(d);
   return {d,content};
  }
  const attachmentDialog=doc.getElementById("attachmentDialog"),
   attachment=details("attachmentObserveV2","Status pemprosesan lampiran",attachmentDialog,
     attachmentDialog?.querySelector(".attachment-options")),
   knowledgeDialog=doc.getElementById("knowledgeDialog"),
   knowledge=details("webObserveV2","Status carian & bukti terakhir",knowledgeDialog,
     knowledgeDialog?.querySelector(".multi-ai-actions")),
   voicePanel=doc.getElementById("voicePanel"),
   voice=details("voiceObserveV2","Diagnostik Voice",voicePanel,null);
  const style=doc.createElement("style");style.textContent=[
   ".aksara-observe-v2{border:1px solid rgba(230,204,160,.22);border-radius:11px;background:rgba(16,23,39,.23);margin:9px 0 13px;color:#d6cbba}",
   ".aksara-observe-v2 summary{cursor:pointer;padding:9px 12px;font:600 11px/1.4 'DM Sans',sans-serif;list-style:revert}",
   ".aksara-observe-body{padding:0 12px 11px;font:400 11px/1.55 'DM Sans',sans-serif;white-space:pre-line;overflow-wrap:anywhere}",
   ".aksara-observe-v2:focus-within{border-color:rgba(241,207,150,.55)}",
   "@media(max-width:420px){.aksara-observe-v2 summary,.aksara-observe-body{font-size:10.5px}}"
  ].join("\n");doc.head.append(style);
  const phrases={dipilih:"Fail dipilih",membaca:"Membaca fail setempat",sedia:"Sedia dihantar",
   separa:"Sebahagian fail tidak dapat diproses",gagal:"Pemprosesan gagal",
   kosong:"Tiada lampiran",dihantar:"Dihantar bersama permintaan"};
  function refreshFile(){
   if(!attachment)return;
   const a=state.snapshot().attachment;
   attachment.content.textContent=phrases[a.phase]+" · "+a.count+" fail"+
    (a.failed?" · "+a.failed+" gagal":"")+(a.pdfPages?" · "+a.pdfPages+" halaman PDF berteks":"")+
    "\nFail hanya dihantar apabila kau tekan Hantar. Status ini tidak mengesahkan penyedia AI berjaya membaca fail.";
   attachment.d.dataset.phase=a.phase;
  }
  function refreshWeb(){
   if(!knowledge)return;
   const a=state.snapshot().research;
   knowledge.content.textContent=a.label+(a.count?" · "+a.count+" pautan":"")+
    "\nPautan sumber bukan bukti halaman telah dibaca sepenuhnya. Tiada carian baharu dibuat untuk paparan status.";
   knowledge.d.dataset.state=a.state;
  }
  function refreshVoice(){
   if(!voice)return;
   const snap=win.BilikAntaraVoiceDiagnostics?.snapshot?.();
   if(!snap){voice.content.textContent="Diagnostik Voice belum dimuat.";return;}
   // Active != connected. AudioContext running != actual speech played.
   const connection=snap.connected?"Tersambung":snap.sessionActive?
     snap.reconnectAttempts>0?"Sedang menyambung semula":"Belum tersambung":"Tidak aktif";
   const mic=!snap.sessionActive?"Tidak aktif":snap.micEnabled?
    snap.microphoneState==="running"?"Aktif":"Dibenarkan, aliran belum disahkan":"Dimatikan";
   const playback=!snap.sessionActive?"Tidak aktif":snap.speakerEnabled?
    snap.playbackState==="running"?"Konteks audio aktif":"Audio belum sedia":"Disenyapkan";
   const attempts=safeCount(snap.reconnectAttempts);
   const ms=n=>Number.isFinite(n)&&n>=0?Math.round(n)+" ms":"Belum diukur";
   voice.content.textContent="Sambungan: "+connection+
    "\nKeadaan: "+String(snap.voicePhase||"idle")+
    "\nGaya: "+String(win.BilikAntaraDialek?.label?.(snap.selectedStyle)||"Bahasa Melayu santai")+
    "\nMod: "+String(snap.thoughtMode||"cahaya")+
    "\nMikrofon: "+mic+"\nAudio: "+playback+
    "\nData audio diterima: "+safeCount(snap.audioChunks)+" ketulan"+
    "\nAudio menunggu: "+Math.round(Number(snap.queuedAudioBytes||0)/1024)+" KB"+
    "\nSambungan semula: "+attempts+" cubaan"+
    "\nRespons transkripsi: "+ms(snap.lastResponseLatencyMs)+
    "\nAudio pertama dijadual: "+ms(snap.firstAudioScheduledMs)+
    "\nInterruptions: "+safeCount(snap.interruptions)+
    "\nPerubahan mod: "+safeCount(snap.modeChanges)+
    "\nPertukaran gaya: "+safeCount(snap.styleChanges)+
    "\nJeda latar: "+safeCount(snap.backgroundPauses)+
    "\nTekanan queue: "+safeCount(snap.audioOverflows)+
    "\nSuara ditetapkan: "+(snap.lockedVoice==="Aoede"?"Aoede":"Tidak diketahui")+
    "\nMasa audio pertama ialah jadual Web Audio, bukan pengesahan suara didengar. Tiada audio atau transkrip disimpan oleh diagnostik.";
   voice.d.dataset.voiceState=snap.connected?"tersambung":snap.sessionActive?"menunggu":"tidak_aktif";
  }
  win.addEventListener("ba:attachment-stage",e=>{state.file(e.detail);refreshFile();});
  win.addEventListener("ba:answered",e=>{state.web(e.detail);refreshWeb();});
  win.addEventListener("ba:request-failed",()=>{state.web({requestFailed:true});refreshWeb();});
  for(const event of ["ba:session-changed","ba:cleared"])win.addEventListener(event,()=>{state.resetWeb();refreshWeb();});
  for(const event of ["ba:voice-connected","ba:voice-renew"])win.addEventListener(event,refreshVoice);
  voice?.d.addEventListener("toggle",refreshVoice);
  // Sampling only while expanded and visible; no background health probes or extra network traffic.
  const timer=win.setInterval(()=>{if(voice?.d.open&&!doc.hidden)refreshVoice();},2400);
  win.addEventListener("pagehide",()=>win.clearInterval(timer),{once:true});
  refreshFile();refreshWeb();refreshVoice();
  win.AksaraObserveUI=Object.freeze({snapshot:state.snapshot,refreshVoice});
  return state;
 }
 return Object.freeze({create,classifyResearch,mount,PHASES,HEALTH});
});
