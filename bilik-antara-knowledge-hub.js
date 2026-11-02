/* Pusat Pengetahuan & Rujukan v3: on-demand archive and evidence-based references.
 * No background AI requests, no stored prompts or private conversation data.
 */
(function(root,factory){
 "use strict";
 const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root&&root.document){root.AksaraKnowledgeHub=api;api.mount(root);}
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const fold=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("ms-MY");
 function rankPoems(poems,query,limit=7){
  const q=fold(query).trim().slice(0,90),terms=q.split(/\s+/).filter(t=>t.length>1).slice(0,8);
  return (Array.isArray(poems)?poems:[])
   .filter(p=>p&&typeof p.title==="string"&&Array.isArray(p.lines))
   .map(p=>{
    const title=fold(p.title),body=fold(p.lines.join(" "));
    let score=q&&title.includes(q)?20:0;
    for(const term of terms){if(title.includes(term))score+=8;if(body.includes(term))score+=2;}
    return {id:Number.isSafeInteger(Number(p.id))?Number(p.id):0,title:p.title.slice(0,130),
     lines:p.lines.filter(x=>typeof x==="string").slice(0,90),score};
   })
   .filter(p=>!q||p.score>0).sort((a,b)=>b.score-a.score||a.id-b.id)
   .slice(0,Math.max(1,Math.min(12,limit)));
 }
 function safeLink(value){
  try{
   const u=new URL(String(value||""));
   if(u.protocol!=="https:"||u.username||u.password||u.hostname.length>190)return null;
   const host=u.hostname.toLowerCase();
   if(host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local")||
     host.endsWith(".internal")||host==="0.0.0.0"||host.startsWith("[")||
     /^((10|127|169\.254|192\.168)\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)||
     /^\d{1,3}(\.\d{1,3}){3}$/.test(host))return null;
   return u.href;
  }catch(_){return null;}
 }
 function wikipediaQuestion(topic){
  const q=String(topic||"").trim().slice(0,70);
  // Had pembaca Wikipedia awam ialah 120 aksara bagi keseluruhan soalan.
  return q.length<2?"":"Cari rujukan Wikipedia tentang "+q+".";
 }
 function urlQuestion(url){
  const u=safeLink(url);
  return !u?"":"Baca teks halaman awam di URL ini: "+u+
   " . Nyatakan sama ada bacaan URL berjaya atau hanya petikan carian. Jangan mereka bukti atau pemeriksaan visual.";
 }
 function mount(win){
  const d=win.document,dialog=d.getElementById("knowledgeDialog"),host=d.getElementById("knowledgeHub"),
   trigger=d.getElementById("featureKnowledge"),input=d.getElementById("input");
  if(!dialog||!host||!trigger||!input)return null;
  host.innerHTML=[
   '<div class="knowledge-tabs" role="tablist" aria-label="Kategori rujukan">',
    '<button type="button" role="tab" data-tab="works" id="knowledgeTabWorks" aria-controls="knowledgeWorks" aria-selected="true">Karya asli</button>',
    '<button type="button" role="tab" data-tab="wiki" id="knowledgeTabWiki" aria-controls="knowledgeWiki" aria-selected="false">Wikipedia</button>',
    '<button type="button" role="tab" data-tab="url" id="knowledgeTabUrl" aria-controls="knowledgeUrl" aria-selected="false">Semak URL</button>',
   '</div>',
   '<section id="knowledgeWorks" role="tabpanel" aria-labelledby="knowledgeTabWorks">',
    '<label for="knowledgeWorkSearch">Cari dalam arkib puisi AKSARA</label>',
    '<input id="knowledgeWorkSearch" type="search" maxlength="90" autocomplete="off" placeholder="Contoh: aporia, masa, kebebasan">',
    '<p class="knowledge-note">Carian setempat daripada arkib karya asli. Tidak menggunakan AI atau API berbayar.</p>',
    '<p id="knowledgeWorkStatus" class="knowledge-note" role="status">Arkib dimuatkan apabila panel dibuka.</p>',
    '<div id="knowledgeWorkResults" class="knowledge-results"></div>',
   '</section>',
   '<section id="knowledgeWiki" role="tabpanel" aria-labelledby="knowledgeTabWiki" hidden>',
    '<label for="knowledgeWikiQuery">Topik ensiklopedia</label>',
    '<input id="knowledgeWikiQuery" maxlength="110" autocomplete="off" placeholder="Contoh: falsafah eksistensialisme">',
    '<p class="knowledge-note">Sumber Wikipedia ialah ringkasan ensiklopedia, bukan bukti berita langsung atau kajian primer.</p>',
    '<button type="button" id="knowledgeWikiDraft" class="knowledge-primary">Sediakan soalan Wikipedia</button>',
   '</section>',
   '<section id="knowledgeUrl" role="tabpanel" aria-labelledby="knowledgeTabUrl" hidden>',
    '<label for="knowledgeUrlInput">Pautan laman awam (HTTPS)</label>',
    '<input id="knowledgeUrlInput" type="url" inputmode="url" maxlength="1600" placeholder="https://example.com/artikel">',
    '<p class="knowledge-note">Semakan hanya bermula selepas soalan dihantar. Kejayaan membaca URL bergantung pada alat tersedia.</p>',
    '<button type="button" id="knowledgeUrlDraft" class="knowledge-primary">Sediakan semakan URL</button>',
   '</section>',
   '<p id="knowledgeHubAlert" class="knowledge-alert" role="status" hidden></p>',
   '<section class="knowledge-recent" aria-labelledby="knowledgeSourcesTitle">',
    '<strong id="knowledgeSourcesTitle">Sumber jawapan terakhir</strong>',
    '<p id="knowledgeSourceSummary" class="knowledge-note">Belum ada jawapan bersumber dalam tab ini.</p>',
    '<ol id="knowledgeSourcesList"></ol>',
   '</section>'
  ].join("");
  const get=id=>d.getElementById(id),made=(tag,text)=>{
   const x=d.createElement(tag);if(text!==undefined)x.textContent=String(text);return x;
  };
  const search=get("knowledgeWorkSearch"),results=get("knowledgeWorkResults"),
   status=get("knowledgeWorkStatus"),alert=get("knowledgeHubAlert");
  let poems=null,pending=null,selected="works",sources=[];
  const warn=s=>{alert.hidden=!s;alert.textContent=s||"";};
  function draft(text){
   if(!text)return false;
   input.value=text;input.dispatchEvent(new Event("input",{bubbles:true}));
   dialog.close();input.focus({preventScroll:true});return true;
  }
  function card(p){
   const box=made("article"),title=made("h3",p.title),excerpt=made("p",p.lines.filter(Boolean).slice(0,3).join(" ").slice(0,200));
   box.className="knowledge-item";box.append(title,excerpt);
   const details=made("details"),summary=made("summary","Baca teks karya");
   details.append(summary,made("p",p.lines.join("\n")));box.append(details);
   const button=made("button","Tanya AKSARA");button.type="button";
   button.addEventListener("click",()=>draft("Analisis puisi "+p.title+
    " karya Shaiful Ridhwan. Huraikan metafora dan makna berdasarkan arkib AKSARA; jangan reka petikan."));
   box.append(button);return box;
  }
  function filter(){
   if(!poems)return;
   const items=rankPoems(poems,search.value);
   results.replaceChildren(...items.map(card));
   status.textContent=items.length?items.length+" karya dipaparkan daripada "+poems.length+" entri arkib.":
    "Tiada karya sepadan. Cuba kata kunci lain.";
  }
  function load(){
   if(pending)return pending;
   status.textContent="Memuatkan arkib karya…";
   pending=win.fetch("karya-index.json",{headers:{Accept:"application/json"}})
    .then(r=>{if(!r.ok)throw Error("Arkib tidak tersedia");return r.json();})
    .then(data=>{if(!Array.isArray(data))throw Error("Format arkib tidak sah");
     poems=data.filter(p=>p&&typeof p.title==="string"&&Array.isArray(p.lines));
     filter();return poems.length;})
    .catch(()=>{status.textContent="Arkib gagal dimuatkan. Semak sambungan dan buka semula panel.";
     pending=null;return 0;});
   return pending;
  }
  function tab(name){
   selected=["works","wiki","url"].includes(name)?name:"works";
   for(const b of host.querySelectorAll("[data-tab]")){
    const yes=b.dataset.tab===selected;b.setAttribute("aria-selected",String(yes));b.tabIndex=yes?0:-1;
   }
   for(const part of ["Works","Wiki","Url"])get("knowledge"+part).hidden=part.toLowerCase()!==selected;
   warn("");if(selected==="works")load();
  }
  for(const b of host.querySelectorAll("[data-tab]"))b.addEventListener("click",()=>tab(b.dataset.tab));
  search.addEventListener("input",filter);
  get("knowledgeWikiDraft").addEventListener("click",()=>{
   if(!draft(wikipediaQuestion(get("knowledgeWikiQuery").value)))warn("Masukkan topik sekurang-kurangnya dua aksara.");
  });
  get("knowledgeUrlDraft").addEventListener("click",()=>{
   if(!draft(urlQuestion(get("knowledgeUrlInput").value)))warn("Masukkan URL HTTPS awam yang sah, bukan alamat setempat.");
  });
  for(const id of ["knowledgeWikiQuery","knowledgeUrlInput"])
   get(id).addEventListener("keydown",e=>{if(e.key==="Enter"){
    e.preventDefault();get(id==="knowledgeWikiQuery"?"knowledgeWikiDraft":"knowledgeUrlDraft").click();
   }});
  function renderSources(){
   const list=get("knowledgeSourcesList"),summary=get("knowledgeSourceSummary");
   list.replaceChildren();
   const evidence=win.AksaraObserveUI?.snapshot?.().research;
   if(!sources.length){
    summary.textContent=evidence?.state==="gagal"?"Permintaan terakhir gagal. Tiada rujukan baharu disahkan.":
     "Tiada pautan sumber untuk jawapan terakhir dalam tab ini.";return;
   }
   summary.textContent=sources.length+" pautan dipulangkan bersama jawapan terakhir."+
    (evidence?.label?" "+evidence.label+".":"")+" Semak sendiri sumber primer jika perlu.";
   for(const src of sources){
    const li=made("li"),a=made("a",src.title);
    a.href=src.url;a.target="_blank";a.rel="noopener noreferrer";li.append(a);list.append(li);
   }
  }
  win.addEventListener("ba:answered",e=>{
   sources=(Array.isArray(e.detail?.sources)?e.detail.sources:[]).slice(0,8)
    .map(x=>({title:String(x?.title||"").slice(0,110),url:safeLink(x?.url)}))
    .filter(x=>x.title&&x.url).slice(0,6);
   renderSources();
  });
  win.addEventListener("ba:request-failed",()=>{sources=[];renderSources();});
  for(const event of ["ba:session-changed","ba:cleared"])win.addEventListener(event,()=>{sources=[];renderSources();});
  trigger.addEventListener("click",()=>{if(selected==="works")load();renderSources();});
  renderSources();
  win.AksaraKnowledgeHubUI=Object.freeze({rankPoems,safeLink,wikipediaQuestion,urlQuestion,
   getLastSources:()=>sources.map(x=>({...x}))});
 }
 return Object.freeze({rankPoems,safeLink,wikipediaQuestion,urlQuestion,mount});
});