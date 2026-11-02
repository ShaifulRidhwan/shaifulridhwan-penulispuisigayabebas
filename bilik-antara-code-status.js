/* AKSARA Code Engine: an in-chat runtime menu; no page navigation or AI dependency. */
(function(){
"use strict";
const existing=document.getElementById("connection"),engine=window.AksaraCodeRuntime;
if(!existing||!existing.parentElement||!engine||!window.AksaraCodeHealth)return;
const health=window.AksaraCodeHealth.create();
const pill=document.createElement("button");
pill.id="codeEngineStatus";pill.type="button";pill.className="code-engine-status";
pill.setAttribute("aria-haspopup","dialog");pill.setAttribute("aria-controls","codeEngineMenu");
pill.setAttribute("aria-expanded","false");pill.setAttribute("aria-label","Code Engine · Runtime Health: Unverified. Open runtime details.");
pill.title="Code Engine · Runtime Health: Unverified · AI Execution: Off";
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
 '<div class="multi-ai-head"><div><strong id="codeEngineMenuTitle">Code Engine · Runtime Health</strong><p id="codeEngineMenuDescription">Five executable runtimes including C++20. HTML/CSS Live Preview is sandboxed. Lazy runtimes are verified only after execution.</p><p id="codeHealthCheckedAt" class="code-health-freshness" role="status">Not checked yet</p></div><button type="button" id="codeMenuClose" aria-label="Close Code Engine">×</button></div>',
 '<div id="codeEngineActivity" class="code-health-activity" role="status" aria-live="polite" hidden></div>',
 '<div class="multi-ai-list" id="codeRuntimeList" aria-label="Runtime availability and verified execution status">',
  '<button type="button" class="multi-ai-row code-menu-language" id="codeHtmlPreview"><span class="multi-ai-provider">HTML · CSS</span><span class="multi-ai-state is-ready" id="codeHtmlState">Available</span></button>',
  '<button type="button" class="multi-ai-row code-menu-language" data-code-language="javascript"><span class="multi-ai-provider">JavaScript</span><span class="multi-ai-state is-muted" id="codeJavaScriptState">Checking…</span></button>',
  '<button type="button" class="multi-ai-row code-menu-language" data-code-language="python"><span class="multi-ai-provider">Python · Pyodide</span><span class="multi-ai-state is-muted" id="codePythonState">Not Tested · On Demand</span></button>',
  '<button type="button" class="multi-ai-row code-menu-language" data-code-language="typescript"><span class="multi-ai-provider">TypeScript</span><span class="multi-ai-state is-muted" id="codeTypeScriptState">Not Tested · On Demand</span></button>',
  '<button type="button" class="multi-ai-row code-menu-language" data-code-language="sql"><span class="multi-ai-provider">SQL · SQLite WASM</span><span class="multi-ai-state is-muted" id="codeSQLState">Not Tested · On Demand</span></button>',
  '<button type="button" class="multi-ai-row code-menu-language" data-code-language="cpp"><span class="multi-ai-provider">C++ · Clang WASM</span><span class="multi-ai-state is-muted" id="codeCPPState">Not Tested · ~29 MB</span></button>',
 '</div>',
 ' <div class="multi-ai-actions"><button type="button" id="codeEngineRefresh">Refresh Status</button><button type="button" id="codeWorkspaceOpen">Code Workspace</button><button type="button" id="codeEvalOpen">Evaluation Lab</button></div>'
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
'.code-health-freshness{font:500 10px/1.45 "DM Sans",sans-serif!important;opacity:.8;margin:3px 0 9px!important}',
'.code-health-activity[hidden]{display:none!important}',
'.code-health-activity{font:500 11px/1.5 "DM Sans",sans-serif;color:#ead9bf;padding:9px 11px;margin:0 0 11px;border:1px solid rgba(222,193,151,.24);border-radius:11px;background:rgba(255,255,255,.032);overflow-wrap:anywhere}',
'.conversation-head .code-engine-status[data-runtime-health="unverified"] .code-engine-core{color:#c8c2b5}',
'.conversation-head .code-engine-status[data-runtime-health="checking"] .code-engine-core{color:#ddc18f}',
'.conversation-head .code-engine-status[data-runtime-health="unavailable"] .code-engine-core{color:#e7a08e}',
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
 if(language==="javascript"&&health.snapshot().rows.find(row=>row.language==="javascript")?.status!=="verified")return;
 closeMenu();
 window.dispatchEvent(new CustomEvent("aksara:code-language",{detail:{language}}));
 if(language==="cpp"){window.dispatchEvent(new CustomEvent("aksara:code-workspace-open",{detail:{language:"cpp"}}));return;}
 document.getElementById("input")?.focus();
}));
let permissionEnabled=false,executionRunning=false,runtimeReady=false,runtimeChecking=false;
const stateIds={html:"codeHtmlState",javascript:"codeJavaScriptState",python:"codePythonState",
 typescript:"codeTypeScriptState",sql:"codeSQLState",cpp:"codeCPPState"};
const stateNames={verified:"Verified",unverified:"Unverified",unavailable:"Unavailable",
 "not-tested":"Not Tested · On Demand",available:"Available"};
function renderHealth(){
 const state=health.snapshot(),ok=state.overall==="ready";
 runtimeReady=ok;
 pill.classList.toggle("ready",ok);
 pill.classList.toggle("offline",state.overall==="unavailable");
 pill.dataset.runtimeHealth=state.overall;
 label.textContent="Code Engine";
 pill.dataset.aiExecution=executionRunning?"running":permissionEnabled?"armed":"off";
 for(const row of state.rows){
  const cell=menu.querySelector("#"+stateIds[row.language]);
  if(!cell)continue;
  let name=stateNames[row.status]||"Unverified";
  if(row.language==="cpp"&&row.status==="not-tested")name="Not Tested · ~29 MB";
  if(row.language==="javascript"&&state.checking)name="Checking…";
  cell.textContent=name;
  cell.className="multi-ai-state "+(row.status==="verified"?"is-online":row.status==="unavailable"?"is-offline":
   row.status==="available"?"is-ready":"is-muted");
  cell.title=row.status==="verified"?"Verified by "+row.source+" · "+Math.round((row.age||0)/1000)+"s ago":
   row.status==="not-tested"?"Load only when manually executed. No background download.":
   row.reason||"Not verified yet";
 }
 const healthLabel=state.overall==="ready"?"Ready":state.overall==="checking"?"Checking":
  state.overall==="unavailable"?"Unavailable":"Unverified";
 const execLabel=executionRunning?"Running":permissionEnabled?"Armed":"Off";
 pill.title="Runtime Health: "+healthLabel+" · "+state.verified+"/5 Verified · AI Execution: "+execLabel;
 pill.setAttribute("aria-label","Code Engine. Runtime: "+healthLabel+". AI Execution: "+
  execLabel+". "+state.verified+" of 5 runtimes verified. Open runtime details.");
 const checked=menu.querySelector("#codeHealthCheckedAt");
 checked.textContent=(state.lastCheckedAt?"Last JavaScript self-test: "+state.checkedAgo:"JavaScript self-test: Not run")+
  " · "+state.verified+"/5 runtimes verified";
 checked.dataset.healthState=state.overall;
 const note=menu.querySelector("#codeEngineActivity");
 note.hidden=state.activity.state==="idle";
 note.textContent=note.hidden?"":"Execution Activity · "+state.activity.message+
  (state.activity.language?" · "+(window.AksaraCodeHealth.LABELS[state.activity.language]||""):"");
 note.dataset.activityState=state.activity.state;
 return state;
}
function updateLabel(){
 health.setPermission(permissionEnabled,executionRunning);
 renderHealth();
}
window.addEventListener("aksara:ai-code-permission",event=>{
 permissionEnabled=event.detail?.enabled===true;
 executionRunning=event.detail?.running===true;
 updateLabel();
});
window.addEventListener("aksara:code-runtime-activity",event=>{
 health.activity(event.detail);
 renderHealth();
});
window.addEventListener("aksara:code-preview-ready",()=>{
 health.previewVerified();renderHealth();
});
function checkRuntime(){
 if(runtimeChecking)return Promise.resolve(false);
 runtimeChecking=true;
 const button=menu.querySelector("#codeEngineRefresh");
 button.disabled=true;health.beginProbe();renderHealth();
 const started=performance.now();
 return engine.probeLanguage("javascript").then(report=>{
  health.probe(report.ready===true,{latencyMs:report.runtimeMs||Math.round(performance.now()-started),
   error:report.error||"JavaScript self-test returned an unexpected result"});
  renderHealth();return report.ready===true;
 }).catch(error=>{
  health.probe(false,{error:String(error?.message||error).slice(0,140)});
  renderHealth();return false;
 }).finally(()=>{runtimeChecking=false;button.disabled=false;});
}
const freshnessTimer=setInterval(renderHealth,20000);
window.addEventListener("pagehide",()=>clearInterval(freshnessTimer),{once:true});
checkRuntime();
})();