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
const dot=document.createElement("span");dot.className="code-engine-core";dot.setAttribute("aria-hidden","true");
dot.innerHTML='<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/><rect class="code-core-center" x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4"/></svg>';
const label=document.createElement("span");label.id="codeEngineStatusText";label.textContent="Code Engine";
pill.append(dot,label);
// Keep Voice Chat left, Code Engine centre, and Multi A.I. on the outer right.
existing.insertAdjacentElement("beforebegin",pill);
const menu=document.createElement("dialog");
menu.id="codeEngineMenu";
menu.className="multi-ai-dialog code-engine-dialog";
menu.setAttribute("aria-labelledby","codeEngineMenuTitle");
menu.setAttribute("aria-describedby","codeEngineMenuDescription");
menu.innerHTML=[
 '<div class="multi-ai-head"><div><strong id="codeEngineMenuTitle">Code Engine · Sambungan</strong><p id="codeEngineMenuDescription">Lima runtime termasuk C++20; HTML/CSS Live Preview dalam Code Workspace.</p></div><button type="button" id="codeMenuClose" aria-label="Tutup Code Engine">×</button></div>',
 '<div class="multi-ai-list" id="codeRuntimeList" aria-label="Runtime tersedia dan sasaran">',
  '<button type="button" class="multi-ai-row code-menu-language" data-code-language="javascript"><span class="multi-ai-provider">JavaScript</span><span class="multi-ai-state is-muted" id="codeJavaScriptState">Checking…</span></button>',
  '<button type="button" class="multi-ai-row code-menu-language" data-code-language="python"><span class="multi-ai-provider">Python · Pyodide</span><span class="multi-ai-state is-muted" id="codePythonState">Load on run</span></button>',
  '<button type="button" class="multi-ai-row code-menu-language" data-code-language="typescript"><span class="multi-ai-provider">TypeScript</span><span class="multi-ai-state is-muted" id="codeTypeScriptState">Load on run</span></button>',
  '<button type="button" class="multi-ai-row code-menu-language" data-code-language="sql"><span class="multi-ai-provider">SQL · SQLite WASM</span><span class="multi-ai-state is-muted" id="codeSQLState">Load on run</span></button>',
  '<button type="button" class="multi-ai-row code-menu-language" data-code-language="cpp"><span class="multi-ai-provider">C++ · Clang WASM</span><span class="multi-ai-state is-muted" id="codeCPPState">Load on run · ~29 MB</span></button>',
  '<button type="button" class="multi-ai-row code-menu-language" id="codeHtmlPreview"><span class="multi-ai-provider">HTML · CSS</span><span class="multi-ai-state is-ready">Live Preview</span></button>',
 '</div>',
 ' <div class="multi-ai-actions"><button type="button" id="codeEngineRefresh">Semak semula</button><button type="button" id="codeWorkspaceOpen">Code Workspace</button><button type="button" id="codeEvalOpen">Evaluation Lab</button></div>'
].join("");
document.body.appendChild(menu);
const css=document.createElement("style");
css.textContent=[
'.chat-controls{gap:7px!important}',
'.conversation-head .code-engine-status{display:inline-flex;align-items:center;gap:7px;box-sizing:border-box;height:38px;min-height:38px;padding:0 12px;border:1px solid rgba(242,201,143,.27);border-radius:999px;color:#eaddc4;white-space:nowrap;background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(5,8,16,.16));box-shadow:inset 0 1px 0 rgba(255,237,198,.11),0 4px 15px rgba(0,0,0,.07);backdrop-filter:blur(10px) saturate(1.1);-webkit-backdrop-filter:blur(10px) saturate(1.1);font:500 12px/1.4 "DM Sans",system-ui,sans-serif;transition:border-color .2s,background .2s,box-shadow .2s;cursor:pointer}',
'.conversation-head .code-engine-status{-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}',
'.conversation-head .code-engine-status:focus:not(:focus-visible){outline:none!important}',
'.conversation-head .code-engine-status:focus-visible{outline:2px solid rgba(242,201,143,.85)!important;outline-offset:2px!important}',
'.conversation-head .code-engine-status:hover{border-color:rgba(242,201,143,.42);background:linear-gradient(180deg,rgba(255,255,255,.065),rgba(5,8,16,.2));box-shadow:inset 0 1px 0 rgba(255,237,198,.13),0 4px 15px rgba(0,0,0,.09)}',
'.conversation-head .code-engine-core{position:relative;display:grid;place-items:center;flex:0 0 17px;width:17px;height:17px;color:#ceb68b}',
'.conversation-head .code-engine-core svg{width:17px;height:17px;display:block;fill:none;stroke:currentColor;stroke-width:1.45;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 3px rgba(207,183,136,.25));animation:codeCoreBreathe 3.6s ease-in-out infinite}',
'.conversation-head .code-engine-core svg .code-core-center{fill:currentColor;fill-opacity:.16;animation:codeCoreData 2.8s ease-in-out infinite}',
'.conversation-head .code-engine-status.ready .code-engine-core{color:#e4be83}',
'.conversation-head .code-engine-status.offline .code-engine-core{color:#e7a08e}',
'.conversation-head .code-engine-status[data-ai-execution="armed"] .code-engine-core{color:#f8d59b}',
'.conversation-head .code-engine-status[data-ai-execution="running"] .code-engine-core svg{animation:codeCoreWorking .75s ease-in-out infinite}',
'@keyframes codeCoreBreathe{0%,100%{opacity:.68;filter:drop-shadow(0 0 1px rgba(232,191,126,.1))}50%{opacity:1;filter:drop-shadow(0 0 5px rgba(242,194,116,.5))}}',
'@keyframes codeCoreData{0%,100%{fill-opacity:.1}50%{fill-opacity:.48}}',
'@keyframes codeCoreWorking{0%,100%{opacity:.72;filter:drop-shadow(0 0 3px rgba(242,194,116,.25))}50%{opacity:1;filter:drop-shadow(0 0 9px rgba(242,194,116,.72))}}',
'@media(prefers-reduced-motion:reduce){.conversation-head .code-engine-core svg,.conversation-head .code-engine-core svg .code-core-center{animation:none!important}}',
'.code-engine-dialog .code-menu-language{width:100%;text-align:left;font:500 12px "DM Sans",sans-serif;cursor:pointer;min-height:57px;padding:12px;border-radius:10px;border:1px solid rgba(222,193,151,.16);background:rgba(255,255,255,.025)}',
'.code-engine-dialog .code-menu-language:hover{background:rgba(255,255,255,.06)}',
'.code-engine-dialog .code-menu-language:focus-visible{outline:2px solid #eec98e;outline-offset:2px}',
'.code-engine-dialog .code-menu-language .multi-ai-state{flex:none}',
'.code-engine-dialog .code-menu-planned .multi-ai-model-note{margin:0 0 0 14px}',
'.code-engine-dialog .multi-ai-actions #codeEngineRefresh{display:flex;align-items:center;justify-content:center;width:100%;min-height:49px;margin:0;padding:12px 16px;border-radius:13px;border:1px solid rgba(231,203,157,.3);background:linear-gradient(145deg,rgba(255,255,255,.065),rgba(255,255,255,.015));-webkit-backdrop-filter:blur(16px) saturate(1.15);backdrop-filter:blur(16px) saturate(1.15);box-shadow:inset 0 1px 0 rgba(255,255,255,.09),0 5px 18px rgba(0,0,0,.15);font:600 12px/1.35 "DM Sans",sans-serif}',
'#codeEngineMenu.code-engine-dialog .multi-ai-actions #codeEngineRefresh{background:linear-gradient(145deg,rgba(255,255,255,.065),rgba(255,255,255,.015))!important}',
'.code-engine-dialog .multi-ai-actions #codeWorkspaceOpen,.code-engine-dialog .multi-ai-actions #codeEvalOpen{display:flex;align-items:center;justify-content:center;width:100%;min-height:44px;margin-top:8px;padding:11px 14px;border-radius:13px;border:1px solid rgba(231,203,157,.3);color:#eadcc5;background:linear-gradient(145deg,rgba(255,255,255,.05),rgba(255,255,255,.015));font:600 12px "DM Sans",sans-serif;cursor:pointer}',
'.code-engine-dialog .multi-ai-actions #codeEngineRefresh:hover{background:rgba(255,255,255,.095)}',
'@media(max-width:760px){.conversation-head .code-engine-status{height:37px;min-height:37px;padding:0 9px;font-size:11px}.conversation-head .code-engine-core{flex-basis:15px;width:15px;height:15px}.conversation-head .code-engine-core svg{width:15px;height:15px}}',
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
menu.querySelector("#codeMenuClose").addEventListener("click",()=>{closeMenu();pill.focus();});
menu.addEventListener("click",event=>{if(event.target===menu)closeMenu();});
menu.querySelector("#codeEngineRefresh").addEventListener("click",()=>{checkRuntime();});
menu.querySelector("#codeWorkspaceOpen").addEventListener("click",()=>{closeMenu();window.dispatchEvent(new Event("aksara:code-workspace-open"));});
menu.querySelector("#codeHtmlPreview").addEventListener("click",()=>{closeMenu();window.dispatchEvent(new CustomEvent("aksara:code-workspace-open",{detail:{language:"html"}}));});
menu.querySelector("#codeEvalOpen").addEventListener("click",()=>{closeMenu();window.dispatchEvent(new Event("aksara:code-evaluation-open"));});
menu.querySelectorAll("[data-code-language]").forEach(btn=>btn.addEventListener("click",()=>{
 const language=btn.dataset.codeLanguage;
 if(!engine.available.includes(language))return;
 if(language==="javascript"&&!pill.classList.contains("ready"))return;
 closeMenu();
 window.dispatchEvent(new CustomEvent("aksara:code-language",{detail:{language}}));
 if(language==="cpp"){window.dispatchEvent(new CustomEvent("aksara:code-workspace-open",{detail:{language:"cpp"}}));return;}
 document.getElementById("input")?.focus();
}));
let permissionEnabled=false,executionRunning=false,runtimeReady=false;
function updateLabel(){
 label.textContent="Code Engine";
 pill.dataset.aiExecution=executionRunning?"running":permissionEnabled?"armed":"off";
 const state=runtimeReady?(executionRunning?"Running":permissionEnabled?"Armed":"Ready"):"Offline";
 pill.setAttribute("aria-label","Code Engine. Status: "+state+". Tekan untuk lihat runtime dan kebenaran A.I.");
}
window.addEventListener("aksara:ai-code-permission",event=>{
 permissionEnabled=event.detail?.enabled===true;
 executionRunning=event.detail?.running===true;
 updateLabel();
});
function checkRuntime(){
 const button=menu.querySelector("#codeEngineRefresh");
 const st=menu.querySelector("#codeJavaScriptState");
 button.disabled=true;
 st.textContent="Checking…";st.className="multi-ai-state is-muted";
 return engine.probe().then(ok=>{
  pill.classList.toggle("ready",ok);pill.classList.toggle("offline",!ok);
  runtimeReady=ok;updateLabel();
  st.textContent=ok?"Ready":"Offline";
  st.className="multi-ai-state "+(ok?"is-ready":"is-offline");
  return ok;
 }).catch(()=>{
  pill.classList.remove("ready");pill.classList.add("offline");
  runtimeReady=false;updateLabel();
  st.textContent="Offline";st.className="multi-ai-state is-offline";
  return false;
 }).finally(()=>{button.disabled=false;});
}
checkRuntime();
})();
