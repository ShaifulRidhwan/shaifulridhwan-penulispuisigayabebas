/* AKSARA Security Lab CI: public aggregate status + local-only detailed imports.
 * No user-selected source content is uploaded. */
(function(){
"use strict";
const $=(id)=>document.getElementById(id);
const RAW="https://raw.githubusercontent.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/security-reports/latest.json";
const API="https://api.github.com/repos/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/contents/latest.json?ref=security-reports";
const RUN="https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/actions/runs/";
const safeInt=(n)=>Number.isSafeInteger(Number(n))&&Number(n)>=0?Number(n):0;
const levels=["critical","high","medium","low"];
let publicSummary=null,imported=[];
function make(tag,content,cls){
  const node=document.createElement(tag);node.textContent=String(content??"");if(cls)node.className=cls;return node;
}
function validate(summary){
  if(!summary||summary.schemaVersion!==1||summary.source!=="github-actions"||!summary.aggregate||!summary.scanners)return false;
  if(!["incomplete","findings_detected","no_findings_in_scoped_scans"].includes(summary.status))return false;
  return levels.every(level=>Number.isSafeInteger(summary.aggregate[level])&&summary.aggregate[level]>=0);
}
function stats(counts,parent){
  parent.replaceChildren();
  const values=[["critical","Critical"],["high","High"],["medium","Medium"],["low","Low"]];
  for(const [key,title] of values){
    const cell=make("div","","ak-ci-stat");
    cell.append(make("strong",safeInt(counts[key])),make("small",title));
    parent.append(cell);
  }
}
function statusLabel(data){
  if(data.status==="incomplete")return "Imbasan tidak lengkap. Sebahagian keputusan belum disahkan.";
  if(data.status==="findings_detected")return "Imbasan selesai. Penemuan keselamatan dikesan; semakan diperlukan.";
  return "Imbasan selesai tanpa penemuan dalam skop pemeriksaan ini. Bukan bukti sistem bebas kelemahan.";
}
function display(data){
  publicSummary=data;
  const state=$("ciStatus");
  state.textContent=statusLabel(data);
  state.dataset.state=data.status;
  stats(data.aggregate,$("ciStats"));
  const checked=Date.parse(data.generatedAt);
  const date=Number.isFinite(checked)?new Date(checked).toLocaleString("ms-MY"):"Masa tidak diketahui";
  const trivy=data.scanners.trivy?.state||"unknown";
  const semgrep=data.scanners.semgrep?.state||"unknown";
  $("ciMeta").textContent="Trivy: "+trivy+" · Semgrep: "+semgrep+" · "+date;
  const link=$("ciRunLink"),run=String(data.runId||"");
  link.hidden=!/^\d{1,20}$/.test(run);
  if(!link.hidden)link.href=RUN+run;
  $("ciExplanation").textContent="Angka awam ialah jumlah sahaja. Butiran fail dan peraturan disimpan dalam artifact GitHub Actions, bukan diterbitkan di laman ini.";
}
async function retrieve(){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8500);
  try{
    let result=null;
    try{
      const r=await fetch(RAW,{cache:"no-store",signal:controller.signal});
      if(!r.ok)throw Error("Ringkasan tidak tersedia.");
      result=await r.json();
    }catch(err){
      if(controller.signal.aborted)throw err;
      const r=await fetch(API,{cache:"no-store",signal:controller.signal,headers:{"accept":"application/vnd.github+json"}});
      if(!r.ok)throw Error("Laporan agregat belum diterbitkan.");
      const data=await r.json();
      if(data.encoding!=="base64"||typeof data.content!=="string")throw Error("Format laporan tidak sah.");
      result=JSON.parse(atob(data.content.replace(/\s+/g,"")));
    }
    if(!validate(result))throw Error("Format ringkasan CI tidak dikenali.");
    display(result);
  }catch(_){
    $("ciStatus").textContent="Ringkasan CI belum tersedia atau tidak dapat dicapai. Buka workflow untuk melihat status sebenar.";
    $("ciStatus").dataset.state="unavailable";
    $("ciStats").replaceChildren();
    $("ciMeta").textContent="Tiada angka dipaparkan sehingga sumber disahkan.";
    $("ciRunLink").hidden=true;publicSummary=null;
  }finally{clearTimeout(timer);}
}
function severity(raw,source){
  const v=String(raw||"").toUpperCase();
  if(v==="CRITICAL")return "critical";
  if(v==="HIGH"||source==="Semgrep"&&v==="ERROR")return "high";
  if(v==="MEDIUM"||source==="Semgrep"&&v==="WARNING")return "medium";
  return "low";
}
function parseScanner(fileName,data){
  const findings=[];
  if(data&&Array.isArray(data.Results)){
    for(const section of data.Results){
      const location=String(section.Target||"").slice(0,150);
      for(const item of [...(section.Vulnerabilities||[]),...(section.Misconfigurations||[])]){
        findings.push({scanner:"Trivy",risk:severity(item.Severity,"Trivy"),
          title:String(item.Title||item.PkgName||"Dependency/configuration finding").slice(0,160),
          location,reference:String(item.VulnerabilityID||item.ID||"").slice(0,80),
          fix:String(item.FixedVersion||"").slice(0,60),
          advice:"Semak advisory rasmi dan gunakan versi atau konfigurasi yang telah dibaiki."});
        if(findings.length>=300)return findings;
      }
    }
  }else if(data&&Array.isArray(data.results)){
    for(const item of data.results){
      findings.push({scanner:"Semgrep",risk:severity(item.extra?.severity,"Semgrep"),
        title:String(item.check_id||"Static rule finding").slice(0,120),
        location:String(item.path||"").slice(0,140)+(item.start?.line?":"+item.start.line:""),
        reference:"",fix:"",
        advice:"Semak konteks kod dan gunakan pembaikan selamat sebelum menutup penemuan."});
      if(findings.length>=300)return findings;
    }
  }else throw Error("Fail "+fileName+" bukan laporan Trivy/Semgrep yang disokong.");
  return findings;
}
function displayImports(){
  const counts={critical:0,high:0,medium:0,low:0};
  for(const item of imported)counts[item.risk]=(counts[item.risk]||0)+1;
  stats(counts,$("importStats"));
  const area=$("importFindings");area.replaceChildren();
  if(!imported.length){area.append(make("p","Tiada penemuan dalam laporan yang diimport.","ak-empty"));return;}
  for(const f of imported.slice(0,40)){
    const box=make("article","","ak-import-item");
    const heading=make("strong",f.scanner+" · "+f.risk.toUpperCase()+" · "+f.title);
    const location=make("small",f.location||"Lokasi tidak tersedia");
    const fix=make("small",f.advice+(f.fix?" Versi pembaikan: "+f.fix:""));
    box.append(heading,location,fix);area.append(box);
  }
  if(imported.length>40)area.append(make("p","40 penemuan pertama dipaparkan. Laporan penuh kekal pada fail asal.","ak-empty"));
}
$("refreshCI")?.addEventListener("click",retrieve);
$("scannerFiles")?.addEventListener("change",async function(){
  const files=[...this.files].slice(0,2);
  imported=[];
  if(!files.length)return;
  let accepted=0;
  for(const file of files){
    try{
      if(file.size>8*1024*1024)throw Error("Fail melebihi 8 MB.");
      const data=JSON.parse(await file.text());
      imported.push(...parseScanner(file.name,data));accepted++;
    }catch(error){
      $("importStatus").textContent=String(error.message||"Gagal membaca laporan.");
    }
  }
  imported=imported.slice(0,300);
  if(accepted)$("importStatus").textContent=accepted+" fail laporan dibaca secara setempat · "+imported.length+" penemuan. Tiada data dimuat naik.";
  displayImports();this.value="";
});
window.AksaraSecurityCI=Object.freeze({
  publicSummary:()=>publicSummary?{status:publicSummary.status,counts:{...publicSummary.aggregate},runId:publicSummary.runId,generatedAt:publicSummary.generatedAt}:null,
  localSummary:()=>{
    const counts={critical:0,high:0,medium:0,low:0};
    for(const f of imported)counts[f.risk]=(counts[f.risk]||0)+1;
    return {count:imported.length,counts};
  }
});
retrieve();
})();