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
const blankMetrics=()=>({calls:0,failures:0,tokens:0,reportedUsageCount:0,durations:[],elapsed:[],events:[],times:[],byProvider:{}});
let metrics=read(KEYS.metrics,blankMetrics());
if(!metrics||typeof metrics!=="object")metrics=blankMetrics();
metrics={...blankMetrics(),...metrics,byProvider:metrics.byProvider&&typeof metrics.byProvider==="object"?metrics.byProvider:{},
 events:Array.isArray(metrics.events)?metrics.events.slice(-120):[],
 durations:Array.isArray(metrics.durations)?metrics.durations.slice(-50):[],
 elapsed:Array.isArray(metrics.elapsed)?metrics.elapsed.slice(-120):[]};
const persistMetrics=()=>{if(api.remember())write(KEYS.metrics,metrics);};
let currentPanel="";
const convo=document.querySelector(".conversation");
if(!convo)return;
const drawer=make("aside",undefined,"ba-drawer");
drawer.hidden=true;drawer.setAttribute("aria-label","Alat dan penyimpanan setempat");
const sheet=make("div",undefined,"ba-sheet"),top=make("div",undefined,"ba-drawer-top");
const title=make("strong","Alat Bilik Antara");
top.append(title,button("✕",()=>close(),"ba-close"));
const content=make("div",undefined,"ba-content");
sheet.append(top,content);drawer.appendChild(sheet);
const backdrop=button("",()=>close(),"ba-backdrop");backdrop.setAttribute("aria-label","Tutup panel");drawer.prepend(backdrop);
const head=convo.querySelector(".conversation-head");
const settings=$("settingsPanel");
const featureSessions=$("featureSessions"),featureMetrics=$("featureMetrics");
document.body.appendChild(drawer); // keep fixed overlay outside clipped glass conversation
// Reuse the feature icon beside Multi AI Connected, not a second toolbar inside chat.
featureSessions?.addEventListener("click",()=>open("sessions"));
featureMetrics?.addEventListener("click",()=>open("metrics"));
function notice(message){
 let status=$("baNotification");
 if(!status){status=make("div",undefined,"ba-notification");status.id="baNotification";status.setAttribute("role","status");head.after(status);}
 status.textContent=String(message||"").slice(0,240);
}
function open(panel){
 if(settings)settings.open=false;
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
   .sort((a,b)=>(Number(b.pinned)-Number(a.pinned))||(b.at-a.at));
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
  pinned:!!old.pinned,history:snapshot.history,summary:snapshot.summary,summarizedThrough:snapshot.summarizedThrough,thoughtLedger:snapshot.thoughtLedger};
 if(idx>=0)archive.splice(idx,1);archive.unshift(entry);persistArchive();
}
window.addEventListener("ba:saved",snapshotCurrent);
window.addEventListener("ba:cleared",()=>{
 archive=archive.filter(x=>x.id!==activeId);
 // Clear explicitly deleted this entry even though the native UI has unchecked persistence.
 if(archive.length)write(KEYS.archive,archive);
 else try{localStorage.removeItem(KEYS.archive);}catch(_){}
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
 const previous=activeId,next=entry&&entry.id||freshId();
 activeId=next;
 const ok=entry?api.load(entry):api.fresh();
 if(!ok){activeId=previous;return;}
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
 paragraph("Sesi disimpan pada peranti ini sahaja apabila 'Simpan sesi pada peranti ini' diaktifkan. Arkib tetap tertakluk pada ruang storan pelayar; eksport JSON untuk sandaran sendiri.");
 controlRow(button("+ Sesi baharu",()=>beginSession(null)),button("Eksport sesi ini",()=>{
  download("bilik-antara-sesi.md",sessionText(api.snapshot().history),"text/markdown;charset=utf-8");
 }));
 if(!api.remember()){paragraph("Penyimpanan perbualan belum diaktifkan. Hidupkannya melalui Privasi & sesi. Memori pilihan masih boleh diurus di bawah.");return;}
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
 paragraph("Memori pilihan pengguna ialah nota berasingan daripada sejarah sesi.");
 paragraph("Memori ini berbeza daripada sejarah sesi. Nota yang kau tulis dan aktifkan dihantar sebagai konteks kepada Gemini. Nota pilihan tidak dihantar ke penyedia sandaran. Semua nota kekal di peranti sehingga kau padam.");
 const toggle=make("input");toggle.type="checkbox";toggle.checked=!!memory.enabled;
 const label=make("label"," Aktifkan memori");label.prepend(toggle);content.appendChild(label);
 const field=make("textarea");field.className="ba-editor";field.rows=8;field.maxLength=8000;
 field.value=typeof memory.text==="string"?memory.text:"";
 field.placeholder="Contoh: Aku suka Bahasa Melayu santai, jawapan ringkas, dan sedang membina laman web…";
 content.appendChild(field);
 controlRow(button("Simpan memori",()=>{
  memory={enabled:toggle.checked,text:field.value.trim().slice(0,8000)};
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
   workspace={title:name.value.slice(0,100),content:field.value,at:Date.now()};
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
 section("Prestasi Aksara · Peranti ini");
 paragraph("Statistik sembang teks pada pelayar ini sahaja, bukan semua pengguna atau Voice Live. Kejayaan teknikal tidak menjamin jawapan tepat. Rekod lama mungkin tidak lengkap.");
 const successes=Math.max(0,Number(metrics.calls)||0),failures=Math.max(0,Number(metrics.failures)||0),total=successes+failures;
 const valid=values=>(Array.isArray(values)?values:[]).filter(v=>Number.isFinite(v)&&v>=0);
 const elapsed=valid(metrics.elapsed),backend=valid(metrics.durations);
 const avg=values=>values.length?(values.reduce((a,b)=>a+b,0)/values.length/1000).toFixed(2)+" s":"Tiada data";
 const sorted=[...elapsed].sort((a,b)=>a-b);
 const pct=(arr,p)=>{if(!arr.length)return "Tiada data";const a=[...arr].sort((x,y)=>x-y),pos=(a.length-1)*p,lo=Math.floor(pos),hi=Math.ceil(pos);return ((a[lo]+(a[hi]-a[lo])*(pos-lo))/1000).toFixed(2)+" s";};
 const med=pct(elapsed,.5);
 const events=Array.isArray(metrics.events)?metrics.events:[];
 const recent=events.filter(e=>e&&Number.isFinite(e.at)&&e.at>=Date.now()-86400000);
 const successful=recent.filter(e=>e.ok===true).length;
 const successMs=events.filter(e=>e?.ok===true&&Number.isFinite(e.ms)&&e.ms>=0).map(e=>e.ms);
 const failMs=events.filter(e=>e?.ok===false&&Number.isFinite(e.ms)&&e.ms>=0).map(e=>e.ms);
 const entries=[
  ["Permintaan direkodkan",total],
  ["Jawapan berjaya",successes],
  ["Permintaan gagal",failures],
  ["Kadar berjaya",total?(100*successes/total).toFixed(1)+"%":"Tiada data"],
  ["Purata masa pengguna",avg(elapsed)],
  ["Purata masa teks pertama · streaming",avg(events.filter(e=>e.ok===true&&Number.isFinite(e.firstTokenMs)).map(e=>e.firstTokenMs))],
  ["Median masa pengguna · semua permintaan",med],
  ["P90 masa pengguna · semua permintaan",pct(elapsed,.9)],
  ["P95 masa pengguna · semua permintaan",pct(elapsed,.95)],
  ["Purata masa jawapan berjaya · log",avg(successMs)],
  ["Purata masa permintaan gagal · log",avg(failMs)],
  ["Permintaan dalam log 24 jam",recent.length],
  ["Kejayaan dalam log 24 jam",recent.length?(100*successful/recent.length).toFixed(1)+"% ("+successful+"/"+recent.length+")":"Tiada data"],
  ["Terpantas / terlama",elapsed.length?(Math.min(...elapsed)/1000).toFixed(2)+" / "+(Math.max(...elapsed)/1000).toFixed(2)+" s":"Tiada data"],
  ["Purata masa backend",avg(backend)],
  ["Token dilaporkan",Number(metrics.tokens||0).toLocaleString("ms-MY")],
  ["Jawapan dengan laporan token",(metrics.reportedUsageCount||0)+" / "+successes],
  ["Sampel masa pengguna",elapsed.length],
  ["Sampel masa backend",backend.length],
  ["Liputan laporan token",successes?(100*(metrics.reportedUsageCount||0)/successes).toFixed(1)+"%":"Tiada data"]
 ];
 for(const [label,value] of entries){const row=make("div",undefined,"ba-metric");row.append(make("span",label),make("strong",value));content.appendChild(row);}
 paragraph("Masa pengguna merangkumi permintaan berjaya dan gagal. Purata berjaya/gagal berdasarkan maksimum 120 peristiwa terkini; masa backend menggunakan sehingga 50 sampel.");
 paragraph("Token hanya dikira apabila penyedia melaporkan nilai sah. Tiada laporan token bukan bermaksud penggunaan sifar.");
 section("Pecahan model");
 const providers=Object.entries(metrics.byProvider||{}).filter(([,v])=>v&&Number(v.calls)>0).sort((a,b)=>b[1].calls-a[1].calls);
 if(!providers.length)paragraph("Tiada rekod model lagi. Jawapan baharu akan mengenal pasti penyedia.");
 for(const [id,data]of providers){
  const label=({gemini:"Google Gemini",groq:"Groq",mistral:"Mistral",openrouter:"OpenRouter",requesty:"Requesty",local:"Identiti setempat",unknown:"Tidak diketahui"})[id]||id;
  const row=make("div",undefined,"ba-metric");
  const samples=(metrics.events||[]).filter(e=>e&&e.ok&&e.provider===id&&Number.isFinite(e.ms));
  const time=samples.length?" · "+(samples.reduce((sum,e)=>sum+e.ms,0)/samples.length/1000).toFixed(2)+" s purata sampel":"";
  row.append(make("span",label),make("strong",data.calls+" respons · "+(successes?(100*data.calls/successes).toFixed(1)+"%":"—")+time));content.appendChild(row);
 }
 paragraph("Pecahan penyedia menunjukkan model yang akhirnya menjawab, bukan semua percubaan sandaran. Purata per penyedia berdasarkan maksimum 120 peristiwa.");
 section("Punca kegagalan");
 const failuresByCode={};
 for(const entry of metrics.events||[]){
  if(entry?.ok===false){const code=String(entry.code||"Tidak diketahui").slice(0,32);failuresByCode[code]=(failuresByCode[code]||0)+1;}
 }
 const reasons=Object.entries(failuresByCode).sort((a,b)=>b[1]-a[1]);
 if(!reasons.length)paragraph("Tiada punca kegagalan dalam log terkini.");
 paragraph("Punca kegagalan hanya dikira daripada maksimum 120 peristiwa terakhir, bukan keseluruhan sejarah.");
 for(const [code,count]of reasons){
  const row=make("div",undefined,"ba-metric");
  row.append(make("span",code),make("strong",count+" kali"));content.appendChild(row);
 }
 section("Aktiviti terkini");
 paragraph("Sehingga 120 peristiwa setempat tanpa menyimpan kandungan soalan. Dipaparkan 12 yang terbaru.");
 if(!events.length)paragraph("Belum ada aktiviti baharu untuk dipaparkan.");
 for(const item of events.slice(-12).reverse()){
  const row=make("div",undefined,"ba-metric ba-metric-event");
  const date=new Date(item.at).toLocaleTimeString("ms-MY",{hour:"2-digit",minute:"2-digit"});
  const text=item.ok?(item.provider||"Tidak diketahui"):"Gagal"+(item.code?" · "+String(item.code).slice(0,24):"");
  row.append(make("span",date+" · "+text),make("strong",Number.isFinite(item.ms)?(item.ms/1000).toFixed(2)+" s":"—"));content.appendChild(row);
 }
 section("Storan dan privasi");
 paragraph("Sejarah sesi: "+(api.remember()?"diaktifkan":"dimatikan")+". Memori pilihan: "+(memory.enabled?"diaktifkan":"dimatikan")+". Sesi tersimpan: "+archive.length+". Peristiwa prestasi disimpan hanya jika Simpan sesi diaktifkan.");
 paragraph("Masa pengguna meliputi rangkaian dan pemprosesan. Masa backend dilaporkan pelayan. Rekod aktiviti terhad kepada 120 peristiwa, sampel masa pengguna 120 dan backend 50. Kejayaan permintaan bukan bukti ketepatan jawapan. Voice Live tidak termasuk.");
 controlRow(
  button("Eksport JSON",()=>download("aksara-prestasi.json",JSON.stringify({exportedAt:new Date().toISOString(),metrics},null,2),"application/json")),
  button("Padam statistik",()=>{if(!confirm("Padam statistik prestasi pada peranti ini?"))return;metrics=blankMetrics();try{localStorage.removeItem(KEYS.metrics);}catch(_){}render();})
 );
}
function render(){
 content.replaceChildren();title.textContent=({sessions:"Sesi & Memori",workspace:"Ruang kerja",metrics:"Prestasi setempat"})[currentPanel]||"Bilik Antara";
 if(currentPanel==="sessions"){renderSessions();section("Memori pilihan");renderMemory();}
 else if(currentPanel==="workspace")renderWorkspace();
 else if(currentPanel==="metrics")renderMetrics();
}
window.addEventListener("ba:answered",event=>{
 const item=event.detail||{};
 const provider=["gemini","groq","mistral","openrouter","requesty","local"].includes(item.provider)?item.provider:"unknown";
 metrics.calls=(metrics.calls||0)+1;
 const rawTokens=item.usage?.totalTokenCount??item.usage?.total_tokens;
 const tokens=rawTokens===null||rawTokens===undefined||rawTokens===""?NaN:Number(rawTokens);
 if(Number.isFinite(tokens)&&tokens>=0){
  metrics.tokens=(metrics.tokens||0)+tokens;
  metrics.reportedUsageCount=(metrics.reportedUsageCount||0)+1;
 }
 if(Number.isFinite(item.duration)&&item.duration>=0)metrics.durations=[...metrics.durations,item.duration].slice(-50);
 if(Number.isFinite(item.elapsedMs)&&item.elapsedMs>=0)metrics.elapsed=[...metrics.elapsed,item.elapsedMs].slice(-120);
 const record=metrics.byProvider[provider]||{calls:0};
 metrics.byProvider[provider]={calls:record.calls+1};
 metrics.events=[...metrics.events,{at:Date.now(),ok:true,provider,firstTokenMs:Number.isFinite(item.firstTokenMs)?item.firstTokenMs:null,ms:Number.isFinite(item.elapsedMs)?item.elapsedMs:null}].slice(-120);
 persistMetrics();if(currentPanel==="metrics")render();
});
window.addEventListener("ba:request-failed",event=>{
 const item=event.detail||{};
 metrics.failures=(metrics.failures||0)+1;
 const elapsed=Number(item.elapsedMs);
 if(Number.isFinite(elapsed)&&elapsed>=0)metrics.elapsed=[...metrics.elapsed,elapsed].slice(-120);
 metrics.events=[...metrics.events,{at:Date.now(),ok:false,code:String(item.code||item.status||"UNKNOWN").slice(0,32),ms:Number.isFinite(elapsed)?elapsed:null}].slice(-120);
 persistMetrics();if(currentPanel==="metrics")render();
});
window.BilikAntaraSuite={
 memoryForPrompt:()=>memory.enabled&&typeof memory.text==="string"?memory.text.slice(0,8000):"",
 open,
 getLocalStats:()=>({...metrics})
};
})();
