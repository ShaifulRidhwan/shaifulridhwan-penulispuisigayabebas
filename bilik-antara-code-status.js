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
const menu=document.createElement("dialog");
menu.id="codeEngineMenu";
menu.className="multi-ai-dialog code-engine-dialog";
menu.setAttribute("aria-labelledby","codeEngineMenuTitle");
menu.setAttribute("aria-describedby","codeEngineMenuDescription");
menu.innerHTML=[
 '<div class="multi-ai-head"><div><strong id="codeEngineMenuTitle">Code Engine · Sambungan</strong><p id="codeEngineMenuDescription">Enam bahasa pilihan untuk dibangunkan secara serius. Runtime yang belum disahkan tidak boleh dijalankan.</p></div><button type="button" id="codeMenuClose" aria-label="Tutup Code Engine">×</button></div>',
 '<div class="multi-ai-list" id="codeRuntimeList" aria-label="Runtime tersedia dan sasaran">',
  '<button type="button" class="multi-ai-row code-menu-language" data-code-language="javascript"><span class="multi-ai-provider">JavaScript</span><span class="multi-ai-state is-muted" id="codeJavaScriptState">Checking…</span></button>',
  '<button type="button" class="multi-ai-row code-menu-language" data-code-language="python"><span class="multi-ai-provider">Python · Pyodide</span><span class="multi-ai-state is-muted">Load on run</span></button>',
  '<button type="button" class="multi-ai-row code-menu-language" data-code-language="typescript"><span class="multi-ai-provider">TypeScript</span><span class="multi-ai-state is-muted">Load on run</span></button>',
  '<button type="button" class="multi-ai-row code-menu-language" data-code-language="sql"><span class="multi-ai-provider">SQL · SQLite WASM</span><span class="multi-ai-state is-muted">Load on run</span></button>',
  '<div class="multi-ai-row code-menu-unavailable" aria-disabled="true"><span class="multi-ai-provider">C</span><span class="multi-ai-state is-muted">Belum tersedia</span></div>',
  '<div class="multi-ai-row code-menu-unavailable" aria-disabled="true"><span class="multi-ai-provider">C++</span><span class="multi-ai-state is-muted">Belum tersedia</span></div>',
 '</div>',
 '<div class="multi-ai-actions"><button type="button" id="codeEngineRefresh">Semak semula</button></div>'
].join("");
document.body.appendChild(menu);
const css=document.createElement("style");
css.textContent=[
'.chat-controls{gap:7px!important}',
'.conversation-head .code-engine-status{display:inline-flex;align-items:center;gap:7px;box-sizing:border-box;height:38px;min-height:38px;padding:0 12px;border:1px solid rgba(242,201,143,.27);border-radius:999px;color:#eaddc4;white-space:nowrap;background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(5,8,16,.16));box-shadow:inset 0 1px 0 rgba(255,237,198,.11),0 4px 15px rgba(0,0,0,.07);backdrop-filter:blur(10px) saturate(1.1);-webkit-backdrop-filter:blur(10px) saturate(1.1);font:500 12px/1.4 "DM Sans",system-ui,sans-serif;transition:border-color .2s,background .2s,box-shadow .2s;cursor:pointer}',
'.conversation-head .code-engine-status:hover{border-color:rgba(242,201,143,.42);background:linear-gradient(180deg,rgba(255,255,255,.065),rgba(5,8,16,.2));box-shadow:inset 0 1px 0 rgba(255,237,198,.13),0 4px 15px rgba(0,0,0,.09)}',
'.code-engine-dot{width:6px;height:6px;border-radius:50%;flex:none;background:#b99c6c}',
'.code-engine-status.ready .code-engine-dot{background:#6fcdaa}',
'.code-engine-status.offline .code-engine-dot{background:#e7a08e}',
'.code-engine-dialog .code-menu-language{width:100%;text-align:left;font:500 12px "DM Sans",sans-serif;cursor:pointer;min-height:57px;padding:12px;border-radius:10px;border:1px solid rgba(222,193,151,.16);background:rgba(255,255,255,.025)}',
'.code-engine-dialog .code-menu-language:hover{background:rgba(255,255,255,.06)}',
'.code-engine-dialog .code-menu-language:focus-visible{outline:2px solid #eec98e;outline-offset:2px}',
'.code-engine-dialog .code-menu-language .multi-ai-state{flex:none}',
'.code-engine-dialog .code-menu-planned .multi-ai-model-note{margin:0 0 0 14px}',
'.code-engine-dialog .multi-ai-actions #codeEngineRefresh{display:flex;align-items:center;justify-content:center;width:100%;min-height:49px;margin:0;padding:12px 16px;border-radius:13px;border:1px solid rgba(231,203,157,.3);background:linear-gradient(145deg,rgba(255,255,255,.065),rgba(255,255,255,.015));-webkit-backdrop-filter:blur(16px) saturate(1.15);backdrop-filter:blur(16px) saturate(1.15);box-shadow:inset 0 1px 0 rgba(255,255,255,.09),0 5px 18px rgba(0,0,0,.15);font:600 12px/1.35 "DM Sans",sans-serif}',
'.code-engine-dialog .multi-ai-actions #codeEngineRefresh{background-image:linear-gradient(145deg,rgba(255,255,255,.065),rgba(255,255,255,.015))!important}',
'.code-engine-dialog .multi-ai-actions #codeEngineRefresh:hover{background:rgba(255,255,255,.095)}',
'@media(max-width:760px){.conversation-head .code-engine-status{height:37px;min-height:37px;padding:0 9px;font-size:11px}}',
'@media(max-width:760px){.conversation .conversation-head{flex-wrap:nowrap!important;gap:5px!important;padding:8px 8px!important}.conversation-head .voice-toolbar{flex:0 0 auto!important;width:auto!important;min-width:0!important;justify-content:flex-start!important}.conversation-head #voiceLive{padding-inline:9px!important;font-size:10px!important;white-space:nowrap!important}.conversation-head .chat-controls{display:flex!important;flex:1 1 0!important;width:auto!important;min-width:0!important;margin-left:0!important;justify-content:flex-end!important;gap:4px!important;flex-wrap:nowrap!important}.conversation-head #connection{flex:1 1 0!important;min-width:0!important;max-width:none!important;overflow:hidden!important;padding-inline:7px!important;gap:5px!important}.conversation-head #connectionText{display:block!important;min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:10px!important}.conversation-head .code-engine-status{flex:0 0 auto!important;max-width:125px!important;min-width:0!important;padding:0 8px!important;font-size:10px!important;gap:5px!important}.conversation-head .code-engine-status #codeEngineStatusText{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.conversation-head #settingsPanel{flex:0 0 auto!important;margin-left:0!important}}',
'@media(max-width:390px){.conversation .conversation-head{gap:3px!important;padding-inline:5px!important}.conversation-head #voiceLive{padding-inline:6px!important;font-size:9px!important}.conversation-head .chat-controls{gap:3px!important}.conversation-head .code-engine-status{max-width:118px!important;padding-inline:6px!important;font-size:9px!important}.conversation-head #connection{padding-inline:5px!important}.conversation-head #connectionText{font-size:9px!important}.conversation-head #settingsPanel>summary{width:34px!important;min-width:34px!important;height:37px!important}}',
'@media(max-width:340px){.conversation-head .code-engine-status{max-width:107px!important}.conversation-head #voiceLive{padding-inline:5px!important}.conversation-head #connection{padding-inline:4px!important;gap:3px!important}.conversation-head #connectionText{font-size:8px!important}}'
].join("\n");
document.head.appendChild(css);
function closeMenu(){if(menu.open)menu.close();}
pill.addEventListener("click",()=>{
 if(menu.open){closeMenu();return;}
 menu.showModal();
 pill.setAttribute("aria-expanded","true");
});
menu.addEventListener("close",()=>{pill.setAttribute("aria-expanded","false");});
menu.querySelector("#codeMenuClose").addEventListener("click",()=>{closeMenu();pill.focus();});
menu.addEventListener("click",event=>{if(event.target===menu)closeMenu();});
menu.querySelector("#codeEngineRefresh").addEventListener("click",()=>{checkRuntime();});
menu.querySelectorAll("[data-code-language]").forEach(btn=>btn.addEventListener("click",()=>{
 const language=btn.dataset.codeLanguage;
 if(!engine.available.includes(language))return;
 if(language==="javascript"&&!pill.classList.contains("ready"))return;
 closeMenu();
 window.dispatchEvent(new CustomEvent("aksara:code-language",{detail:{language}}));
 document.getElementById("input")?.focus();
}));
function checkRuntime(){
 const button=menu.querySelector("#codeEngineRefresh");
 const st=menu.querySelector("#codeJavaScriptState");
 button.disabled=true;
 st.textContent="Checking…";st.className="multi-ai-state is-muted";
 return engine.probe().then(ok=>{
  pill.classList.toggle("ready",ok);pill.classList.toggle("offline",!ok);
  label.textContent=ok?"Code Engine Ready":"Code Engine Offline";
  st.textContent=ok?"Ready":"Offline";
  st.className="multi-ai-state "+(ok?"is-ready":"is-offline");
  return ok;
 }).catch(()=>{
  pill.classList.remove("ready");pill.classList.add("offline");
  label.textContent="Code Engine Offline";
  st.textContent="Offline";st.className="multi-ai-state is-offline";
  return false;
 }).finally(()=>{button.disabled=false;});
}
checkRuntime();
})();
