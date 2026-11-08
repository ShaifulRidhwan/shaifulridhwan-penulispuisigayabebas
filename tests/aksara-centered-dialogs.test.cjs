"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");

test("Terminal modal stays centered and does not focus command on open",()=>{
 const terminal=read("bilik-antara-ai-terminal.js");
 assert.doesNotThrow(()=>new vm.Script(terminal));
 assert.match(terminal,/dialog\.setAttribute\("tabindex","-1"\)/);
 assert.match(terminal,/autofocus aria-label="Tutup Terminal"/);
 assert.match(terminal,/dialog\.focus\(\{preventScroll:true\}\)/);
 assert.doesNotMatch(terminal,/\$\("aitCommand"\)\.focus\(\)/);
 assert.match(terminal,/#aksaraAITerminal::backdrop/);
 assert.match(terminal,/width:min\(440px,calc\(100vw - 28px\)\)/);
});

test("Sensitive terminal actions use a shared dark dialog, never native browser popups",()=>{
 const html=read("bilik-antara.html");
 const terminal=read("bilik-antara-ai-terminal.js");
 const workspace=read("bilik-antara-code-workspace.js");
 const glass=read("bilik-antara-dialog.js");
 assert.match(html,/bilik-antara-dialog\.js\?v=1/);
 assert.match(glass,/\.aksara-glass-dialog::backdrop/);
 assert.match(glass,/color-scheme:dark/);
 assert.match(glass,/dialog\.showModal\(\)/);
 assert.match(terminal,/AksaraDialog\.confirm/);
 assert.match(terminal,/AksaraDialog\.prompt/);
 assert.match(workspace,/AksaraDialog\.confirm/);
 assert.doesNotMatch(terminal,/window\.(?:confirm|prompt)\(/);
 assert.doesNotMatch(workspace,/(?<!AksaraDialog\.)\bconfirm\(/);
});
test("Portal remains in the same details element but uses viewport top layer",()=>{
 const html=read("bilik-antara.html"),css=read("bilik-antara.css");
 assert.match(html,/bilik-antara\.css\?v=\d+/);
 assert.ok(html.includes("bilik-antara-ai-terminal.js?v=9"));
 assert.match(html,/id="settingsPanel"/);
 assert.match(html,/id="portalCard" popover="manual"/);
 assert.match(html,/function syncPortalPopover\(\)/);
 assert.match(html,/ui\.settings\.addEventListener\("toggle",syncPortalPopover\)/);
 assert.match(html,/id="portalClose"/);
 assert.match(css,/\.settings-card:popover-open/);
 assert.match(css,/#portalCard::backdrop/);
 assert.match(css,/margin:auto!important/);
});

test("AKSARA brand is static, independent Laman utama remains navigable",()=>{
 const html=read("bilik-antara.html");
 assert.match(html,/<div class="brand aksara-brand" aria-label="Aksara A\.I\./);
 assert.doesNotMatch(html,/<a class="brand aksara-brand" href="index.html"/);
 assert.match(html,/<a class="nav-link aksara-nav-link" href="index.html">Laman utama<\/a>/);
});

test("Terminal and Portal match Connection glass material without altering controls",()=>{
 const html=read("bilik-antara.html"),portal=read("bilik-antara.css"),terminal=read("bilik-antara-ai-terminal.js");
 assert.match(html,/bilik-antara\.css\?v=108/);
 assert.match(html,/bilik-antara-ai-terminal\.js\?v=9/);
 for(const sheet of [portal,terminal]){
  assert.ok(sheet.includes("rgba(23,31,45,.36)"));
  assert.ok(sheet.includes("rgba(9,14,24,.43)"));
  assert.ok(sheet.includes("blur(6px) saturate(1.08)"));
  assert.ok(sheet.includes("blur(4px) saturate(1.06)"));
 }
 assert.match(portal,/#portalCard:popover-open/);
 assert.match(terminal,/id="aitEditor"/);
 assert.match(terminal,/id="aitCommandForm"/);
 assert.match(terminal,/id="aitClose"/);
 assert.match(portal,/#portalClose/);
});

