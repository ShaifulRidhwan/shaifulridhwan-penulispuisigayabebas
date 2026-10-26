(function(){
"use strict";
/* Free, client-only suite. No backend database, telemetry or third-party JS. */
const api=window.BilikAntaraBridge;
if(!api)return;
const PREFIX="bilik-antara-suite-v1";
const KEYS={archive:PREFIX+"-archive",memory:PREFIX+"-memory",workspace:PREFIX+"-workspace",metrics:PREFIX+"-metrics"};
const $=id=>document.getElementById(id);
const make=(tag,text,cls)=>{
 const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);
 if(cls)e.className=cls;return e;
};
const button=(label,action,cls)=>{
 const b=make("button",label,cls||"ba-button");b.type="button";b.addEventListener("click",action);return b;
};
const read=(key,fallback)=>{
 try{const v=JSON.parse(localStorage.getItem(key)||"null");return v===null?fallback:v;}catch(_){return fallback;}
};
const write=(key,obj)=>{
 try{localStorage.setItem(key,JSON.stringify(obj));return true;}catch(_){notice("Ruang simpanan pelayar penuh atau disekat.");return false;}
};
function freshId(){return "s"+Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
let activeId="";
try{activeId=sessionStorage.getItem(PREFIX+"-active")||freshId();sessionStorage.setItem(PREFIX+"-active",activeId);}catch(_){activeId=freshId();}
let archive=Array.isArray(read(KEYS.archive,[]))?read(KEYS.archive,[]):[];
let memory=read(KEYS.memory,{enabled:false,text:""});
if(!memory||typeof memory!=="object")memory={enabled:false,text:""};
let workspace=read(KEYS.workspace,{title:"",content:"",at:0});
if(!workspace||typeof workspace!=="object")workspace={title:"",content:"",at:0};
let metrics=read(KEYS.metrics,{calls:0,tokens:0,durations:[],times:[]});
if(!metrics||typeof metrics!=="object")metrics={calls:0,tokens:0,durations:[],times:[]};
let currentPanel="";
const convo=document.querySelector(".conversation");
if(!convo)return;
const toolbar=make("div",undefined,"ba-toolbar");
toolbar.setAttribute("role","group");toolbar.setAttribute("aria-label","Alat percuma Bilik Antara");
const drawer=make("aside",undefined,"ba-drawer");
drawer.hidden=true;drawer.setAttribute("aria-label","Alat dan penyimpanan setempat");
const sheet=make("div",undefined,"ba-sheet"),top=make("div",undefined,"ba-drawer-top");
const title=make("strong","Alat Bilik Antara");
top.append(title,button("✕",()=>close(),"ba-close"));
const content=make("div",undefined,"ba-content");
sheet.append(top,content);drawer.appendChild(sheet);
const backdrop=button("",()=>close(),"ba-backdrop");backdrop.setAttribute("aria-label","Tutup panel");drawer.prepend(backdrop);
const head=convo.querySelector(".conversation-head");
head.after(toolbar);
convo.appendChild(drawer);
const labels=[["sessions","Sesi"],["memory","Memori"],["workspace","Ruang kerja"],["metrics","Prestasi"]];
for(const [key,label] of labels)toolbar.appendChild(button(label,()=>open(key),"ba-tab"));
function notice(message){
 let status=$("baNotification");
 if(!status){status=make("div",undefined,"ba-notification");status.id="baNotification";status.setAttribute("role","status");toolbar.after(status);}
 status.textContent=String(message||"").slice(0,240);
}
function open(panel){
 currentPanel=panel;drawer.hidden=false;document.body.classList.add("ba-panel-open");
 render();
}
function close(){drawer.hidden=true;currentPanel="";document.body.classList.remove("ba-panel-open");}
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!drawer.hidden)close();});
function section(text){content.appendChild(make("h3",text,"ba-h3"));}
function paragraph(text){content.appendChild(make("p",text,"ba-hint"));}
function controlRow(...nodes){const row=make("div",undefined,"ba-row");row.append(...nodes);content.appendChild(row);return row;}
function persistArchive(){
 if(!api.remember())return false;
 archive=archive.filter(x=>x&&typeof x.id==="string"&&Array.isArray(x.history))
   .sort((a,b)=>(Number(b.pinned)-Number(a.pinned))||(b.at-a.at)).slice(0,15);
 return write(KEYS.archive,archive);
}
function snapshotCurrent(){
 if(!api.remember())return;
 const snapshot=api.snapshot();
 if(!snapshot.history.length)return;
 const idx=archive.findIndex(x=>x.id===activeId);
 const old=archive[idx]||{};
 const first=snapshot.history.find(x=>x.role==="user");
 const entry={id:activeId,title:(first&&first.content||"Perbualan baharu").slice(0,75),at:Date.now(),
  pinned:!!old.pinned,history:snapshot.history,summary:snapshot.summary,thoughtLedger:snapshot.thoughtLedger};
 if(idx>=0)archive.splice(idx,1);archive.unshift(entry);persistArchive();
}
window.addEventListener("ba:saved",snapshotCurrent);
window.addEventListener("ba:cleared",()=>{
 archive=archive.filter(x=>x.id!==activeId);
 try{localStorage.removeItem(KEYS.archive);}catch(_){}
 // A deliberate clear does not silently delete other archived sessions; provide an explicit delete-all action.
 if(currentPanel==="sessions")render();
});
window.addEventListener("ba:storage",event=>{
 if(!event.detail||event.detail.enabled)return;
 // Opting out of conversation storage removes the entire local conversation archive.
 archive=[];try{localStorage.removeItem(KEYS.archive);}catch(_){}
 if(currentPanel==="sessions")render();
});
function beginSession(entry){
 if(api.active()){notice("Tunggu jawapan semasa selesai dahulu.");return;}
 snapshotCurrent();
 const next=entry&&entry.id||freshId();
 const ok=entry?api.load(entry):api.fresh();
 if(!ok)return;
 activeId=next;
 try{sessionStorage.setItem(PREFIX+"-active",activeId);}catch(_){}
 if(entry&&api.remember())snapshotCurrent();
 close();notice(entry?"Sesi dipulihkan.":"Sesi baharu bermula.");
}
function download(name,contents,mime){
 const blob=new Blob([contents],{type:mime||"text/plain;charset=utf-8"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),5000);
}
function sessionText(history){
 return history.map(m=>(m.role==="user"?"PENGGUNA":"AI")+"\n"+String(m.content||"")).join("\n\n---\n\n");
}
function renderSessions(){
 section("Sejarah perbualan");
 paragraph("Sesi disimpan pada peranti ini sahaja apabila 'Simpan sesi pada peranti ini' diaktifkan. Maksimum 15 sesi.");
 controlRow(button("+ Sesi baharu",()=>beginSession(null)),button("Eksport sesi ini",()=>{
  download("bilik-antara-sesi.md",sessionText(api.snapshot().history),"text/markdown;charset=utf-8");
 }));
 if(!api.remember()){paragraph("Penyimpanan perbualan belum diaktifkan. Hidupkannya melalui Privasi & sesi untuk menyimpan sejarah.");return;}
 const search=make("input");search.type="search";search.placeholder="Cari sejarah perbualan…";search.className="ba-input";
 content.appendChild(search);
 const results=make("div",undefined,"ba-list");content.appendChild(results);
 function draw(){
  results.replaceChildren();
  const term=search.value.toLocaleLowerCase("ms-MY");
  const data=archive.filter(item=>(item.title+" "+sessionText(item.history)).toLocaleLowerCase("ms-MY").includes(term));
  if(!data.length){results.appendChild(make("p","Tiada perbualan yang sepadan.","ba-hint"));return;}
  for(const item of data){
   const row=make("div",undefined,"ba-session");
   const summary=button((item.pinned?"★ ":"")+item.title,()=>beginSession(item),"ba-session-title");
   const date=make("small",new Date(item.at||Date.now()).toLocaleString("ms-MY"),"ba-hint");
   const controls=make("div",undefined,"ba-row");
   controls.append(
    button(item.pinned?"Nyahpin":"Pin",()=>{item.pinned=!item.pinned;persistArchive();draw();},"ba-tiny"),
    button("Eksport",()=>download("bilik-antara-"+item.id+".md",sessionText(item.history),"text/markdown;charset=utf-8"),"ba-tiny"),
    button("Padam",()=>{if(!confirm("Padam sesi tersimpan ini?"))return;archive=archive.filter(x=>x.id!==item.id);persistArchive();draw();},"ba-tiny")
   );
   row.append(summary,date,controls);results.appendChild(row);
  }
 }
 search.addEventListener("input",draw);draw();
 controlRow(button("Eksport semua sesi (JSON)",()=>download("bilik-antara-arkib.json",JSON.stringify(archive,null,2),"application/json")),
  button("Padam semua sejarah",()=>{if(!confirm("Padam SEMUA sesi yang disimpan pada peranti ini?"))return;archive=[];persistArchive();render();}));
}
function renderMemory(){
 section("Memori pilihan pengguna");
 paragraph("Memori ini berbeza daripada sejarah sesi. Hanya perkara yang kau tulis dan izinkan akan dihantar sebagai konteks kepada Gemini. Tidak menyimpan identiti atau butiran peribadi secara automatik.");
 const toggle=make("input");toggle.type="checkbox";toggle.checked=!!memory.enabled;
 const label=make("label"," Aktifkan memori");label.prepend(toggle);content.appendChild(label);
 const field=make("textarea");field.className="ba-editor";field.rows=8;field.maxLength=1200;
 field.value=typeof memory.text==="string"?memory.text:"";
 field.placeholder="Contoh: Aku suka Bahasa Melayu santai, jawapan ringkas, dan sedang membina laman web…";
 content.appendChild(field);
 controlRow(button("Simpan memori",()=>{
  memory={enabled:toggle.checked,text:field.value.trim().slice(0,1200)};
  write(KEYS.memory,memory);notice("Pilihan memori disimpan pada peranti.");render();
 }),button("Padam memori",()=>{
  if(!confirm("Padam semua memori pilihan di peranti ini?"))return;
  memory={enabled:false,text:""};try{localStorage.removeItem(KEYS.memory);}catch(_){}
  notice("Memori pilihan dipadam.");render();
 }));
 paragraph("Elakkan memasukkan kata laluan, maklumat kesihatan atau butiran sulit. Tetapan ini khusus untuk pelayar/peranti yang sedang digunakan.");
}
function renderWorkspace(){
 section("Ruang kerja");
 paragraph("Draf boleh disunting, disalin dan dieksport tanpa API berbayar.");
 const name=make("input");name.className="ba-input";name.placeholder="Tajuk draf";name.value=workspace.title||"";
 const field=make("textarea");field.className="ba-editor ba-editor--large";field.rows=16;field.placeholder="Teks draf…";field.value=workspace.content||"";
 content.append(name,field);
 controlRow(
  button("Simpan draf",()=>{
   workspace={title:name.value.slice(0,100),content:field.value.slice(0,50000),at:Date.now()};
   if(api.remember())write(KEYS.workspace,workspace);
   notice(api.remember()?"Draf disimpan pada peranti.":"Draf dalam ingatan tab sahaja. Hidupkan simpan sesi untuk kekalkan.");
  }),
  button("Eksport .md",()=>download((name.value.trim().replace(/[^\w-]+/g,"-").slice(0,55)||"draf")+".md",field.value,"text/markdown;charset=utf-8")),
  button("Salin",()=>copyText(field.value))
 );
 controlRow(button("Ambil jawapan terakhir",()=>{
  const latest=api.latest();
  if(!latest||latest.role!=="assistant"){notice("Tiada jawapan AI untuk disalin.");return;}
  field.value=latest.content;name.value="Jawapan AI";
 }),button("Kosongkan draf",()=>{
  if(!confirm("Kosongkan draf ruang kerja?"))return;
  field.value="";name.value="";workspace={title:"",content:"",at:0};
  try{localStorage.removeItem(KEYS.workspace);}catch(_){}
 }));
}
async function copyText(text){
 try{await navigator.clipboard.writeText(String(text||""));notice("Teks disalin.");}
 catch(_){notice("Pelayar menyekat fungsi salin. Pilih teks secara manual.");}
}
function renderMetrics(){
 section("Prestasi peranti ini");
 paragraph("Statistik ini dikumpul secara setempat daripada jawapan yang diterima, bukan laporan keseluruhan pengguna laman. Tiada data dihantar kepada sistem analitik luaran.");
 const values=[
  ["Respons berjaya",metrics.calls||0],
  ["Token dilaporkan",metrics.tokens||0],
  ["Purata masa respons",metrics.durations?.length?Math.round(metrics.durations.reduce((a,b)=>a+b,0)/metrics.durations.length)/1000+" s":"Belum ada data"]
 ];
 for(const [k,v] of values){const row=make("div",undefined,"ba-metric");row.append(make("span",k),make("strong",v));content.appendChild(row);}
 controlRow(button("Padam statistik",()=>{metrics={calls:0,tokens:0,durations:[],times:[]};try{localStorage.removeItem(KEYS.metrics);}catch(_){}render();}));
 paragraph("Status carian langsung: dimatikan untuk mengelakkan ciri Google Search berbayar pada tier percuma Gemini 3.6.");
}
function render(){
 content.replaceChildren();title.textContent=({sessions:"Sesi & sejarah",memory:"Memori pintar",workspace:"Ruang kerja",metrics:"Prestasi setempat"})[currentPanel]||"Bilik Antara";
 if(currentPanel==="sessions")renderSessions();
 else if(currentPanel==="memory")renderMemory();
 else if(currentPanel==="workspace")renderWorkspace();
 else if(currentPanel==="metrics")renderMetrics();
}
function quickActions(){
 const messages=[...document.querySelectorAll("#chat article.message.ai")];
 for(let i=0;i<messages.length;i++){
  const bubble=messages[i].querySelector(".bubble");
  if(!bubble||bubble.querySelector(".ba-actions"))continue;
  const p=bubble.querySelector(".message-paragraph,.code-block,.formatted-list");
  if(!p)continue;
  const text=[...bubble.children].filter(x=>!x.classList.contains("msg-details")&&!x.classList.contains("msg-sources")&&!x.classList.contains("osint-card")).map(x=>x.textContent).join("\n").trim();
  if(!text||text==="Assalamualaikum dan selamat sejahtera.")continue;
  const row=make("div",undefined,"ba-actions");
  row.append(
   button("Salin",()=>copyText(text),"ba-mini"),
   button("Ringkas",()=>api.fill("Ringkaskan jawapan ini dalam Bahasa Melayu yang jelas:\n"+text.slice(0,1200)),"ba-mini"),
   button("Semak",()=>api.fill("Semak ketepatan jawapan ini. Jangan reka sumber; nyatakan perkara belum disahkan:\n"+text.slice(0,1200)),"ba-mini"),
   button("Belajar",()=>api.fill("Ajar aku topik dalam jawapan ini secara berperingkat dengan contoh:\n"+text.slice(0,1200)),"ba-mini"),
   button("Draf",()=>{workspace={title:"Petikan AI",content:text,at:Date.now()};open("workspace");},"ba-mini")
  );
  bubble.appendChild(row);
 }
}
window.addEventListener("ba:answered",event=>{
 const item=event.detail||{};
 metrics.calls=(metrics.calls||0)+1;
 metrics.tokens=(metrics.tokens||0)+Math.max(0,Number(item.usage?.totalTokenCount)||0);
 if(Number.isFinite(item.duration)&&item.duration>0){
  metrics.durations=[...(metrics.durations||[]),item.duration].slice(-50);
 }
 if(api.remember())write(KEYS.metrics,metrics);
 quickActions();
 if(currentPanel==="metrics")render();
});
const observer=new MutationObserver(()=>{if(!api.active())quickActions();});
observer.observe($("chat"),{childList:true});
quickActions();
window.BilikAntaraSuite={
 memoryForPrompt:()=>memory.enabled&&typeof memory.text==="string"?memory.text.slice(0,1200):"",
 open,
 getLocalStats:()=>({...metrics})
};
})();
