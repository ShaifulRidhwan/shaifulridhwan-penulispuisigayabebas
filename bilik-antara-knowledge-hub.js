/* AKSARA Pusat Rujukan v3 · carian karya setempat, Wikipedia, URL dan kalkulator.
 * Tiada carian automatik, tiada indeks peribadi, dan tiada kunci API pada pelayar.
 */
(function(root,factory){
 "use strict";
 const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root?.document){root.AksaraKnowledgeHub=api;api.mount(root);}
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const MODES=Object.freeze(["karya","wikipedia","url","kira"]);
 const LABELS=Object.freeze({karya:"Karya",wikipedia:"Wikipedia",url:"Semak URL",kira:"Kira"});
 const GUIDES=Object.freeze({
  karya:"Cari tajuk atau tema dalam indeks puisi awam AKSARA. Carian ini berdasarkan padanan teks, bukan pangkalan vektor.",
  wikipedia:"Cari ringkasan ensiklopedia awam melalui Wikipedia Melayu dan Inggeris. Sumber disertakan apabila tersedia.",
  url:"Sediakan pautan awam untuk dibaca melalui chat. Kebolehan membuka URL bergantung kepada penyedia AI dan alat web yang tersedia.",
  kira:"Kira ungkapan matematik dengan parser terhad. Tidak menggunakan eval atau model AI."
 });
 const normalize=x=>String(x||"").toLocaleLowerCase("ms-MY").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim();
 function searchWorks(items,query,limit=8){
  const q=normalize(query),terms=q.split(" ").filter(x=>x.length>1);
  return (Array.isArray(items)?items:[]).filter(x=>x&&typeof x.title==="string"&&Array.isArray(x.lines))
   .map(x=>{
    const title=normalize(x.title),body=normalize(x.lines.join(" ").slice(0,1800));
    let rank=q?(title===q?100:title.includes(q)?38:body.includes(q)?12:0):1;
    for(const term of terms){if(title.includes(term))rank+=9;else if(body.includes(term))rank+=2;}
    return {id:x.id,title:x.title,excerpt:x.lines.filter(Boolean).slice(0,3).join(" ").slice(0,175),rank};
   }).filter(x=>x.rank>0).sort((a,b)=>b.rank-a.rank||a.id-b.id)
   .slice(0,Math.min(10,Math.max(1,limit)));
 }
 function publicUrl(input){
  if(typeof input!=="string"||input.length>800)return null;
  try{
   const u=new URL(input.trim());
   if(u.protocol!=="https:"||u.username||u.password||!u.hostname||u.port)return null;
   const host=u.hostname.toLowerCase();
   if(host==="localhost"||host.endsWith(".local")||host.endsWith(".internal")||
    /^\[.*\]$/.test(host)||/^\d+(?:\.\d+){0,3}$/.test(host))return null;
   return u.href;
  }catch(_){return null;}
 }
 function trustedSource(url){
  return publicUrl(url);
 }
 function mount(win){
  const doc=win.document,dialog=doc.getElementById("knowledgeDialog");
  if(!dialog||doc.getElementById("knowledgeHubV3"))return;
  const legacy=dialog.querySelector(".multi-ai-actions");
  const panel=doc.createElement("section");panel.id="knowledgeHubV3";panel.className="knowledge-hub";
  const tabs=doc.createElement("div");tabs.className="knowledge-hub-tabs";tabs.setAttribute("role","tablist");
  const form=doc.createElement("form");form.id="knowledgeHubForm";form.className="knowledge-hub-form";
  const label=doc.createElement("label");label.htmlFor="knowledgeHubInput";label.textContent="Topik atau kata kunci";
  const controls=doc.createElement("div");controls.className="knowledge-hub-controls";
  const input=doc.createElement("input");input.id="knowledgeHubInput";input.type="search";
  input.autocomplete="off";input.maxLength=800;input.spellcheck=false;
  const submit=doc.createElement("button");submit.type="submit";submit.id="knowledgeHubSubmit";
  controls.append(input,submit);form.append(label,controls);
  const guide=doc.createElement("p");guide.id="knowledgeHubGuide";guide.className="knowledge-hub-guide";
  const status=doc.createElement("p");status.id="knowledgeHubStatus";status.className="knowledge-hub-status";
  status.setAttribute("role","status");status.setAttribute("aria-live","polite");
  const results=doc.createElement("div");results.id="knowledgeHubResults";
  results.className="knowledge-hub-results";
  const last=doc.createElement("details");last.id="knowledgeHubSources";last.className="knowledge-hub-sources";
  const lastTitle=doc.createElement("summary");lastTitle.textContent="Sumber jawapan terakhir";
  const lastBody=doc.createElement("div");lastBody.id="knowledgeHubSourcesList";
  last.append(lastTitle,lastBody);
  panel.append(tabs,form,guide,status,results,last);
  const before=doc.getElementById("webObserveV2")||legacy;
  dialog.insertBefore(panel,before);
  if(legacy){legacy.hidden=true;legacy.setAttribute("aria-hidden","true");}
  const styles=doc.createElement("style");styles.id="knowledgeHubStyles";
  styles.textContent=[
   '.knowledge-hub{display:grid;gap:10px;margin:0 0 4px;min-width:0}',
   '.knowledge-hub-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}',
   '.multi-ai-dialog .knowledge-hub-tabs button{min-width:0;min-height:39px;padding:7px 3px;border-radius:9px;font-size:10px;text-align:center}',
   '.knowledge-hub-tabs button[aria-selected="true"]{background:rgba(232,194,141,.18);border-color:rgba(236,203,153,.68);color:#ffe3b4}',
   '.knowledge-hub-form{display:grid;gap:5px}',
   '.knowledge-hub-form label{font:600 11px/1.4 "DM Sans",sans-serif;color:#e0cda9}',
   '.knowledge-hub-controls{display:flex;align-items:stretch;gap:6px;min-width:0}',
   '.knowledge-hub-controls input{box-sizing:border-box;width:100%;min-width:0;flex:1;color:#f4e9d8;background:rgba(8,14,27,.54);border:1px solid rgba(221,192,147,.3);border-radius:10px;padding:10px 11px;font:500 12px/1.4 "DM Sans",sans-serif;outline:none}',
   '.knowledge-hub-controls input:focus{border-color:#e9c48c;box-shadow:0 0 0 2px rgba(235,198,145,.12)}',
   '.multi-ai-dialog .knowledge-hub-controls button{flex:none;padding:9px 12px;background:rgba(224,183,121,.12);font-weight:600}',
   '.knowledge-hub-guide,.knowledge-hub-status{margin:0!important;font:400 11px/1.5 "DM Sans",sans-serif!important;color:#c9c0b2}',
   '.knowledge-hub-status{min-height:0;color:#e6c88f}',
   '.knowledge-hub-results{display:grid;gap:7px;max-height:min(275px,34dvh);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}',
   '.knowledge-hub-result{border:1px solid rgba(229,203,168,.17);border-radius:10px;padding:10px 11px;background:rgba(255,255,255,.025);display:grid;gap:5px;min-width:0}',
   '.knowledge-hub-result strong{font:600 12px/1.4 "DM Sans",sans-serif;color:#f1e4cd;overflow-wrap:anywhere}',
   '.knowledge-hub-result p{margin:0!important;font:400 11px/1.5 "DM Sans",sans-serif!important;color:#c5bcaf;overflow-wrap:anywhere}',
   '.knowledge-hub-result-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:4px}',
   '.knowledge-hub-result-actions a,.knowledge-hub-result-actions button{font:600 10.5px/1.4 "DM Sans",sans-serif;color:#f1d8ac}',
   '.knowledge-hub-result-actions a{display:inline-flex;align-items:center;padding:8px 10px;border:1px solid rgba(233,198,151,.32);border-radius:9px;text-decoration:none}',
   '.multi-ai-dialog .knowledge-hub-result-actions button{padding:7px 10px;min-height:32px;font-size:10.5px}',
   '.knowledge-hub-sources{border-top:1px solid rgba(226,192,147,.18);padding:9px 0 0}',
   '.knowledge-hub-sources summary{cursor:pointer;color:#dbcaa9;font:600 11px/1.4 "DM Sans",sans-serif}',
   '#knowledgeHubSourcesList{display:grid;gap:6px;padding:9px 0;font:400 11px/1.55 "DM Sans",sans-serif;color:#c6bbaa}',
   '#knowledgeHubSourcesList a{color:#e6c88f;overflow-wrap:anywhere}',
   '.multi-ai-dialog .multi-ai-actions[hidden]{display:none!important}',
   '@media(max-width:420px){.knowledge-hub{gap:8px}.multi-ai-dialog .knowledge-hub-tabs button{font-size:9.5px;padding:7px 1px}.knowledge-hub-result{padding:9px}}'
  ].join("\n");
  doc.head.append(styles);
  let mode="karya",works=null,loadingWorks=null,busy=false,generation=0,sourceItems=[];
  const rows={};
  const clear=node=>{while(node.firstChild)node.removeChild(node.firstChild);};
  const make=(tag,text,className)=>{
   const el=doc.createElement(tag);
   if(className)el.className=className;
   if(text!==undefined)el.textContent=String(text);
   return el;
  };
  function tell(message){status.textContent=message||"";}
  function attachActions(card,url,question){
   const wrap=make("div",undefined,"knowledge-hub-result-actions");
   if(url){
    const link=make("a","Buka sumber");link.href=url;link.target="_blank";link.rel="noopener noreferrer";
    wrap.append(link);
   }
   if(question){
    const ask=make("button","Sediakan soalan");ask.type="button";ask.title="Isi soalan dalam chat. Tekan Hantar selepas menyemaknya.";
    ask.addEventListener("click",()=>handoff(question));wrap.append(ask);
   }
   card.append(wrap);
  }
  function handoff(question){
   const chat=doc.getElementById("input");if(!chat)return false;
   const prepared=String(question).slice(0,1300),draft=chat.value.trim();
   // Jangan padam draf yang belum dihantar apabila memilih rujukan lain.
   chat.value=draft&&draft!==prepared?draft+"\n\n"+prepared:prepared;
   chat.dispatchEvent(new Event("input",{bubbles:true}));
   dialog.close();chat.focus({preventScroll:true});
   return true; // User must still press Hantar.
  }
  function resultCard(title,description,url=null,question=null){
   const card=make("article",undefined,"knowledge-hub-result");
   card.append(make("strong",title));
   if(description)card.append(make("p",description));
   attachActions(card,url,question);
   results.append(card);
  }
  function showLastSources(){
   clear(lastBody);
   if(!sourceItems.length){lastBody.append(make("p","Tiada sumber dipautkan daripada jawapan terakhir dalam sesi ini."));return;}
   lastBody.append(make("p","Pautan ini datang daripada jawapan AI. Kehadirannya bukan bukti bahawa halaman dibaca sepenuhnya."));
   for(const s of sourceItems){
    const href=trustedSource(s.url);if(!href)continue;
    const link=make("a",s.title||"Sumber");link.href=href;link.target="_blank";link.rel="noopener noreferrer";
    lastBody.append(link);
   }
  }
  function selectMode(next){
   if(!MODES.includes(next))return;
   mode=next;generation++;busy=false;clear(results);tell("");
   for(const name of MODES){rows[name].setAttribute("aria-selected",String(name===mode));rows[name].tabIndex=name===mode?0:-1;}
   guide.textContent=GUIDES[mode];
   label.textContent=mode==="url"?"Pautan HTTPS awam":mode==="kira"?"Ungkapan matematik":mode==="karya"?"Tajuk atau tema puisi":"Topik ensiklopedia";
   input.placeholder=mode==="karya"?"Contoh: aporia, akal, cinta":mode==="wikipedia"?"Contoh: falsafah, entropi":
    mode==="url"?"https://contoh.org/artikel":"Contoh: (12+8)*3";
   input.maxLength=mode==="url"?800:mode==="kira"?120:mode==="wikipedia"?85:150;
   input.value="";submit.disabled=false;
   submit.textContent=mode==="url"?"Ke chat":mode==="kira"?"Kira":"Cari";
   if(mode==="url")tell("URL akan disediakan dalam chat; ia tidak dibuka secara automatik dari panel ini.");
   if(mode==="kira")tell("Hanya +, −, ×, ÷, %, ^ dan kurungan disokong.");
   input.focus({preventScroll:true});
  }
  for(const name of MODES){
   const tab=make("button",LABELS[name]);tab.type="button";tab.id="knowledgeTab-"+name;
   tab.setAttribute("role","tab");tab.setAttribute("aria-controls","knowledgeHubResults");
   tab.addEventListener("click",()=>selectMode(name));tabs.append(tab);rows[name]=tab;
  }
  async function loadWorks(){
   if(works)return works;
   if(!loadingWorks)loadingWorks=fetch("karya-index.json",{cache:"force-cache"})
    .then(r=>{if(!r.ok)throw Error("Indeks karya tidak dapat dicapai.");return r.json();})
    .then(data=>{if(!Array.isArray(data))throw Error("Indeks karya tidak sah.");works=data.slice(0,400);return works;})
    .finally(()=>{loadingWorks=null;});
   return loadingWorks;
  }
  async function post(body){
   const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),11000);
   try{
    const response=await fetch("/.netlify/functions/aksara-reference-hub",{
     method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:ctrl.signal
    });
    const data=await response.json();
    if(!response.ok)throw Error(typeof data.error==="string"?data.error:"Carian tidak berjaya.");
    return data;
   }finally{clearTimeout(timer);}
  }
  async function lookup(event){
   event.preventDefault();if(busy)return;
   const q=input.value.trim(),stamp=++generation,kind=mode;
   clear(results);
   if(kind==="url"){
    const url=publicUrl(q);
    if(!url){tell("Masukkan URL HTTPS awam yang sah. Alamat setempat tidak dibenarkan.");return;}
    handoff("Baca dan semak kandungan URL ini: "+url+". Bezakan teks yang benar-benar dapat dibaca daripada dakwaan tanpa bukti. Sertakan pautan sumber.");
    return;
   }
   if(kind==="kira"&&!q){tell("Masukkan ungkapan yang hendak dikira.");return;}
   if(kind==="wikipedia"&&(q.length<3||q.length>85)){tell("Masukkan topik antara 3 hingga 85 aksara.");return;}
   busy=true;submit.disabled=true;tell(kind==="karya"?"Membaca indeks karya…":kind==="wikipedia"?"Mencari ringkasan Wikipedia…":"Mengira…");
   try{
    if(kind==="karya"){
     const poems=searchWorks(await loadWorks(),q,8);
     if(stamp!==generation)return;
     tell(poems.length?poems.length+" karya ditemui daripada indeks setempat.":"Tiada padanan. Cuba tajuk atau kata kunci lain.");
     for(const p of poems)resultCard(p.title,p.excerpt,
      "index.html?karya="+encodeURIComponent(p.title)+"#karya",
      "Terangkan puisi AKSARA bertajuk "+p.title+" berdasarkan karya asal. Bezakan petikan sebenar daripada tafsiran.");
    }else if(kind==="wikipedia"){
     const data=await post({action:"wikipedia",query:q});
     if(stamp!==generation)return;
     const list=Array.isArray(data.sources)?data.sources:[];
     tell(list.length?list.length+" ringkasan Wikipedia diperoleh. Semak artikel asal untuk konteks penuh.":
      data.note||"Tiada hasil yang dapat disahkan.");
     for(const item of list){
      const href=trustedSource(item?.url);
      if(!href||!/^https:\/\/(?:ms|en)\.wikipedia\.org\/wiki\//i.test(href))continue;
      resultCard(item.title||"Wikipedia",String(item.excerpt||"").slice(0,320),href,
       "Cari rujukan Wikipedia tentang "+(item.title||q)+". Bezakan fakta bersumber daripada tafsiran, dan sertakan pautan.");
     }
    }else if(kind==="kira"){
     const data=await post({action:"calculate",expression:q});
     if(stamp!==generation)return;
     tell("Pengiraan diselesaikan oleh parser matematik terhad, bukan model AI.");
     resultCard(q+" = "+String(data.result),"Keputusan pengiraan matematik. Tiada kod bebas dijalankan.");
    }
   }catch(error){
    if(stamp!==generation)return;
    tell(error?.name==="AbortError"?"Permintaan tamat masa. Cuba lagi.":String(error?.message||"Semakan gagal.").slice(0,180));
   }finally{if(stamp===generation){busy=false;submit.disabled=false;}}
  }
  form.addEventListener("submit",lookup);
  win.addEventListener("ba:answered",event=>{
   sourceItems=(Array.isArray(event.detail?.sources)?event.detail.sources:[])
    .filter(s=>s&&typeof s.url==="string"&&trustedSource(s.url))
    .slice(0,8).map(s=>({url:s.url,title:String(s.title||"Sumber").slice(0,140)}));
   showLastSources();
  });
  win.addEventListener("ba:request-failed",()=>{sourceItems=[];showLastSources();});
  for(const event of ["ba:session-changed","ba:cleared"])win.addEventListener(event,()=>{
   sourceItems=[];showLastSources();
  });
  selectMode("karya");showLastSources();
  win.AksaraKnowledgeHubUI=Object.freeze({
   snapshot:()=>({mode,busy,hasLocalIndex:!!works,sourceCount:sourceItems.length}),
   selectMode
  });
  return win.AksaraKnowledgeHubUI;
 }
 return Object.freeze({MODES,LABELS,GUIDES,searchWorks,publicUrl,mount});
});
