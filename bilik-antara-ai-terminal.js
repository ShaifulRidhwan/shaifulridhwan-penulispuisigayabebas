/* AKSARA Terminal: browser sandbox, consent-gated AI and project console. */
(function(){
"use strict";
const core=window.AksaraTerminalCore,engine=window.AksaraCodeRuntime,bridge=window.BilikAntaraBridge;
const menu=document.getElementById("codeEngineMenu"),form=document.getElementById("composer");
const engineChip=document.getElementById("codeEngineStatus");
if(!core||!engine||!bridge||!form||!engineChip?.parentElement)return;
// Independent top-level glass chip, immediately beside Code Engine.
// Reuse Code Engine glass, size and core animation so the header remains cohesive.
const trigger=document.createElement("button");
trigger.type="button";trigger.id="codeAITerminalOpen";
trigger.className="code-engine-status ai-terminal-status";
trigger.setAttribute("aria-haspopup","dialog");
trigger.setAttribute("aria-controls","aksaraAITerminal");
trigger.setAttribute("aria-expanded","false");
const triggerIcon=document.createElement("span");
triggerIcon.className="code-engine-core ai-terminal-core";
triggerIcon.setAttribute("aria-hidden","true");
triggerIcon.innerHTML='<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><rect x="2.5" y="4.2" width="19" height="15.6" rx="2.8"/><path d="m7 9 3.7 3-3.7 3m6.2.4h4.2"/></svg>';
const triggerLabel=document.createElement("span");
triggerLabel.id="aiTerminalStatusText";
triggerLabel.textContent="Terminal";
trigger.append(triggerIcon,triggerLabel);
engineChip.insertAdjacentElement("afterend",trigger);
const dialog=document.createElement("dialog");dialog.id="aksaraAITerminal";dialog.className="multi-ai-dialog aksara-ai-terminal";
dialog.setAttribute("aria-labelledby","aitTitle");
dialog.setAttribute("tabindex","-1");
dialog.innerHTML=[
'<div class="multi-ai-head"><div><strong id="aitTitle">AKSARA Terminal</strong><p>Terminal maya dalam sandbox browser, bukan shell OS atau server.</p></div><button id="aitClose" type="button" autofocus aria-label="Tutup Terminal">×</button></div>',
'<div class="ait-shell">',
'<div class="ait-row"><strong>Code Intelligence</strong><small id="aitRuntimeState">Sandbox · on demand</small></div>',
'<div class="ait-modes" role="group" aria-label="Mod terminal"><button data-mode="manual" type="button">Manual</button><button data-mode="assist" type="button">AI Assist</button><button data-mode="agent" type="button">AI Agent</button></div>',
'<section class="ait-glass-panel ait-glass-panel--editor"><div class="ait-section-heading"><strong>Editor Projek</strong><small>Fail & contoh kod</small></div>',
'<div class="ait-row"><label for="aitFile">Fail</label><select id="aitFile"></select><button id="aitAdd" type="button">+ Fail</button><button id="aitDelete" type="button">Buang</button></div>',
'<textarea id="aitEditor" rows="8" spellcheck="false" aria-label="Editor kod projek"></textarea>',
'<div class="ait-example-row"><label for="aitExampleSelect">Contoh Kod</label><select id="aitExampleSelect" aria-label="Pilih contoh bahasa"></select><button id="aitLoadExample" type="button">Muat contoh</button></div>',
'<p class="ait-input-hint">Editor atas = kod program. Terminal bawah = satu arahan setiap Enter. Contoh: <code>run main.py</code>. Kod tidak dijalankan secara automatik.</p>',
'</section>',
'<section class="ait-glass-panel ait-glass-panel--runtime"><div class="ait-section-heading"><strong>Runtime & Console</strong><small>Sandbox setempat</small></div>',
'<div class="ait-row"><button id="aitRun" type="button">▶ Run</button><button id="aitStop" type="button" disabled>■ Stop</button><button id="aitTests" type="button">Uji</button><button id="aitUndo" type="button">Rollback</button><button id="aitWorkspace" type="button">Editor penuh</button><button id="aitPreview" type="button">Live Preview</button></div>',
'<div class="ait-row"><button id="aitRepl" type="button">Python REPL</button><button id="aitAgentCycle" type="button">Uji & baiki · Agent</button><small id="aitReplStatus">Python REPL · OFF</small></div>',
'<div class="ait-row" id="aitStdinWrap" hidden><label for="aitStdin">C++ stdin</label><textarea id="aitStdin" maxlength="4000" rows="2" placeholder="Input untuk std::cin"></textarea></div>',
'<section class="ait-console"><div class="ait-row"><strong>TERMINAL</strong><small id="aitProfile">Belum diuji</small></div><pre id="aitOutput" role="log" aria-live="polite"></pre>',
'<form id="aitCommandForm"><label id="aitPromptLabel" for="aitCommand">aksara@runtime:~$</label><input id="aitCommand" type="text" maxlength="200" autocomplete="off" spellcheck="false" placeholder="Arahan terminal: help · ls · run main.py"/><button type="submit">Enter</button></form>',
'<div id="aitCodeSuggestion" class="ait-code-suggestion" hidden><span id="aitSuggestionText"></span><button id="aitUseSnippet" type="button">Masuk Editor</button><button id="aitDismissSnippet" type="button">Batal</button></div></section>',
'</section>',
'<section class="ait-patch" id="aitPatchBox" hidden><strong>AI Patch · Semak sebelum guna</strong><pre id="aitDiff"></pre><div class="ait-row"><button id="aitApply" type="button">Gunakan patch</button><button id="aitReject" type="button">Tolak</button></div></section>',
'<section class="ait-glass-panel ait-glass-panel--tools"><div class="ait-section-heading"><strong>Projek & Bantuan A.I.</strong><small>Eksport, import dan privasi</small></div>',
'<div class="ait-row"><button id="aitAI" type="button">Minta A.I. bantu</button><button id="aitExport" type="button">Eksport ZIP</button><button id="aitImportZIP" type="button">Import ZIP</button><input id="aitZipFile" type="file" accept=".zip,application/zip" hidden/><button id="aitImport" type="button">Import Workspace</button><label><input id="aitRemember" type="checkbox"/> Project Memory</label></div>',
'<p id="aitHelp" role="status" aria-live="polite">Kod kekal setempat kecuali kau sahkan penghantaran kepada A.I.</p></section></div>'
].join("");
document.body.appendChild(dialog);
const css=document.createElement("style");
css.textContent=[
/* Inherit the very same glass styling as Code Engine. No new header row or page. */
'.conversation-head #codeAITerminalOpen{flex:0 0 auto;min-width:0;max-width:160px;justify-content:center;gap:7px;color:#eaddc4}',
'.conversation-head #codeAITerminalOpen .ai-terminal-core{color:#d8bb8b}',
'.conversation-head #codeAITerminalOpen .ai-terminal-core svg{stroke-width:1.7;filter:drop-shadow(0 0 3px rgba(228,194,140,.24))}',
'.conversation-head #codeAITerminalOpen[data-terminal-state="running"] .ai-terminal-core svg{animation:codeCoreWorking .75s ease-in-out infinite}',
'.conversation-head #codeAITerminalOpen[data-terminal-state="error"] .ai-terminal-core{color:#e7a08e}',
'.conversation-head #codeAITerminalOpen[data-terminal-state="running"]{border-color:rgba(232,204,143,.53)}',
'.conversation-head #codeAITerminalOpen:focus-visible{outline:2px solid rgba(242,201,143,.85)!important;outline-offset:2px!important}',
'.conversation-head #aiTerminalStatusText{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
'@media(min-width:421px) and (max-width:760px){.conversation-head #codeAITerminalOpen{max-width:105px!important;padding-inline:8px!important;font-size:10px!important}}',
'@media(max-width:520px){.conversation-head #codeEngineStatus,.conversation-head #codeAITerminalOpen{flex:0 0 38px!important;width:38px!important;max-width:38px!important;min-width:38px!important;padding:0!important;justify-content:center!important;gap:0!important}.conversation-head #codeEngineStatus #codeEngineStatusText,.conversation-head #codeAITerminalOpen #aiTerminalStatusText{display:none!important}.conversation-head #codeAITerminalOpen .ai-terminal-core{flex:0 0 17px!important;width:17px!important;height:17px!important}.conversation-head #codeAITerminalOpen .ai-terminal-core svg{width:17px!important;height:17px!important}.conversation-head #connection{flex:1 1 0!important;min-width:0!important}}',
'@media(max-width:340px){.conversation-head #codeEngineStatus,.conversation-head #codeAITerminalOpen{flex-basis:36px!important;width:36px!important;max-width:36px!important;min-width:36px!important}.conversation .conversation-head{gap:3px!important}}',
'@media(prefers-reduced-motion:reduce){.conversation-head #codeAITerminalOpen .ai-terminal-core svg{animation:none!important}}',
'#aksaraAITerminal{box-sizing:border-box;width:min(740px,calc(100vw - 20px));max-width:740px;max-height:95dvh;overflow:auto;padding:15px;border-radius:18px;background:#0b111d;color:#ecdfcc;border:1px solid rgba(232,205,161,.34)}',
'#aksaraAITerminal::backdrop{background:rgba(0,0,0,.76)}',
'#aksaraAITerminal .ait-shell{display:grid;gap:11px;font:500 12px/1.5 "DM Sans",system-ui,sans-serif}',
'#aksaraAITerminal .ait-row,#aksaraAITerminal .ait-modes{display:flex;align-items:center;gap:7px;flex-wrap:wrap}',
'#aksaraAITerminal .ait-row small{margin-left:auto;color:#b9c1bf}',
'#aksaraAITerminal button,#aksaraAITerminal input,#aksaraAITerminal select,#aksaraAITerminal textarea{background:#111d2d;color:#e9e1d3;border:1px solid rgba(232,205,161,.28);border-radius:9px;font:inherit}',
'#aksaraAITerminal button{padding:8px 11px;cursor:pointer}',
'#aksaraAITerminal button[disabled]{opacity:.48;cursor:default}',
'#aksaraAITerminal button:focus-visible,#aksaraAITerminal input:focus-visible{outline:2px solid #ebc68d;outline-offset:2px}',
'#aksaraAITerminal [data-mode][aria-pressed="true"]{background:#c2dac8;color:#08201c}',
'#aitFile{flex:1;min-width:100px;padding:8px}',
'#aksaraAITerminal .ait-example-row{display:flex;gap:7px;align-items:center;flex-wrap:wrap}',
'#aksaraAITerminal .ait-example-row select{flex:1 1 140px;min-width:110px;padding:8px}',
'#aksaraAITerminal .ait-example-row label{color:#d7c1a2;white-space:nowrap}',
'#aksaraAITerminal .ait-input-hint{margin:0;color:#bfc6c4;font:11px/1.5 "DM Sans",sans-serif}',
'#aksaraAITerminal .ait-input-hint code{color:#e0c48e}',
'#aitCodeSuggestion[hidden]{display:none!important}',
'#aksaraAITerminal .ait-code-suggestion{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:8px;border:1px solid rgba(206,181,132,.35);border-radius:10px;background:rgba(83,63,37,.17)}',
'#aitSuggestionText{flex:1 1 160px;color:#e9ddc6;font-size:11px}',
'#aitEditor{box-sizing:border-box;width:100%;min-height:140px;max-height:35dvh;resize:vertical;background:#09121e!important;color:#dde6ea!important;font:12px/1.65 ui-monospace,Consolas,monospace!important;padding:10px}',
'#aksaraAITerminal .ait-console{display:grid;gap:8px;border:1px solid rgba(230,204,159,.25);border-radius:13px;padding:11px;background:#060d17}',
'#aitOutput,#aitDiff{margin:0;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.55 ui-monospace,Consolas,monospace;color:#d9e3db}',
'#aitOutput{min-height:130px;max-height:29dvh}#aitDiff{max-height:190px}',
'#aitCommandForm{display:flex;align-items:center;gap:7px;flex-wrap:wrap}#aitCommandForm label{color:#86d5ac;font:11px ui-monospace,Consolas,monospace}',
'#aitCommand{flex:1;min-width:110px;padding:8px;font:12px ui-monospace,Consolas,monospace!important}',
'#aitPatchBox[hidden],#aitStdinWrap[hidden],#aitZipFile[hidden]{display:none!important}#aitPatchBox{padding:10px;border:1px solid rgba(230,199,138,.4);border-radius:12px}',
'#aitHelp{margin:0;font-size:11px;color:#bfc5c6}',
'@media(max-width:460px){#aksaraAITerminal{padding:9px}#aksaraAITerminal button{padding:8px;font-size:11px}#aitEditor{min-height:110px}}'
,"\n/* AKSARA Terminal Liquid Glass 3.1: blur once on outer dialog, never on source text. */\n#aksaraAITerminal{\n padding:18px!important;\n background:linear-gradient(148deg,rgba(25,36,54,.93),rgba(11,17,30,.95) 56%,rgba(15,24,38,.94))!important;\n border:1px solid rgba(238,209,164,.36)!important;border-radius:20px!important;\n box-shadow:inset 0 1px 0 rgba(255,248,228,.14),0 18px 52px rgba(0,5,13,.46)!important;\n backdrop-filter:blur(14px) saturate(1.12)!important;\n -webkit-backdrop-filter:blur(14px) saturate(1.12)!important;\n overscroll-behavior:contain;\n}\n#aksaraAITerminal .multi-ai-head{padding-bottom:13px;margin-bottom:3px;border-bottom:1px solid rgba(236,208,160,.16)}\n#aksaraAITerminal .multi-ai-head strong{font:600 16px/1.3 \"Space Grotesk\",\"DM Sans\",sans-serif;letter-spacing:.015em;color:#f1e4cc}\n#aksaraAITerminal .multi-ai-head p{color:#acbac3;font-size:11px}\n#aksaraAITerminal .multi-ai-head #aitClose{border-radius:50%;min-width:33px;height:33px;padding:0!important}\n#aksaraAITerminal .ait-shell{gap:12px}\n#aksaraAITerminal .ait-glass-panel{\n display:grid;gap:10px;padding:13px;border:1px solid rgba(223,207,177,.17);\n border-radius:15px;background:linear-gradient(150deg,rgba(184,208,230,.052),rgba(13,24,39,.21));\n box-shadow:inset 0 1px 0 rgba(255,251,238,.07),0 4px 16px rgba(0,3,13,.1);\n}\n#aksaraAITerminal .ait-section-heading{display:flex;align-items:center;justify-content:space-between;gap:8px}\n#aksaraAITerminal .ait-section-heading strong{font:600 12px/1.4 \"Space Grotesk\",\"DM Sans\",sans-serif;color:#eed6ab}\n#aksaraAITerminal .ait-section-heading small{font:500 10px/1.4 \"DM Sans\",sans-serif;color:#a8bbc5;text-align:right}\n#aksaraAITerminal .ait-modes{\n display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px!important;\n padding:4px;border:1px solid rgba(219,196,159,.17);border-radius:13px;\n background:rgba(4,9,18,.34);\n}\n#aksaraAITerminal .ait-modes button{\n padding:9px 7px!important;min-width:0;background:transparent!important;\n border:1px solid transparent!important;border-radius:10px;color:#b8bec5!important;\n font-weight:600;white-space:nowrap;\n}\n#aksaraAITerminal .ait-modes button[aria-pressed=\"true\"]{\n background:linear-gradient(145deg,rgba(233,204,153,.21),rgba(147,180,198,.10))!important;\n border-color:rgba(238,211,167,.32)!important;color:#f4e5c9!important;\n box-shadow:inset 0 1px 0 rgba(255,243,211,.09)!important;\n}\n#aksaraAITerminal .ait-glass-panel button:not(:disabled),\n#aksaraAITerminal .ait-glass-panel select,\n#aksaraAITerminal .ait-glass-panel input:not([type=\"checkbox\"]){\n background:linear-gradient(150deg,rgba(213,231,241,.07),rgba(9,19,33,.32))!important;\n border-color:rgba(221,204,173,.22)!important;color:#e5e8e9;\n box-shadow:inset 0 1px 0 rgba(255,251,233,.06)!important;\n}\n#aksaraAITerminal .ait-glass-panel button:hover:not(:disabled){\n border-color:rgba(238,208,165,.53)!important;background:rgba(226,199,158,.13)!important;\n}\n#aksaraAITerminal #aitRun{\n background:linear-gradient(135deg,rgba(181,213,184,.21),rgba(214,178,113,.1))!important;\n border-color:rgba(166,220,190,.42)!important;color:#e7f3dd!important;font-weight:700;\n}\n#aksaraAITerminal #aitEditor{\n padding:12px!important;min-height:145px;border:1px solid rgba(155,180,206,.23)!important;\n border-radius:11px;background:rgba(3,9,17,.94)!important;color:#e7edf0!important;\n box-shadow:inset 0 1px 7px rgba(0,0,0,.24);\n line-height:1.65!important;tab-size:2;\n}\n#aksaraAITerminal .ait-console{\n padding:12px!important;border:1px solid rgba(133,180,166,.2)!important;\n background:rgba(3,9,15,.94)!important;border-radius:12px!important;\n box-shadow:inset 0 1px 8px rgba(0,0,0,.19);\n}\n#aksaraAITerminal .ait-console strong{font:600 11px/1.3 \"Space Grotesk\",sans-serif;color:#e9d3aa;letter-spacing:.035em}\n#aksaraAITerminal #aitOutput{color:#d2e5dc!important;font:12px/1.6 ui-monospace,Consolas,monospace!important;min-height:140px}\n#aksaraAITerminal #aitCommandForm{padding-top:7px;border-top:1px solid rgba(155,195,169,.13)}\n#aksaraAITerminal #aitCommand{background:rgba(9,20,30,.85)!important;color:#e6ede7!important}\n#aksaraAITerminal #aitHelp{\n padding:10px;border-radius:10px;background:rgba(174,194,213,.055);\n border:1px solid rgba(211,199,175,.14);color:#bcc9ca!important;\n}\n#aksaraAITerminal .ait-patch{\n padding:12px!important;border:1px solid rgba(221,185,126,.37)!important;\n border-radius:14px;background:rgba(79,64,43,.23);\n}\n#aksaraAITerminal .ait-input-hint{color:#b9c3c8}\n@media(max-width:560px){\n #aksaraAITerminal{padding:10px!important;max-height:calc(100dvh - 12px)!important;\n  backdrop-filter:blur(6px) saturate(1.06)!important;-webkit-backdrop-filter:blur(6px) saturate(1.06)!important}\n #aksaraAITerminal .ait-glass-panel{padding:10px;gap:9px}\n #aksaraAITerminal .ait-shell{gap:9px}\n #aksaraAITerminal #aitEditor{min-height:112px}\n #aksaraAITerminal #aitOutput{min-height:110px}\n #aksaraAITerminal .ait-section-heading small{font-size:9px}\n}\n@media(prefers-reduced-motion:reduce){#aksaraAITerminal button{transition:none!important;animation:none!important}}\n"
].join("");
css.textContent += "\n/* Terminal 3.2: native centered dialog, same proportions as Connection.\n   Keep long source/output in one inner scroll; never let it widen the page. */\n#aksaraAITerminal{\n position:fixed!important;inset:0!important;margin:auto!important;\n box-sizing:border-box!important;\n width:min(440px,calc(100vw - 28px))!important;\n max-width:440px!important;\n height:max-content!important;max-height:min(84dvh,720px)!important;\n overflow-x:hidden!important;overflow-y:auto!important;\n overscroll-behavior:contain;\n scrollbar-width:thin;\n border-radius:19px!important;\n}\n#aksaraAITerminal::backdrop{\n background:rgba(3,7,15,.45)!important;\n -webkit-backdrop-filter:blur(8px)!important;\n backdrop-filter:blur(8px)!important;\n}\n#aksaraAITerminal .ait-shell,#aksaraAITerminal .ait-row,\n#aksaraAITerminal .ait-glass-panel,#aksaraAITerminal .ait-console,\n#aksaraAITerminal #aitCommandForm{min-width:0}\n#aksaraAITerminal #aitCommand{min-width:0;flex:1 1 135px}\n#aksaraAITerminal #aitOutput{min-height:88px!important;max-height:170px!important}\n#aksaraAITerminal #aitEditor{min-height:108px!important;max-height:185px!important}\n@media(max-width:560px){\n #aksaraAITerminal{\n  width:calc(100vw - 28px)!important;\n  max-height:min(82dvh,640px)!important;\n  padding:13px!important;\n }\n #aksaraAITerminal .ait-row{gap:6px}\n #aksaraAITerminal .ait-glass-panel{padding:10px}\n #aksaraAITerminal #aitCommandForm label{flex:0 0 auto}\n}\n";
css.textContent += "\n/* Glass parity v1: Terminal matches Connection / Code Engine, runtime unchanged. */\n#aksaraAITerminal{\n background:linear-gradient(150deg,rgba(23,31,45,.36),rgba(9,14,24,.43))!important;\n border:1px solid rgba(244,217,176,.37)!important;\n border-radius:19px!important;\n box-shadow:inset 0 1px 0 rgba(255,244,224,.12),0 14px 35px rgba(0,4,13,.21)!important;\n -webkit-backdrop-filter:blur(6px) saturate(1.08)!important;\n backdrop-filter:blur(6px) saturate(1.08)!important;\n padding:18px!important;max-height:min(84dvh,720px)!important;\n}\n#aksaraAITerminal::backdrop{\n background:rgba(3,7,15,.45)!important;\n -webkit-backdrop-filter:blur(8px)!important;backdrop-filter:blur(8px)!important;\n}\n#aksaraAITerminal .multi-ai-head{\n position:sticky;top:-18px;z-index:2;\n padding:12px 0 14px!important;margin:-12px 0 14px!important;\n background:linear-gradient(180deg,rgba(11,18,29,.74),rgba(11,18,29,.43));\n -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);\n border-bottom:1px solid rgba(231,203,157,.16);\n}\n#aksaraAITerminal .multi-ai-head strong{font:700 16px/1.3 \"DM Sans\",sans-serif;color:#f5e9d8;letter-spacing:.025em}\n#aksaraAITerminal .multi-ai-head p{font:12px/1.55 \"DM Sans\",sans-serif;color:#c6bbad;opacity:.75;margin:7px 0 0}\n#aksaraAITerminal .multi-ai-head #aitClose{\n flex:0 0 38px;width:38px;height:38px;min-height:38px;\n border-radius:11px!important;padding:0!important;\n border:1px solid rgba(233,198,151,.32)!important;\n background:rgba(255,255,255,.045)!important;color:#f5e9d8!important;\n}\n#aksaraAITerminal .ait-shell{gap:10px}\n#aksaraAITerminal .ait-glass-panel{\n gap:10px;padding:13px;\n border:1px solid rgba(222,193,151,.17)!important;\n border-radius:13px!important;\n background:linear-gradient(145deg,rgba(255,255,255,.036),rgba(255,255,255,.016))!important;\n box-shadow:inset 0 1px 0 rgba(255,255,255,.065)!important;\n}\n#aksaraAITerminal .ait-section-heading strong{font:600 12.5px/1.4 \"DM Sans\",sans-serif;color:#ead6b5}\n#aksaraAITerminal .ait-section-heading small{font:500 10px/1.4 \"DM Sans\",sans-serif;color:#b9b9bb}\n#aksaraAITerminal .ait-modes{border:1px solid rgba(222,193,151,.16)!important;border-radius:12px!important;background:rgba(255,255,255,.02)!important}\n#aksaraAITerminal .ait-modes button{border-radius:9px!important;min-height:40px}\n#aksaraAITerminal .ait-modes button[aria-pressed=\"true\"]{border-color:rgba(239,209,163,.35)!important;background:rgba(225,192,143,.14)!important;color:#f5e9d8!important}\n#aksaraAITerminal .ait-glass-panel button:not(:disabled),\n#aksaraAITerminal .ait-glass-panel select,\n#aksaraAITerminal .ait-glass-panel input:not([type=\"checkbox\"]){\n border:1px solid rgba(233,198,151,.27)!important;\n border-radius:11px!important;\n background:linear-gradient(145deg,rgba(255,255,255,.058),rgba(255,255,255,.02))!important;\n box-shadow:inset 0 1px 0 rgba(255,255,255,.07)!important;\n color:#eee5d8;min-height:39px;\n}\n#aksaraAITerminal .ait-glass-panel button:not(:disabled):hover{\n background:rgba(255,255,255,.095)!important;border-color:rgba(240,209,165,.5)!important;\n}\n#aksaraAITerminal #aitRun{background:linear-gradient(145deg,rgba(147,212,172,.13),rgba(238,204,145,.065))!important;color:#dcf2e5!important;border-color:rgba(151,220,180,.38)!important}\n#aksaraAITerminal #aitFile,#aksaraAITerminal #aitExampleSelect{min-width:0;max-width:100%}\n#aksaraAITerminal #aitEditor{\n min-height:106px!important;max-height:190px!important;\n background:rgba(3,9,17,.80)!important;\n border:1px solid rgba(190,201,207,.21)!important;\n border-radius:12px!important;color:#e7edf0!important;\n}\n#aksaraAITerminal .ait-console{border:1px solid rgba(222,193,151,.18)!important;border-radius:12px!important;background:rgba(3,9,15,.73)!important;box-shadow:inset 0 1px 5px rgba(0,0,0,.12)!important}\n#aksaraAITerminal #aitOutput{min-height:86px!important;max-height:170px!important}\n#aksaraAITerminal #aitCommand{background:rgba(4,12,22,.68)!important}\n#aksaraAITerminal #aitHelp{background:rgba(255,255,255,.025)!important;border-color:rgba(222,193,151,.14)!important}\n@media(max-width:560px){\n #aksaraAITerminal{\n  max-height:min(82dvh,650px)!important;padding:14px!important;\n  -webkit-backdrop-filter:blur(4px) saturate(1.06)!important;\n  backdrop-filter:blur(4px) saturate(1.06)!important;\n }\n #aksaraAITerminal .multi-ai-head{top:-14px;margin:-9px 0 12px!important;padding:9px 0 12px!important}\n #aksaraAITerminal .ait-glass-panel{padding:10px;gap:8px}\n #aksaraAITerminal .ait-shell{gap:9px}\n #aksaraAITerminal #aitEditor{min-height:104px!important;max-height:160px!important}\n}\n@media(prefers-reduced-motion:reduce){\n #aksaraAITerminal .ait-modes button{transition:none!important}\n}\n";
 document.head.appendChild(css);
const $=id=>dialog.querySelector("#"+id),langLabel={python:"Python",javascript:"JavaScript",typescript:"TypeScript",sql:"SQL",cpp:"C++",html:"HTML",css:"CSS"};
let files=[{name:"main.py",language:"python",code:'print("Salam AKSARA Terminal")'}],index=0,mode="assist",controller=null,last=null,pending=null,undo=[],attempts=0,waitingAI=null,commands=[],saveTimer=null,repl=null,replActive=false,replBusy=false,historyCursor=-1,suggestedCode=null;
const dbName="aksara-terminal-v2",storeName="projects",prefKey="aksara-terminal-save-consent";
function message(s){$("aitHelp").textContent=String(s||"").slice(0,360);}
function output(s){const pre=$("aitOutput");pre.textContent=(pre.textContent+"\n"+String(s||"")).slice(-11000);pre.scrollTop=pre.scrollHeight;}
function file(){return files[index];}
function render(){
 $("aitFile").replaceChildren();
 files.forEach((f,i)=>{const o=document.createElement("option");o.value=String(i);o.textContent=f.name;$("aitFile").append(o);});
 $("aitFile").value=String(index);$("aitEditor").value=file().code;
 $("aitUndo").disabled=!undo.length;$("aitRun").disabled=Boolean(controller)||replBusy||!engine.available.includes(file().language);
 $("aitTests").disabled=Boolean(controller)||replBusy;
 $("aitStdinWrap").hidden=file().language!=="cpp";
 $("aitRepl").disabled=file().language!=="python"||replBusy;
 $("aitAgentCycle").disabled=mode!=="agent"||Boolean(controller)||replBusy||!engine.available.includes(file().language);
 $("aitReplStatus").textContent=replActive?"Python REPL · "+(replBusy?"RUNNING":"ON · reset jika ubah fail"):"Python REPL · OFF";
 $("aitPromptLabel").textContent=replActive?"py>>>":"aksara@runtime:~$";
 $("aitCommand").placeholder=replActive?"Kod Python: x=6 atau print(x*7)":"Arahan terminal: help · ls · run main.py";
 $("aitLoadExample").disabled=Boolean(controller)||replBusy;
 $("aitPatchBox").hidden=!pending;
 dialog.querySelectorAll("[data-mode]").forEach(x=>x.setAttribute("aria-pressed",String(x.dataset.mode===mode)));
}
function saveCurrent(){file().code=$("aitEditor").value.slice(0,core.MAX_SOURCE);saveLater();}
function clearSuggestion(){
 suggestedCode=null;$("aitCodeSuggestion").hidden=true;$("aitSuggestionText").textContent="";
}
function suggestCode(job){
 if(job.fragment){
  output("C++ ini cuma potongan kod, bukan program lengkap. Pilih Contoh Kod → C++ stdin, tekan Muat contoh dan Run. Isi input di ruang stdin.");
  message("C++ memerlukan fungsi main(). Gunakan contoh lengkap C++ stdin.");
  clearSuggestion();return;
 }
 suggestedCode=job;
 const name=langLabel[job.language]||job.language;
 $("aitSuggestionText").textContent="Kod "+name+" dikesan. Masukkan ke fail baharu dalam editor? Kod tidak akan dijalankan sehingga kau tekan Run.";
 $("aitCodeSuggestion").hidden=false;
 output("Kod "+name+" dikesan dalam input terminal. Tekan Masuk Editor di bawah sebelum Run.");
 message("Kod program masuk editor atas, bukan prompt terminal. Aku boleh letakkan ke fail baharu tanpa menimpa fail asal.");
}
function addExample(){
 if(controller||replBusy){message("Hentikan runtime dahulu.");return;}
 const sample=core.prepareExample($("aitExampleSelect").value,files.map(f=>f.name));
 if(!sample||files.length+sample.files.length>core.MAX_FILES){message("Had 12 fail projek dicapai atau contoh tidak dapat disediakan.");return;}
 saveCurrent();files.push(...sample.files);index=files.findIndex(f=>f.name===sample.primary);
 if(sample.stdin)$("aitStdin").value=sample.stdin;
 if(replActive)closeRepl("Projek bertukar; REPL ditutup supaya sesi tidak bercampur.");
 clearSuggestion();render();saveLater();
 output("Contoh "+sample.label+" dimuat ke "+sample.primary+". Tekan Run untuk menjalankan kod.");
 message("Contoh dimuat sebagai fail baharu tanpa menimpa kod asal. "+(sample.stdin?"Input C++ stdin telah diisi. ":"")+"Tekan Run atau Live Preview.");
}
function importSnippet(){
 const job=suggestedCode;if(!job)return;
 if(controller||replBusy){message("Runtime masih sibuk.");return;}
 const ext={python:".py",javascript:".js",typescript:".ts",sql:".sql",cpp:".cpp",html:".html",css:".css"}[job.language];
 if(!ext){message("Bahasa kod tidak disokong.");return;}
 let number=1,name="";
 do{name="paste_"+number++ +ext;}while(files.some(f=>f.name.toLowerCase()===name.toLowerCase())&&number<=100);
 if(!core.filename(name)||files.length>=core.MAX_FILES){message("Tiada ruang fail baharu (maksimum 12).");return;}
 saveCurrent();files.push({name,language:job.language,code:job.code});index=files.length-1;
 if(job.stdin)$("aitStdin").value=job.stdin;
 if(replActive)closeRepl("Editor bertukar kepada fail baharu.");
 clearSuggestion();render();saveLater();$("aitEditor").focus();
 output("Kod dimasukkan ke "+name+". Tekan Run (atau Live Preview untuk HTML/CSS) untuk menguji.");
 message("Kod "+(langLabel[job.language]||job.language)+" disimpan dalam editor. Belum dijalankan.");
}
function add(name,code=""){
 if(!core.filename(name)||typeof code!=="string"||code.length>core.MAX_SOURCE||files.length>=core.MAX_FILES||files.some(f=>f.name.toLowerCase()===name.toLowerCase()))return false;
 saveCurrent();files.push({name,language:core.language(name),code});index=files.length-1;render();saveLater();return true;
}
function idb(){return new Promise((yes,no)=>{
 if(!window.indexedDB){no(Error("IndexedDB unavailable"));return;}
 const req=indexedDB.open(dbName,1);
 req.onupgradeneeded=()=>req.result.createObjectStore(storeName);
 req.onsuccess=()=>yes(req.result);req.onerror=()=>no(req.error||Error("DB failed"));
});}
async function storage(op,value){
 const db=await idb();
 if(op==="put"&&!$("aitRemember").checked){db.close();return false;}
 try{return await new Promise((yes,no)=>{
  const tx=db.transaction(storeName,op==="get"?"readonly":"readwrite"),store=tx.objectStore(storeName);
  const req=op==="get"?store.get("default"):op==="delete"?store.delete("default"):store.put(value,"default");
  req.onsuccess=()=>yes(req.result);req.onerror=()=>no(req.error||Error("DB failed"));
 });}finally{db.close();}
}
async function persist(){
 if(!$("aitRemember").checked||!core.filesValid(files))return;
 try{await storage("put",{version:2,files:files.map(x=>({...x})),index,mode,savedAt:Date.now()});}
 catch(e){message("Simpan setempat gagal: "+String(e.message||e).slice(0,100));}
}
function saveLater(){if($("aitRemember").checked){clearTimeout(saveTimer);saveTimer=setTimeout(()=>void persist(),400);}}
async function restore(){
 try{
  const allowed=localStorage.getItem(prefKey)==="yes";$("aitRemember").checked=allowed;if(!allowed)return;
  const saved=await storage("get");
  if(saved?.version===2&&core.filesValid(saved.files)&&saved.files.length){
   files=saved.files;index=Math.max(0,Math.min(files.length-1,Number(saved.index)||0));
   mode=["manual","assist","agent"].includes(saved.mode)?saved.mode:"assist";
   render();output("Project Memory dimuatkan · "+files.length+" fail.");
  }
 }catch(e){message("Project Memory tidak tersedia dalam browser ini.");}
}
function pythonFiles(){return files.filter(f=>f.language==="python"&&/^[A-Za-z][A-Za-z0-9_]{0,59}\.py$/.test(f.name)).map(f=>({name:f.name,code:f.code}));}
function closeRepl(reason="Sesi REPL ditutup."){
 if(repl){repl.stop(reason);repl=null;}
 replActive=false;replBusy=false;render();
}
async function replCommand(source){
 if(replBusy||controller||window.AksaraAICodeAgent?.running()){message("Runtime sedang digunakan oleh pelaksanaan lain.");return;}
 if(!replActive){message("Aktifkan Python REPL dahulu.");return;}
 if(!window.AksaraPythonSession){message("Modul Python REPL belum dimuatkan.");return;}
 try{
  if(!repl)repl=window.AksaraPythonSession.create({files:pythonFiles(),onStatus:state=>$("aitRuntimeState").textContent=state});
  replBusy=true;$("aitStop").disabled=false;render();paintTrigger();
  const began=performance.now(),result=await repl.execute(source,{onOutput:(stream,chunk)=>{
   output((stream==="stderr"?"ERR> ":"")+chunk);
  }});
  $("aitProfile").textContent=Math.round(performance.now()-began)+" ms · Python REPL";
  if(!result.stdout&&!result.stderr&&!result.error)output("(Tiada output)");
  if(result.error)output("PYTHON ERROR: "+result.error);
  if(result.truncated)output("Output dipotong mengikut had keselamatan.");
 }catch(error){
  output("Python REPL: "+String(error.message||error).slice(0,350));
  if(repl&&!repl.active()){repl=null;replActive=false;}
 }finally{replBusy=false;$("aitStop").disabled=Boolean(controller);render();paintTrigger();}
}
function sourceReport(result){
 const d=(result.diagnostics||[]).map(x=>String(x.code||"RUNTIME_ERROR")+": "+String(x.message||"").slice(0,300)).join("\n");
 return String(result.output||"(Tiada output)").slice(0,6500)+(d?"\nDIAGNOSTIK:\n"+d:"")+(result.error&&!d?"\nERROR: "+result.error:"");
}
async function execute(f,{signal,quiet=false,expect=null}={}){
 if(!engine.available.includes(f.language))throw Error("HTML/CSS perlu Live Preview, bukan console.");
 const ctl=signal||new AbortController();if(!signal){controller=ctl;$("aitStop").disabled=false;$("aitRun").disabled=true;}
 let overlay=null;
 try{
  if(!quiet){output("▶ "+f.name+" ("+f.language+")");overlay=window.AksaraRuntimeOverlay?.open(f.language,()=>ctl.abort())||null;}
  const extra=f.language==="python"?{projectFiles:pythonFiles()}:f.language==="cpp"?{stdin:$("aitStdin").value.slice(0,4000)}:{};
  const result=await engine.run(f.language,f.code,{...extra,signal:ctl.signal,onProgress:x=>{
   if(!quiet){$("aitRuntimeState").textContent=String(x).slice(0,75);overlay?.update(String(x));}
  }});
  if(!quiet){
   const previous=Number(last?.report?.runtimeMs)||null;
   last={name:f.name,language:f.language,code:f.code,report:result};
   output(sourceReport(result));output(result.ok?"[PASS] Runtime berjaya":"[FAIL] Runtime melaporkan ralat");
   $("aitProfile").textContent=result.runtimeMs+" ms · "+new TextEncoder().encode(result.output||"").length+" B output";
   if(previous!==null)output("Beza masa run sebelumnya: "+(result.runtimeMs-previous)+" ms");
   window.dispatchEvent(new CustomEvent("aksara:code-result",{detail:{language:f.language,code:f.code,report:result}}));
  }
  return {ok:result.ok===true&&(expect===null||String(result.output||"").includes(expect)),result};
 }finally{overlay?.close();if(!signal){controller=null;$("aitStop").disabled=true;$("aitRun").disabled=false;$("aitRuntimeState").textContent="Sandbox · ready";}}
}
async function runNamed(name){
 saveCurrent();const f=files.find(x=>x.name===name);
 if(!f){output("Fail tidak ditemui: "+name);return;}
 if(controller||replBusy||window.AksaraAICodeAgent?.running()){message("Runtime masih sibuk.");return;}
 try{return await execute({...f});}catch(e){output("Runtime dihentikan / gagal: "+String(e.message||e).slice(0,500));return null;}
}
async function tests(){
 if(controller||replBusy||window.AksaraAICodeAgent?.running())return;saveCurrent();const f={...file()};
 const smoke={python:['print(sum([2,3,5,7]))',"17"],javascript:['console.log(6*7)',"42"],
  typescript:['const n:number=6*7;console.log(n)',"42"],sql:['SELECT 6+7 AS total;',"13"],
  cpp:['#include <iostream>\nint main(){std::cout << 42 << "\\n";return 0;}',"42"]}[f.language];
 if(!smoke){message("Ujian console tidak disokong untuk HTML/CSS.");return;}
 controller=new AbortController();$("aitStop").disabled=false;$("aitTests").disabled=true;$("aitRun").disabled=true;
 let pass=0;output("Ujian sebenar (2 kes): runtime smoke + pelaksanaan "+f.name);
 try{
  for(const row of [{name:"Runtime smoke",code:smoke[0],expect:smoke[1]},{name:f.name,code:f.code,expect:null}]){
   const item=await execute({...f,...row},{quiet:true,expect:row.expect,signal:controller});
   pass+=Number(item.ok);output((item.ok?"PASS":"FAIL")+" · "+row.name+" · "+item.result.runtimeMs+" ms"+(item.ok?"":"\n"+sourceReport(item.result).slice(0,700)));
  }
  output("KEPUTUSAN: "+pass+"/2 lulus. Ini smoke test, bukan bukti logik projek sempurna.");
 }catch(e){output("Ujian dihentikan / gagal: "+String(e.message||e).slice(0,400));}
 finally{controller=null;$("aitStop").disabled=true;$("aitTests").disabled=false;$("aitRun").disabled=false;}
}
function command(s){
 const trimmed=String(s||"").trim();
 if(!trimmed)return;
 commands.push(trimmed);commands=commands.slice(-40);historyCursor=-1;
 clearSuggestion();
 const candidate=core.classifyInput(trimmed);
 if(candidate?.type==="steps"){
  output((replActive?"py>>> ":"aksara@runtime:~$ ")+trimmed);
  output(candidate.message);message(candidate.message);return;
 }
 if(replActive&&!["help","exit","reset","status"].includes(trimmed)){
  if(candidate?.type==="code"&&candidate.language!=="python"){
   output("py>>> "+trimmed);suggestCode(candidate);return;
  }
  output("py>>> "+trimmed);void replCommand(trimmed);return;
 }
 const cmd=core.command(trimmed);
 output("aksara@runtime:~$ "+trimmed);
 if(cmd.type==="invalid"&&candidate?.type==="code"){suggestCode(candidate);return;}
 switch(cmd.type){
 case "help":output("ARAHAN TERMINAL (satu arahan setiap Enter): help, pwd, ls, cat main.py, run main.py, python main.py, node demo_js.js, tsc demo_ts.ts, sqlite demo_sql.sql, clang demo_cpp.cpp, tests, history, status, clear, repl, reset, exit.\nKOD PROGRAM: letak di editor atas atau pilih Contoh Kod → Muat contoh.\nPYTHON REPL: tekan Python REPL, barulah taip x=6 dan print(x*7).\nHTML/CSS: buka Live Preview. Terminal bukan shell OS; pip/npm tidak tersedia.");break;
 case "pwd":output("/aksara/project");break;
 case "ls":output(files.map(x=>x.name).join("  "));break;
 case "cat":output(files.find(x=>x.name===cmd.name)?.code||"Fail tidak ditemui.");break;
 case "run":void runNamed(cmd.name);break;
 case "tests":void tests();break;
 case "status":output("Runtime: "+engine.available.join(", ")+"; mod: "+mode+"; fail: "+files.length);break;
 case "history":output(commands.map((x,i)=>(i+1)+". "+x).join("\n"));break;
 case "clear":$("aitOutput").textContent="";break;
 case "repl":
  if(file().language!=="python"){message("Pilih fail .py untuk Python REPL.");break;}
  replActive=true;render();output("Python REPL aktif. Taip Python terus, contohnya x=6 kemudian print(x*7). reset untuk kosongkan state, exit untuk keluar.");break;
 case "reset":
  if(repl)repl.stop("Python REPL direset.");
  repl=null;replActive=true;replBusy=false;render();output("Sesi Python direset. Pemboleh ubah lama sudah tiada.");break;
 case "exit":
  closeRepl();output("Keluar daripada Python REPL.");break;
 default:output(cmd.message||"Arahan tak disokong.");
  output("Petua: pilih Contoh Kod dan tekan Muat contoh untuk mencuba JavaScript, TypeScript, SQL, Python atau C++. Taip help untuk arahan terminal.");
  break;
 }
}
function propose(job){
 const f=file();
 if(!job||job.language!==f.language||!job.code||job.code.length>core.MAX_SOURCE){message("Jawapan A.I. tidak mengandungi satu blok patch yang jelas.");return;}
 pending={name:f.name,before:f.code,after:job.code};
 $("aitDiff").textContent=core.diff(pending.before,pending.after);
 $("aitPatchBox").hidden=false;message("Patch tersedia untuk semakan. Belum digunakan atau dijalankan.");
}
async function agentCycle(){
 if(mode!=="agent"){message("Pilih mod AI Agent untuk Uji & baiki.");return;}
 if(controller||replBusy||waitingAI||window.AksaraAICodeAgent?.running()){message("Tugas lain masih berjalan.");return;}
 if(pending){message("Semak dan terima/tolak patch yang masih menunggu dahulu.");return;}
 saveCurrent();
 const result=await runNamed(file().name);
 if(!result)return;
 if(result.ok){output("AGENT · Runtime lulus. Semak hasil dan ujian fungsi sebelum anggap lengkap.");return;}
 if(attempts>=3){message("Had 3 cubaan AI Agent telah dicapai.");return;}
 output("AGENT · Runtime gagal. Seterusnya minta cadangan patch A.I. dengan izin kau.");
 askAI();
}
async function askAI(){
 saveCurrent();
 if(mode==="manual"){message("Pilih AI Assist atau AI Agent.");return;}
 if(bridge.active()||waitingAI){message("Permintaan A.I. lain masih aktif.");return;}
 const f=file();
 if(!engine.available.includes(f.language)){message("HTML/CSS boleh disemak melalui Live Preview dan Code Workspace.");return;}
 if(mode==="agent"&&attempts>=3){message("Had tiga cubaan patch dicapai. Tukar mod atau Rollback untuk mula semula.");return;}
 const attempt=mode==="agent"?attempts+1:0;
 const prompt=core.aiPrompt({mode,attempt,language:f.language,code:f.code,
  report:last?.name===f.name&&last.code===f.code?last.report:null,thoughtMode:bridge.snapshot?.().thoughtMode||"cahaya",
  task:mode==="agent"?"Diagnosis dan patch ralat sebenar serta edge case":"Semak kod dan cadangkan pembaikan"});
 if(!await window.AksaraDialog.confirm({title:"Kongsi kod dengan A.I.?",message:"Hantar kod dan diagnostik ditapis kepada A.I.? Semak sendiri dahulu supaya tiada rahsia atau kunci API.",confirmText:"Hantar kepada A.I."}))return;
 if(bridge.active()||waitingAI){message("Permintaan A.I. lain masih aktif.");return;}
 if(mode==="agent")attempts++;
 waitingAI={name:f.name,language:f.language,source:f.code};
 dialog.close();bridge.fill(prompt);form.requestSubmit();
 message("Permintaan dihantar melalui chat. Tunggu cadangan patch untuk semakan.");
}
for(const item of core.examples){
 const opt=document.createElement("option");opt.value=item.id;opt.textContent=item.label;$("aitExampleSelect").append(opt);
}
$("aitLoadExample").addEventListener("click",addExample);
$("aitUseSnippet").addEventListener("click",importSnippet);
$("aitDismissSnippet").addEventListener("click",clearSuggestion);
let activeCodeRuns=0,terminalError=false;
function paintTrigger(){
 const state=activeCodeRuns>0||replBusy?"running":terminalError?"error":"sandbox";
 trigger.dataset.terminalState=state;
 const status=state==="running"?"Running":state==="error"?"Error · semak output":"Sandbox · sedia";
 trigger.title="Terminal · "+status;
 trigger.setAttribute("aria-label","Buka Terminal. Status: "+status);
}
window.addEventListener("aksara:code-runtime-activity",event=>{
 const phase=String(event.detail?.phase||"");
 if(phase==="started"){activeCodeRuns=Math.min(20,activeCodeRuns+1);terminalError=false;}
 else if(["completed","cancelled","timeout"].includes(phase)){
  activeCodeRuns=Math.max(0,activeCodeRuns-1);
  if(phase==="completed")terminalError=event.detail?.ok===false;
  else if(phase==="timeout")terminalError=true;
  else terminalError=false;
 }
 if(["started","loading","completed","cancelled","timeout"].includes(phase))paintTrigger();
});
function openTerminal(){
 if(menu?.open)menu.close();
 if(dialog.open){dialog.focus();return;}
 dialog.showModal();
 trigger.setAttribute("aria-expanded","true");
 dialog.scrollTop=0;
 dialog.focus({preventScroll:true});
}
trigger.addEventListener("click",openTerminal);
// Same working terminal exposed as Code Engine Developer Shell, never a fake Linux VM.
window.addEventListener("aksara:code-developer-shell-open",openTerminal);
$("aitClose").addEventListener("click",()=>dialog.close());
dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close();});
dialog.addEventListener("close",()=>{trigger.setAttribute("aria-expanded","false");trigger.focus({preventScroll:true});});
dialog.querySelectorAll("[data-mode]").forEach(b=>b.addEventListener("click",()=>{mode=b.dataset.mode;attempts=0;render();saveLater();}));
$("aitFile").addEventListener("change",()=>{saveCurrent();index=Number($("aitFile").value)||0;render();});
$("aitEditor").addEventListener("input",()=>{saveCurrent();pending=null;$("aitPatchBox").hidden=true;});
$("aitAdd").addEventListener("click",async()=>{
 const name=await window.AksaraDialog.prompt({title:"Tambah fail",message:"Fail baharu: .py, .js, .ts, .sql, .cpp, .html atau .css",defaultValue:"script.py",confirmText:"Tambah"});
 if(name!==null&&!add(name.trim()))message("Fail tidak sah, pendua atau maksimum 12 fail.");
});
$("aitDelete").addEventListener("click",async()=>{
 if(files.length<=1){message("Minimum satu fail.");return;}
 if(!await window.AksaraDialog.confirm({title:"Buang fail?",message:"Buang fail "+file().name+" daripada projek terminal?",confirmText:"Buang"}))return;
 files.splice(index,1);index=Math.min(index,files.length-1);render();saveLater();
});
$("aitRun").addEventListener("click",()=>void runNamed(file().name));
$("aitStop").addEventListener("click",()=>{controller?.abort();if(replBusy)closeRepl("Python REPL dihentikan melalui Stop.");});
$("aitTests").addEventListener("click",()=>void tests());
$("aitUndo").addEventListener("click",()=>{
 const previous=undo.pop();if(!previous)return;
 const pos=files.findIndex(x=>x.name===previous.name);if(pos<0)return;
 files[pos].code=previous.code;index=pos;pending=null;render();saveLater();output("Rollback "+previous.name);
});
$("aitApply").addEventListener("click",()=>{
 if(!pending||file().name!==pending.name||file().code!==pending.before){pending=null;render();message("Patch tidak lagi sepadan dengan kod semasa. Minta A.I. analisis semula.");return;}
 undo.push({name:file().name,code:file().code});undo=undo.slice(-15);
 file().code=pending.after;pending=null;render();saveLater();output("Patch digunakan. Tekan Run untuk mengesahkan.");
});
$("aitReject").addEventListener("click",()=>{pending=null;render();message("Patch ditolak.");});
$("aitWorkspace").addEventListener("click",()=>{
 saveCurrent();
 const ok=window.AksaraCodeWorkspace?.receiveFile?.({...file()});
 if(!ok)message("Editor tidak dapat membuka fail. Semak had 12 fail.");
 else message("Fail diimport dan dibuka dalam Code Workspace.");
});
$("aitAI").addEventListener("click",askAI);
$("aitAgentCycle").addEventListener("click",()=>void agentCycle());
$("aitRepl").addEventListener("click",()=>{
 if(file().language!=="python")return;
 if(replActive)closeRepl();
 else{replActive=true;render();output("Python REPL aktif. Cuba x=6 kemudian print(x*7).");}
});
$("aitPreview").addEventListener("click",()=>{
 saveCurrent();
 const selected=file(),html=selected.language==="html"?selected:files.find(f=>f.language==="html");
 if(!html){message("Tambah fail HTML dahulu. Live Preview hanya untuk HTML/CSS.");return;}
 const workspace=window.AksaraCodeWorkspace;
 if(!workspace?.receiveFile){message("Code Workspace tidak tersedia.");return;}
 let imported=0;
 for(const item of [html,...files.filter(f=>f.language==="css")]){
  imported+=Number(workspace.receiveFile({...item}));
 }
 message(imported+" fail dipindah sebagai salinan ke Workspace Live Preview tanpa JavaScript.");
});
$("aitCommand").addEventListener("keydown",event=>{
 if(event.key!=="ArrowUp"&&event.key!=="ArrowDown")return;
 if(!commands.length)return;
 event.preventDefault();
 historyCursor=event.key==="ArrowUp"?Math.min(commands.length-1,historyCursor+1):Math.max(-1,historyCursor-1);
 $("aitCommand").value=historyCursor<0?"":commands[commands.length-1-historyCursor];
});
$("aitCommandForm").addEventListener("submit",e=>{e.preventDefault();const value=$("aitCommand").value;$("aitCommand").value="";command(value);});
$("aitExport").addEventListener("click",()=>{
 saveCurrent();
 try{
  const bytes=core.zip(files),url=URL.createObjectURL(new Blob([bytes],{type:"application/zip"})),a=document.createElement("a");
  a.href=url;a.download="AKSARA-Project.zip";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  message(files.length+" fail dieksport sebagai ZIP setempat.");
 }catch(e){message("ZIP gagal: "+String(e.message||e).slice(0,160));}
});
$("aitImportZIP").addEventListener("click",()=>$("aitZipFile").click());
$("aitZipFile").addEventListener("change",async()=>{
 const fileToImport=$("aitZipFile").files?.[0];$("aitZipFile").value="";
 if(!fileToImport)return;
 if(fileToImport.size>256000){message("ZIP projek melebihi 256 KB.");return;}
 try{
  const loaded=core.unzipStore(await fileToImport.arrayBuffer());
  if(controller||replBusy){message("Hentikan pelaksanaan sebelum mengimport projek.");return;}
  if(!await window.AksaraDialog.confirm({title:"Ganti projek Terminal?",message:"Gantikan projek terminal dengan "+loaded.length+" fail daripada ZIP ini? Projek semasa akan diganti.",confirmText:"Gantikan"}))return;
  closeRepl();files=loaded;index=0;pending=null;undo=[];last=null;attempts=0;
  render();saveLater();message("ZIP projek disahkan dan diimport: "+loaded.length+" fail.");
 }catch(error){message("ZIP ditolak: "+String(error.message||error).slice(0,220));}
});
$("aitImport").addEventListener("click",()=>{
 const items=window.AksaraCodeWorkspace?.snapshot?.();
 if(!Array.isArray(items)){message("Workspace belum tersedia.");return;}
 let added=0;for(const item of items)if(add(item.name,item.code))added++;
 message(added+" fail diimport. Pendua tidak ditimpa.");
});
$("aitRemember").addEventListener("change",async()=>{
 const on=$("aitRemember").checked;
 try{localStorage.setItem(prefKey,on?"yes":"no");}catch(_){}
 if(on){await persist();message("Project Memory aktif. Projek disimpan pada browser ini sahaja.");}
 else{clearTimeout(saveTimer);try{await storage("delete");}catch(_){}message("Project Memory OFF. Rekod projek setempat dipadam.");}
});
window.addEventListener("ba:answered",e=>{
 if(!waitingAI)return;
 const target=waitingAI;waitingAI=null;
 const job=core.extractPatch(String(e.detail?.answer||""),target.language);
 const pos=files.findIndex(x=>x.name===target.name&&x.language===target.language);
 if(pos>=0&&job?.language===target.language&&files[pos].code===target.source){index=pos;render();propose(job);output("Cadangan patch A.I. diterima, belum dilaksanakan. Buka semula Terminal untuk menyemak diff.");trigger.title="Terminal · Patch menunggu semakan";}
 else if(pos>=0&&files[pos].code!==target.source){message("Kod berubah semasa A.I. menjawab. Patch lama ditolak bagi melindungi perubahan baharu.");}
 else message("Respons A.I. bukan satu blok patch kod yang sah. Semak jawapan di chat.");
});
window.addEventListener("ba:request-failed",()=>{if(waitingAI){waitingAI=null;message("Permintaan A.I. gagal. Kod asal kekal.");}});
window.addEventListener("ba:cleared",()=>{waitingAI=null;controller?.abort();});
window.addEventListener("pagehide",()=>{controller?.abort();clearTimeout(saveTimer);});
window.AksaraAITerminal=Object.freeze({
 version:"2.3",open:openTerminal,
 capabilityPrompt:q=>/\b(?:kod|code|coding|program|python|javascript|typescript|sql|cpp|c\+\+|compiler|runtime|debug|terminal|script|skrip)\b/i.test(String(q||""))?core.capability(engine.available):"",
 state:()=>({mode,files:files.length,hasRun:Boolean(last),pendingPatch:Boolean(pending),projectMemory:$("aitRemember").checked})
});
render();paintTrigger();$("aitOutput").textContent="AKSARA Terminal\nTaip help untuk arahan, atau pilih Contoh Kod → Muat contoh → Run. Kod program diletakkan dalam editor atas, bukan dalam prompt terminal.";
void restore();
})();
