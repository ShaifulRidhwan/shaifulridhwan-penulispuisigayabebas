/* AKSARA Security Lab v2: defensive browser-only UI and owned-origin reports. */
(function(){
"use strict";
const $=(id)=>document.getElementById(id);
const PAGES={"/bilik-antara.html":"Bilik Antara","/studio-antara.html":"Studio Antara","/antara-cahaya-dan-gelap.html":"Novel · Cahaya dan Gelap","/":"Laman Utama"};
const LABELS={"https":"HTTPS","hsts":"Strict Transport Security","csp":"Content Security Policy","csp-eval":"CSP · unsafe-eval","csp-object":"CSP · object-src","csp-base":"CSP · base-uri","nosniff":"X-Content-Type-Options","referrer":"Referrer-Policy","framing":"Anti-framing","permissions":"Permissions-Policy","no-powered-by":"Framework disclosure"};
const RISK={"tinggi":"HIGH","sederhana":"MEDIUM","rendah":"LOW","asas":"BASE"};
const activity=[],audits=Object.create(null);
let currentAudit=null,codeFindings=null,running=false;
function show(tab){
  for(const el of document.querySelectorAll("[data-panel]"))el.hidden=el.dataset.panel!==tab;
  for(const el of document.querySelectorAll("[data-tab]")){
    const active=el.dataset.tab===tab;el.classList.toggle("is-active",active);
    el.setAttribute("aria-selected",String(active));
  }
}
document.querySelectorAll("[data-tab]").forEach(el=>el.addEventListener("click",()=>show(el.dataset.tab)));
document.querySelectorAll("[data-goto]").forEach(el=>el.addEventListener("click",()=>show(el.dataset.goto)));
const text=(tag,content,cls)=>{const node=document.createElement(tag);if(cls)node.className=cls;node.textContent=String(content);return node;};
function record(type,message){
  activity.unshift({type,message,time:new Date().toISOString()});
  if(activity.length>30)activity.pop();
  const list=$("activityList");list.replaceChildren();
  for(const entry of activity){
    const row=text("div","","ak-activity");
    row.append(text("span",entry.message),text("time",new Date(entry.time).toLocaleString("ms-MY")));
    list.append(row);
  }
}
function checkCard({id,passed,advice,risk,group}){
  const card=text("div","","ak-check"+(passed?"":" is-warning"));
  const mark=text("span",passed?"✓":"!","ak-state");
  const info=text("div","");
  info.append(text("strong",LABELS[id]||id),text("small",advice||""),text("em",(group||"Polisi").toUpperCase()+" · "+(RISK[risk]||"INFO")));
  card.append(mark,info);return card;
}
function updateMetrics(data){
  $("metricScore").replaceChildren(document.createTextNode(String(data.score)),text("span"," / 100"));
  $("metricScoreLabel").textContent=PAGES[data.path]||"Halaman projek";
  $("metricIssues").textContent=String(data.warnings);
  $("metricIssuesLabel").textContent="Indikator perlu perhatian";
}
function renderAudit(data){
  currentAudit=data;
  $("auditOutput").hidden=false;
  $("summary").textContent="HTTP "+data.status+" · "+data.passed+"/"+data.total+" lulus · "+new Date(data.checkedAt).toLocaleString("ms-MY");
  $("auditPageTitle").textContent=PAGES[data.path]||data.path;
  $("auditMeta").textContent=data.warnings+" semakan perlu perhatian · "+data.mode;
  $("checksCount").textContent=data.checks.length+" pemeriksaan";
  const ring=$("scoreRing");ring.style.setProperty("--score",String(data.score));
  ring.style.setProperty("--scoreColor",data.score>=85?"#a4dfbf":data.score>=65?"#e9ca91":"#e1a38f");
  $("scoreText").textContent=data.score;
  const checks=$("results");checks.replaceChildren();
  for(const item of data.checks){if(typeof item.passed==="boolean")checks.append(checkCard(item));}
  $("observations").replaceChildren();
  for(const observation of data.observations||[]){
    const box=text("div","","ak-observation");
    box.append(text("strong",observation.title),text("small",observation.value));
    $("observations").append(box);
  }
  $("policySummary").textContent=data.cspSummary||"Belum tersedia.";
  updateMetrics(data);
}
function renderCompare(){
  const values=Object.values(audits);
  $("comparisonSection").hidden=values.length<2;
  const area=$("comparison");area.replaceChildren();
  for(const path of Object.keys(PAGES)){
    const d=audits[path];if(!d)continue;
    const row=text("div","","ak-compare-row"),left=text("div","");
    left.append(text("strong",PAGES[path]),text("small",d.warnings+" perlu perhatian · "+new Date(d.checkedAt).toLocaleTimeString("ms-MY")));
    row.append(left,text("strong",d.score+"/100"));area.append(row);
  }
}
async function fetchAudit(path){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
  try{
    const response=await fetch("/.netlify/functions/aksara-security-audit?path="+encodeURIComponent(path),{
      method:"GET",credentials:"same-origin",signal:controller.signal,cache:"no-store"});
    const data=await response.json();
    if(!response.ok||!data.ok||!Array.isArray(data.checks))throw Error(data.error||"Respons audit tidak sah.");
    if(data.path!==path||data.scope!=="owned-origin-only")throw Error("Skop audit tidak sepadan.");
    return data;
  }finally{clearTimeout(timer);}
}
async function runAudit(all){
  if(running)return;running=true;
  $("runAudit").disabled=true;$("runAll").disabled=true;
  const paths=all?Object.keys(PAGES):[$("page").value];
  let success=0,last=null;
  $("summary").textContent="Mengaudit "+paths.length+" halaman projek...";
  try{
    for(const path of paths){
      $("summary").textContent="Memeriksa "+(PAGES[path]||"halaman")+"...";
      try{
        const data=await fetchAudit(path);
        audits[path]=data;last=data;success++;renderAudit(data);
        record("web","HTTP audit · "+PAGES[path]+" · "+data.score+"/100");
      }catch(err){
        record("error","Gagal audit · "+(PAGES[path]||path));
        $("summary").textContent="Gagal mengaudit "+(PAGES[path]||path)+": "+String(err.message||"Ralat sambungan");
        if(!all)break;
      }
    }
    if(all)$("summary").textContent=success+"/"+paths.length+" halaman berjaya diaudit. Pilih halaman untuk lihat penemuannya.";
    if(last&&success)$("page").value=last.path;
    renderCompare();
    $("reportStatus").textContent=success+" audit terkini tersedia untuk eksport.";
  }finally{running=false;$("runAudit").disabled=false;$("runAll").disabled=false;}
}
$("runAudit").addEventListener("click",()=>runAudit(false));
$("runAll").addEventListener("click",()=>runAudit(true));
$("page").addEventListener("change",()=>{const audit=audits[$("page").value];if(audit)renderAudit(audit);else{$("auditOutput").hidden=true;$("summary").textContent="Belum ada keputusan untuk halaman ini. Jalankan audit.";}});

const PATTERNS=[
  {id:"eval",title:"Dynamic eval()",risk:"tinggi",message:"Elakkan menilai rentetan kod secara dinamik.",regex:/\beval\s*\(/},
  {id:"function",title:"Dynamic Function constructor",risk:"tinggi",message:"Semak sama ada kod dibina daripada input yang tidak dipercayai.",regex:/\bnew\s+Function\s*\(/},
  {id:"write",title:"document.write()",risk:"sederhana",message:"Penggabungan kandungan HTML perlu penapisan dan API DOM yang selamat.",regex:/\bdocument\.write\s*\(/},
  {id:"innerhtml",title:"innerHTML assignment",risk:"sederhana",message:"Periksa sama ada nilai berasal daripada input pengguna; pertimbangkan textContent.",regex:/\.innerHTML\s*(?:\+?=)/},
  {id:"secret",title:"Possible hard-coded secret",risk:"tinggi",message:"Pastikan credential tidak ditulis terus dalam source code.",regex:/\b(?:api[_-]?key|password|client[_-]?secret|access[_-]?token)\s*[:=]\s*['"][^'"]{6,}['"]/i},
  {id:"http",title:"Plain HTTP reference",risk:"rendah",message:"Pastikan permintaan yang membawa data menggunakan HTTPS.",regex:/['"]http:\/\//i},
  {id:"localstorage",title:"Sensitive localStorage usage",risk:"sederhana",message:"Audit penyimpanan token; localStorage boleh diakses oleh JavaScript halaman.",regex:/\blocalStorage\.(?:setItem|getItem)\s*\(\s*['"](?:token|auth|password|secret)/i},
  {id:"tls",title:"TLS verification bypass",risk:"tinggi",message:"Jangan matikan pengesahan sijil TLS pada aplikasi sebenar.",regex:/\brejectUnauthorized\s*:\s*false\b|\bverify\s*=\s*False\b/},
  {id:"shell",title:"Shell execution with shell=true",risk:"sederhana",message:"Semak input arahan dan elakkan shell jika tidak diperlukan.",regex:/\bshell\s*[:=]\s*(?:true|True)\b/}
];
function inspectCode(source){
  if(typeof source!=="string"||source.length>120000)throw Error("Kod melebihi 120,000 aksara.");
  const findings=[],lines=source.split(/\r?\n/);
  lines.forEach((line,index)=>{
    if(line.trim().startsWith("//")||line.trim().startsWith("#"))return;
    for(const rule of PATTERNS){
      if(rule.regex.test(line)){findings.push({id:rule.id,title:rule.title,risk:rule.risk,line:index+1,message:rule.message});
        if(findings.length>=75)return;}
    }
  });
  return {scannedAt:new Date().toISOString(),lines:lines.length,findings,limited:findings.length>=75};
}
function renderCode(data){
  $("codeOutput").hidden=false;
  $("codeSummary").textContent=data.findings.length+" penemuan · "+data.lines+" baris";
  const area=$("codeResults");area.replaceChildren();
  if(!data.findings.length)area.append(text("p","Tiada padanan corak ditemui. Ini bukan pengesahan kod bebas kelemahan.","ak-empty"));
  for(const f of data.findings){
    const el=text("div","","ak-check is-warning"),mark=text("span","!","ak-state"),details=text("div","");
    details.append(text("strong",f.title),text("small","Baris "+f.line+" · "+f.message),text("em",(RISK[f.risk]||"INFO")+" · HEURISTIC"));
    el.append(mark,details);area.append(el);
  }
}
$("scanCode").addEventListener("click",()=>{
  const source=$("codeInput").value;
  if(!source.trim()){$("codeHint").textContent="Masukkan kod dahulu untuk dianalisis.";return;}
  try{
    codeFindings=inspectCode(source);renderCode(codeFindings);
    $("codeHint").textContent="Analisis selesai dalam browser. Kandungan asal tidak disimpan dalam laporan.";
    $("reportStatus").textContent="Laporan kod setempat tersedia untuk eksport.";
    record("code","Code inspection · "+codeFindings.findings.length+" penemuan");
  }catch(err){$("codeHint").textContent=String(err.message||"Analisis gagal.");}
});
$("codeFile").addEventListener("change",async()=>{
  const file=$("codeFile").files?.[0];if(!file)return;
  try{
    if(file.size>200000)throw Error("Fail melebihi 200 KB. Gunakan petikan yang lebih kecil.");
    const contents=await file.text();
    if(contents.length>120000)throw Error("Fail melebihi 120,000 aksara.");
    $("codeInput").value=contents;
    $("codeHint").textContent="Fail "+file.name+" dibaca setempat. Klik Analisis Kod untuk semak.";
  }catch(err){$("codeHint").textContent=String(err.message||"Tidak dapat membaca fail.");}
  finally{$("codeFile").value="";}
});
$("exportReport").addEventListener("click",()=>{
  if(!Object.keys(audits).length&&!codeFindings){$("reportStatus").textContent="Jalankan audit terlebih dahulu.";return;}
  const report={title:"AKSARA Security Lab",generatedAt:new Date().toISOString(),scope:"owned-origin-and-local-code",
    note:"Laporan indikator defensif. Bukan penilaian keselamatan menyeluruh.",
    webAudits:Object.values(audits),codeInspection:codeFindings,activity};
  const blob=new Blob([JSON.stringify(report,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),link=document.createElement("a");
  link.href=url;link.download="aksara-security-report.json";document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  $("reportStatus").textContent="Laporan JSON dijana pada peranti.";
  record("report","Eksport laporan JSON");
});
})();