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

test("Portal remains in the same details element but uses viewport top layer",()=>{
 const html=read("bilik-antara.html"),css=read("bilik-antara.css");
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
