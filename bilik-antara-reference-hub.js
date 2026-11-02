/* AKSARA Pusat Rujukan v2
 * Karya awam dicari secara setempat daripada indeks sedia ada.
 * Wikipedia dan URL menggunakan backend asal HANYA selepas pengguna
 * menghantar soalan secara manual. Tiada API key, memori, atau auto-submit.
 */
(function(root,factory){
 "use strict";
 const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root?.document){root.AksaraReferenceHub=api;api.mount(root);}
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const TABS=Object.freeze(["karya","wikipedia","pautan"]);
 const fold=s=>String(s||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
  .toLocaleLowerCase("ms-MY").replace(/\s+/g," ").trim();
 function searchWorks(works,query,limit=5){
  if(!Array.isArray(works))return [];
  const q=fold(query).slice(0,90);
  if(q.length<2)return [];
  const tokens=q.split(/\s+/).filter(x=>x.length>=2).slice(0,9);
  return works.map((work,i)=>{
   if(!work||typeof work.title!=="string"||!Array.isArray(work.lines))return null;
   const title=fold(work.title),body=fold(work.lines.join(" ").slice(0,2500));
   let score=title.includes(q)?24:0;
   for(const token of tokens){
    if(title.includes(token))score+=9;
    if(body.includes(token))score+=2;
   }
   return score?{id:Number.isInteger(work.id)?work.id:i+1,title:work.title,
    preview:work.lines.filter(x=>typeof x==="string"&&x.trim()).slice(0,2).join(" ").slice(0,145),
    score}:null;
  }).filter(Boolean).sort((a,b)=>b.score-a.score||a.id-b.id)
   .slice(0,Math.max(0,Math.min(8,limit)));
 }
 function safePublicUrl(value){
  try{
   if(typeof value!=="string"||value.length>1200)return null;
   const u=new URL(value.trim());
   if(u.protocol!=="https:"||u.username||u.password||u.port&&u.port!=="443")return null;
   const host=u.hostname.toLowerCase().replace(/\.$/,"");
   if(!host.includes(".")||/^(localhost|0\.0\.0\.0)$/.test(host)||
     /\.(?:local|internal|localhost|test|invalid)$/.test(host)||
     host==="::1"||host.startsWith("[")||host.startsWith("127.")||
     host.startsWith("10.")||host.startsWith("192.168.")||
     host.startsWith("169.254.")||host.startsWith("172.")&&
     (Number(host.split(".")[1])>=16&&Number(host.split(".")[1])<=31))return null;
   if(/\b(?:key|token|secret|password|access_token|api_key|auth|credential|session)\b/i.test(u.searchParams.toString()))return null;
   u.hash="";return u.href;
  }catch(_){return null;}
 }
 function safeSources(data){
  const seen=new Set(),out=[];
  for(const item of Array.isArray(data)?data.slice(0,24):[]){
   const url=safePublicUrl(item?.url);
   if(!url||seen.has(url))continue;
   seen.add(url);
   out.push({title:String(item?.title||new URL(url).hostname).slice(0,115),url});
   if(out.length>=8)break;
  }
  return out;
 }
 function question(kind,raw){
  const text=String(raw||"").trim();
  if(kind==="karya"){
   if(!text||text.length>160)return {error:"Pilih karya daripada keputusan carian dahulu."};
   return {question:'Huraikan tema puisi "'+text+'" daripada arkib karya Shaiful Ridhwan. Bezakan petikan karya asal daripada tafsiran dan nyatakan jika rujukan tidak ditemui.'};
  }
  if(kind==="wikipedia"){
   if(text.length<3||text.length>70||/@|https?:\/\//i.test(text))
    return {error:"Masukkan topik ensiklopedia sepanjang 3–70 aksara tanpa pautan atau maklumat peribadi."};
   return {question:"Cari rujukan Wikipedia tentang "+text};
  }
  if(kind==="pautan"){
   const url=safePublicUrl(text);
   if(!url)return {error:"Gunakan URL awam HTTPS yang sah, tanpa token atau maklumat pengesahan."};
   return {question:"Baca teks halaman ini: "+url+" . Terangkan hanya kandungan yang berjaya diperoleh, sertakan sumber dan nyatakan jika visual, JavaScript atau akses halaman belum disahkan."};
  }
  if(kind==="kira")return {question:"Kira (12+8)*3"};
  return {error:"Jenis rujukan tidak dikenali."};
 }
 function mount(win){
  const doc=win.document,dialog=doc.getElementById("knowledgeDialog"),
   trigger=doc.getElementById("featureKnowledge"),root=doc.getElementById("referenceHub");
  if(!dialog||!trigger||!root)return null;
  const composer=doc.getElementById("input");
  root.innerHTML=[
   '<div class="reference-tabs" role="tablist" aria-label="Jenis rujukan">',
   '<button type="button" role="tab" id="referenceTabKarya" aria-controls="referencePanelKarya" aria-selected="true" data-reference-tab="karya">Karya</button>',
   '<button type="button" role="tab" id="referenceTabWikipedia" aria-controls="referencePanelWikipedia" aria-selected="false" data-reference-tab="wikipedia" tabindex="-1">Wikipedia</button>',
   '<button type="button" role="tab" id="referenceTabPautan" aria-controls="referencePanelPautan" aria-selected="false" data-reference-tab="pautan" tabindex="-1">Semak URL</button>',
   '</div>',
   '<section class="reference-pane" id="referencePanelKarya" role="tabpanel" aria-labelledby="referenceTabKarya">',
   '<label for="referenceWorkQuery">Cari dalam arkib puisi Shaiful Ridhwan</label>',
   '<input id="referenceWorkQuery" type="search" maxlength="90" placeholder="Contoh: aporia, cinta, resonans" autocomplete="off">',
   '<div class="reference-suggestions" aria-label="Carian contoh"><button type="button" data-reference-example="aporia">Aporia</button><button type="button" data-reference-example="sains">Sains</button><button type="button" data-reference-example="cinta">Cinta</button></div>',
   '<p class="reference-note" id="referenceWorkInfo" role="status">Arkib dimuat hanya apabila panel ini dibuka. Carian karya berlaku dalam pelayar.</p>',
   '<div class="reference-results" id="referenceWorkResults" aria-live="polite"></div>',
   '<a class="reference-archive" href="index.html#karya" target="_blank" rel="noopener noreferrer">Buka arkib penuh dalam tab baharu</a>',
   '</section>',
   '<section class="reference-pane" id="referencePanelWikipedia" role="tabpanel" aria-labelledby="referenceTabWikipedia" hidden>',
   '<label for="referenceWikiTopic">Topik ensiklopedia</label>',
   '<input id="referenceWikiTopic" type="text" maxlength="70" autocomplete="off" placeholder="Contoh: falsafah absurdisme">',
   '<p class="reference-note">AKSARA akan cuba mendapatkan ringkasan Wikipedia Bahasa Melayu atau Inggeris yang tersedia. Ini bukan jurnal akademik atau semakan berita langsung.</p>',
   '<button type="button" class="reference-primary" id="referencePrepareWiki">Sediakan soalan Wikipedia</button>',
   '</section>',
   '<section class="reference-pane" id="referencePanelPautan" role="tabpanel" aria-labelledby="referenceTabPautan" hidden>',
   '<label for="referenceUrl">URL laman awam</label>',
   '<input id="referenceUrl" type="url" inputmode="url" maxlength="500" autocomplete="off" spellcheck="false" placeholder="https://contoh.org/artikel">',
   '<p class="reference-note">Semakan teks URL bergantung pada alat penyedia yang tersedia. Ia bukan audit visual, JavaScript atau prestasi laman. Jangan masukkan pautan peribadi.</p>',
   '<button type="button" class="reference-primary" id="referencePrepareUrl">Sediakan semakan pautan</button>',
   '</section>',
   '<p id="referenceFormNotice" class="reference-form-notice" role="status" aria-live="polite"></p>',
   '<p class="reference-send-hint">Butang “Sediakan” hanya mengisi kotak chat. Tekan <strong>Hantar</strong> untuk membuat permintaan kepada AKSARA.</p>',
   '<section class="reference-extras" id="referenceSourcesSection" aria-label="Sumber dan bukti">',
   '<div class="reference-extras-head"><strong>Sumber jawapan terakhir</strong><span id="referenceSourceCount">0 pautan</span></div>',
   '<div id="referenceSourceList" class="reference-source-list" role="status">Belum ada sumber untuk jawapan baharu dalam sesi ini.</div>',
   '</section>',
   '<div class="reference-tool"><span>Alat tambahan · pengiraan setempat</span><button type="button" id="referencePrepareCalc">Sediakan contoh kiraan</button></div>'
  ].join("");
  const $=id=>doc.getElementById(id);
  let works=[],loaded=false,loading=null,active="karya",lastSources=[],lastLabel="Belum ada jawapan";
  const notice=(message,error=false)=>{
   const n=$("referenceFormNotice");
   n.textContent=message;n.dataset.error=String(error);
  };
  function prepare(kind,text){
   if(!composer)return;
   const built=question(kind,text);
   if(!built.question){notice(built.error,true);return;}
   composer.value=built.question;
   composer.dispatchEvent(new Event("input",{bubbles:true}));
   dialog.close();
   win.setTimeout(()=>composer.focus({preventScroll:true}),0);
  }
  function show(tab){
   active=TABS.includes(tab)?tab:"karya";
   for(const key of TABS){
    const trigger=$("referenceTab"+key[0].toUpperCase()+key.slice(1));
    const panel=$("referencePanel"+key[0].toUpperCase()+key.slice(1));
    const on=key===active;
    trigger.setAttribute("aria-selected",String(on));
    trigger.tabIndex=on?0:-1;panel.hidden=!on;
   }
   notice("");
   if(active==="karya")ensureWorks();
  }
  const tabs=Array.from(root.querySelectorAll('[role="tab"]'));
  tabs.forEach((tab,i)=>{
   tab.addEventListener("click",()=>show(tab.dataset.referenceTab));
   tab.addEventListener("keydown",event=>{
    let n=i;
    if(event.key==="ArrowRight")n=(i+1)%tabs.length;
    else if(event.key==="ArrowLeft")n=(i+tabs.length-1)%tabs.length;
    else if(event.key==="Home")n=0;
    else if(event.key==="End")n=tabs.length-1;
    else return;
    event.preventDefault();tabs[n].focus();show(tabs[n].dataset.referenceTab);
   });
  });
  function renderWorks(){
   const query=$("referenceWorkQuery").value.trim(),list=$("referenceWorkResults");
   list.replaceChildren();
   if(!loaded){$("referenceWorkInfo").textContent="Arkib belum boleh dibuka.";return;}
   if(query.length<2){$("referenceWorkInfo").textContent=works.length+" karya tersedia · Taip sekurang-kurangnya 2 aksara.";return;}
   const found=searchWorks(works,query);
   $("referenceWorkInfo").textContent=found.length?
    "Menunjukkan "+found.length+" padanan terbaik daripada "+works.length+" karya.":"Tiada karya yang sepadan dengan carian ini.";
   for(const item of found){
    const card=doc.createElement("article");card.className="reference-work";
    const heading=doc.createElement("strong");heading.textContent=item.title;
    const preview=doc.createElement("p");preview.textContent=item.preview;
    const actions=doc.createElement("div");actions.className="reference-work-actions";
    const href=doc.createElement("a");href.href="index.html?cari="+encodeURIComponent(item.title)+"#karya";
    href.target="_blank";href.rel="noopener noreferrer";href.textContent="Baca dalam arkib";
    const ask=doc.createElement("button");ask.type="button";ask.textContent="Tanya AKSARA";
    ask.addEventListener("click",()=>prepare("karya",item.title));
    actions.append(href,ask);card.append(heading,preview,actions);list.append(card);
   }
  }
  async function ensureWorks(){
   if(loaded){renderWorks();return;}
   if(loading)return loading;
   $("referenceWorkInfo").textContent="Membaca indeks karya awam…";
   loading=(async()=>{
    try{
     const res=await win.fetch("karya-index.json",{cache:"force-cache"});
     if(!res.ok)throw Error("Indeks tidak tersedia");
     const records=await res.json();
     if(!Array.isArray(records)||records.length>400)throw Error("Format indeks tidak sah");
     works=records.filter(x=>x&&typeof x.title==="string"&&
      x.title.length<=180&&Array.isArray(x.lines)&&x.lines.length<=120);
     loaded=true;renderWorks();
    }catch(_){
     $("referenceWorkInfo").textContent="Indeks karya gagal dimuat. Gunakan pautan arkib penuh di bawah.";
    }finally{loading=null;}
   })();
   return loading;
  }
  $("referenceWorkQuery").addEventListener("input",renderWorks);
  root.querySelectorAll("[data-reference-example]").forEach(btn=>btn.addEventListener("click",()=>{
   $("referenceWorkQuery").value=btn.dataset.referenceExample;
   renderWorks();$("referenceWorkQuery").focus();
  }));
  $("referencePrepareWiki").addEventListener("click",()=>prepare("wikipedia",$("referenceWikiTopic").value));
  $("referencePrepareUrl").addEventListener("click",()=>prepare("pautan",$("referenceUrl").value));
  $("referencePrepareCalc").addEventListener("click",()=>prepare("kira",""));
  for(const [id,btn] of [["referenceWikiTopic","referencePrepareWiki"],["referenceUrl","referencePrepareUrl"]]){
   $(id).addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();$(btn).click();}});
  }
  function renderSources(){
   const box=$("referenceSourceList");box.replaceChildren();
   $("referenceSourceCount").textContent=lastSources.length+" pautan";
   const caption=doc.createElement("p");caption.className="reference-note";
   caption.textContent=lastLabel;
   box.append(caption);
   if(!lastSources.length){
    const text=doc.createElement("p");text.className="reference-note";
    text.textContent="Tiada pautan sumber disahkan untuk dipaparkan dalam sesi ini.";
    box.append(text);return;
   }
   const list=doc.createElement("ol");
   for(const entry of lastSources){
    const li=doc.createElement("li"),a=doc.createElement("a");
    a.href=entry.url;a.target="_blank";a.rel="noopener noreferrer";
    a.textContent=entry.title;li.append(a);list.append(li);
   }
   box.append(list);
  }
  win.addEventListener("ba:answered",e=>{
   const d=e.detail||{};
   lastSources=safeSources(d.sources);
   const research=win.AksaraObserve?.classifyResearch?.(d);
   lastLabel=research?.label||"Pautan daripada respons terakhir · kesahihan kandungan belum dinilai";
   renderSources();
  });
  win.addEventListener("ba:request-failed",()=>{
   // Keep the last successful sources, but don't claim they support the failed request.
   lastLabel="Permintaan terkini gagal. Pautan ini datang daripada respons berjaya sebelumnya.";
   renderSources();
  });
  for(const event of ["ba:session-changed","ba:cleared"])win.addEventListener(event,()=>{
   lastSources=[];lastLabel="Tiada bukti carian untuk sesi baharu";renderSources();
  });
  trigger.addEventListener("click",()=>{if(active==="karya")ensureWorks();});
  renderSources();show("karya");
  win.AksaraReferenceHubUI=Object.freeze({
   snapshot:()=>({active,loaded,count:works.length,sources:lastSources.map(x=>({...x})),lastLabel}),
   search:q=>searchWorks(works,q)
  });
  return win.AksaraReferenceHubUI;
 }
 return Object.freeze({mount,searchWorks,safePublicUrl,safeSources,question,TABS});
});
