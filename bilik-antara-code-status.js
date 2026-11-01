/* AKSARA Code Engine status, independent of Multi AI connectivity. */
(function(){
"use strict";
const existing=document.getElementById("connection");
const engine=window.AksaraCodeRuntime;
if(!existing||!existing.parentElement||!engine)return;
const pill=document.createElement("a");
pill.id="codeEngineStatus";
pill.className="code-engine-status";
pill.href="bilik-antara-code-engine.html";
pill.title="READY hanya selepas sandbox JavaScript lulus 6×7=42. Python dan 10 compiler lain belum disahkan.";
pill.setAttribute("aria-label","Buka AKSARA Code Engine dan lihat status runtime");
const dot=document.createElement("span");dot.className="code-engine-dot";dot.setAttribute("aria-hidden","true");
const label=document.createElement("span");label.id="codeEngineStatusText";label.textContent="Code Engine Checking";
pill.append(dot,label);
existing.insertAdjacentElement("afterend",pill);
const css=document.createElement("style");
css.textContent=[
".chat-controls{gap:7px!important}",
".code-engine-status{display:inline-flex;align-items:center;gap:7px;box-sizing:border-box;height:38px;min-height:38px;padding:0 12px;border:1px solid rgba(220,203,175,.29);border-radius:999px;color:#e6dac9;text-decoration:none;white-space:nowrap;background:rgba(27,35,48,.14);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);font:500 12px/1.4 'DM Sans',system-ui,sans-serif;transition:border-color .2s,background .2s}",
".code-engine-status:hover{border-color:rgba(241,211,158,.55);background:rgba(190,161,113,.1)}",
".code-engine-dot{width:6px;height:6px;border-radius:50%;flex:none;background:#b99c6c}",
".code-engine-status.ready .code-engine-dot{background:#6fcdaa}",
".code-engine-status.offline .code-engine-dot{background:#e7a08e}",
"@media(max-width:760px){.conversation-head .code-engine-status{height:37px;min-height:37px;padding:0 9px;font-size:11px}}",
"@media(max-width:520px){.conversation-head{flex-wrap:wrap;row-gap:7px;padding-top:10px!important;padding-bottom:10px!important}.conversation-head .voice-toolbar{width:100%;justify-content:flex-start}.conversation-head .chat-controls{width:100%;justify-content:space-between}.conversation-head #connection,.conversation-head .code-engine-status{font-size:10px!important;padding-inline:8px!important;min-width:0}.conversation-head #connectionText{font-size:10px!important}.conversation-head #settingsPanel{margin-left:auto}}"
].join("\n");
document.head.appendChild(css);
engine.probe().then(ok=>{
 pill.classList.add(ok?"ready":"offline");
 label.textContent=ok?"Code Engine Ready":"Code Engine Offline";
}).catch(()=>{pill.classList.add("offline");label.textContent="Code Engine Offline";});
})();
