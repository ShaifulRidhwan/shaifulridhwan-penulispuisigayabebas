/* AKSARA Code Engine: an in-chat runtime menu; no page navigation or AI dependency. */
(function(){
"use strict";
const existing=document.getElementById("connection"),engine=window.AksaraCodeRuntime;
if(!existing||!existing.parentElement||!engine)return;
const pill=document.createElement("button");
pill.id="codeEngineStatus";pill.type="button";pill.className="code-engine-status";
pill.setAttribute("aria-haspopup","dialog");pill.setAttribute("aria-controls","codeEngineMenu");
pill.setAttribute("aria-expanded","false");pill.setAttribute("aria-label","Status Code Engine. Tekan untuk lihat bahasa yang tersedia.");
pill.title="Code Engine diuji secara setempat, bebas daripada Multi A.I.";
const dot=document.createElement("span");dot.className="code-engine-dot";dot.setAttribute("aria-hidden","true");
const label=document.createElement("span");label.id="codeEngineStatusText";label.textContent="Code Engine Checking";
pill.append(dot,label);
existing.insertAdjacentElement("afterend",pill);
const menu=document.createElement("section");menu.id="codeEngineMenu";menu.className="code-engine-menu";menu.hidden=true;
menu.setAttribute("role","dialog");menu.setAttribute("aria-label","Code Engine: pilih bahasa");
menu.innerHTML=[
 '<div class="code-menu-title"><strong>AKSARA CODE ENGINE</strong><button type="button" id="codeMenuClose" aria-label="Tutup senarai Code Engine">×</button></div>',
 '<p class="code-menu-intro">Pilih bahasa untuk jalankan kod terus dalam chatbox. AI tidak diperlukan.</p>',
 '<button type="button" class="code-menu-language" data-code-language="javascript"><span>JavaScript</span><small id="codeJavaScriptState">Checking…</small></button>',
 '<button type="button" class="code-menu-language" data-code-language="python"><span>Python · Pyodide</span><small>Load on run · perlukan Internet</small></button>',
 '<details class="code-menu-planned"><summary>10 compiler sasaran · belum tersedia</summary><p>C · C++ · Java · Rust · Go · C# · Kotlin · Swift · TypeScript · Dart</p></details>',
 '<p class="code-menu-footer">READY mengesahkan JavaScript sahaja. Kod tidak akan dijalankan secara automatik.</p>'
].join("");
document.body.appendChild(menu);
const css=document.createElement("style");
css.textContent=[
'.chat-controls{gap:7px!important}',
'.conversation-head .code-engine-status{display:inline-flex;align-items:center;gap:7px;box-sizing:border-box;height:38px;min-height:38px;padding:0 12px;border:1px solid rgba(220,203,175,.29);border-radius:999px;color:#e6dac9;white-space:nowrap;background:rgba(27,35,48,.14);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);font:500 12px/1.4 "DM Sans",system-ui,sans-serif;transition:border-color .2s,background .2s;cursor:pointer}',
'.conversation-head .code-engine-status:hover{border-color:rgba(241,211,158,.55);background:rgba(190,161,113,.1)}',
'.code-engine-dot{width:6px;height:6px;border-radius:50%;flex:none;background:#b99c6c}',
'.code-engine-status.ready .code-engine-dot{background:#6fcdaa}',
'.code-engine-status.offline .code-engine-dot{background:#e7a08e}',
'.code-engine-menu[hidden]{display:none!important}',
'.code-engine-menu{position:fixed;z-index:120;box-sizing:border-box;width:min(330px,calc(100vw - 24px));padding:17px;border:1px solid rgba(223,194,144,.31);border-radius:8px 22px 8px 22px;color:#ece3d4;background:rgba(9,15,26,.96);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);box-shadow:0 22px 55px rgba(0,0,0,.52);font:500 13px/1.5 "DM Sans",system-ui,sans-serif}',
'.code-menu-title{display:flex;align-items:center;justify-content:space-between;gap:10px;letter-spacing:.04em}',
'.code-menu-title button{background:transparent;border:1px solid rgba(201,179,145,.34);color:#ede1cf;border-radius:9px;cursor:pointer;font:inherit;padding:1px 9px}',
'.code-menu-intro,.code-menu-footer{font-size:12px;line-height:1.6;color:#b7bfc8;margin:10px 0 14px}',
'.code-menu-footer{font-size:11px;margin:12px 0 0}',
'.code-menu-language{display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;width:100%;padding:13px 11px;margin:7px 0;border:1px solid rgba(203,183,153,.24);border-radius:12px;background:rgba(65,80,107,.18);color:#f4e4cc;cursor:pointer;font:inherit}',
'.code-menu-language:hover,.code-menu-language:focus-visible{border-color:rgba(244,208,150,.7)}',
'.code-menu-language small{font-size:11px;color:#b8c8d5;text-align:right}',
'.code-menu-language[data-code-language="javascript"] small.is-ready{color:#8cd9b5}',
'.code-menu-planned{border-top:1px solid rgba(220,195,151,.2);padding-top:12px;margin-top:14px;color:#bfcbcf;font-size:12px}',
'.code-menu-planned summary{cursor:pointer}',
'.code-menu-planned p{margin:9px 0 0;line-height:1.7}',
'@media(max-width:760px){.conversation-head .code-engine-status{height:37px;min-height:37px;padding:0 9px;font-size:11px}}',
'@media(max-width:520px){.conversation-head{flex-wrap:wrap;row-gap:7px;padding-top:10px!important;padding-bottom:10px!important}.conversation-head .voice-toolbar{width:100%;justify-content:flex-start}.conversation-head .chat-controls{width:100%;justify-content:space-between}.conversation-head #connection,.conversation-head .code-engine-status{font-size:10px!important;padding-inline:8px!important;min-width:0}.conversation-head #connectionText{font-size:10px!important}.conversation-head #settingsPanel{margin-left:auto}}'
].join("\n");
document.head.appendChild(css);
function positionMenu(){
 const r=pill.getBoundingClientRect(),w=menu.getBoundingClientRect().width,h=menu.getBoundingClientRect().height;
 menu.style.left=Math.round(Math.max(12,Math.min(window.innerWidth-w-12,r.right-w)))+"px";
 menu.style.top=Math.round(r.bottom+10+h>window.innerHeight?Math.max(10,r.top-h-10):r.bottom+10)+"px";
}
function closeMenu(){menu.hidden=true;pill.setAttribute("aria-expanded","false");}
pill.addEventListener("click",()=>{
 if(!menu.hidden){closeMenu();return;}
 menu.hidden=false;pill.setAttribute("aria-expanded","true");positionMenu();
});
menu.querySelector("#codeMenuClose").addEventListener("click",()=>{closeMenu();pill.focus();});
document.addEventListener("pointerdown",event=>{if(!menu.hidden&&!menu.contains(event.target)&&!pill.contains(event.target))closeMenu();});
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!menu.hidden){closeMenu();pill.focus();}});
window.addEventListener("resize",()=>{if(!menu.hidden)positionMenu();});
menu.querySelectorAll("[data-code-language]").forEach(btn=>btn.addEventListener("click",()=>{
 const language=btn.dataset.codeLanguage;
 if(language==="javascript"&&!pill.classList.contains("ready"))return;
 closeMenu();
 window.dispatchEvent(new CustomEvent("aksara:code-language",{detail:{language}}));
 document.getElementById("input")?.focus();
}));
engine.probe().then(ok=>{
 pill.classList.toggle("ready",ok);pill.classList.toggle("offline",!ok);
 label.textContent=ok?"Code Engine Ready":"Code Engine Offline";
 const st=menu.querySelector("#codeJavaScriptState");st.textContent=ok?"Ready · tested":"Unavailable";
 st.classList.toggle("is-ready",ok);
}).catch(()=>{
 pill.classList.add("offline");label.textContent="Code Engine Offline";
 menu.querySelector("#codeJavaScriptState").textContent="Unavailable";
});
})();
