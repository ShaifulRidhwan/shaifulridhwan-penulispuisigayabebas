"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const U=require("../bilik-antara-session-utils.js");
const row=(id,at=1,pinned=false)=>({id,at,pinned,history:[{role:"user",content:"Sesi "+id,timestamp:at*1000}]});
test("Archive changes reconcile tab A and B instead of writing a stale full snapshot",()=>{
 const a=U.mergeArchive([],{upserts:[row("tab-a",10)]});
 const b=U.mergeArchive(a,{upserts:[row("tab-b",20)]});
 assert.deepEqual(b.map(x=>x.id),["tab-b","tab-a"]);
 const aLater=U.mergeArchive(b,{upserts:[row("tab-a",30)]});
 assert.deepEqual(aLater.map(x=>x.id),["tab-a","tab-b"]);
});
test("Deleting a session preserves the other tab; no stale write resurrects an old ID",()=>{
 const initial=[row("tab-a",10),row("tab-b",20)];
 const after=U.mergeArchive(initial,{removedIds:["tab-a"]});
 assert.deepEqual(after.map(x=>x.id),["tab-b"]);
 assert.deepEqual(U.mergeArchive(after,{upserts:[row("tab-c",40)]}).map(x=>x.id),["tab-c","tab-b"]);
});
test("Explicit clear all deletes all entries while preserving no implicit delete",()=>{
 const a=[row("tab-a"),row("tab-b")];
 assert.equal(U.mergeArchive(a,{}).length,2);
 assert.deepEqual(U.mergeArchive(a,{clearAll:true,upserts:[row("tab-c")]}),[]);
});
test("Pin sorting stays stable; importer metadata survives reconciliation",()=>{
 const a=row("a",10),b={...row("b",1,true),title:"Catatan lama",titleEdited:true};
 const out=U.mergeArchive([a],{upserts:[b]});
 assert.deepEqual(out.map(x=>x.id),["b","a"]);
 assert.equal(out[0].titleEdited,true);
});
test("Active tab reload keeps its own archive even when global snapshot belongs to another",()=>{
 const a=row("tab-a",11),b=row("tab-b",22);
 const x=U.resolveActiveSession([a,b],b.history,"tab-a");
 assert.equal(x.id,"tab-a");
 assert.equal(x.restoreEntry,a);
 const y=U.resolveActiveSession([a,b],a.history,"tab-a");
 assert.equal(y.id,"tab-a");
 assert.equal(y.restoreEntry,null);
});
test("New tab selects matching archived session; stale prior ID is never resurrected",()=>{
 const a=row("tab-a",11),b=row("tab-b",22);
 assert.equal(U.resolveActiveSession([a,b],b.history,"stale-deleted").id,"tab-b");
 assert.equal(U.resolveActiveSession([],a.history,"stale-deleted").id,null);
});
test("Malformed archive entries do not enter the merged result",()=>{
 const a=U.mergeArchive([{id:"bad",history:"oops"},row("okay")],
  {upserts:[{id:"bad2"},row("other")]});
 assert.deepEqual(a.map(x=>x.id).sort(),["okay","other"]);
});
test("Integration re-reads disk before committing and never overwrites entire archive at boot",()=>{
 const s=fs.readFileSync("bilik-antara-suite.js","utf8");
 assert.match(s,/const raw=localStorage\.getItem\(KEYS\.archive\)/);
 assert.match(s,/mergeArchive\(latest,\{upserts,removedIds,clearAll\}\)/);
 assert.match(s,/persistArchive\(\{upserts:\[entry\]\}\)/);
 assert.match(s,/persistArchive\(\{removedIds:\[item\.id\]\}\)/);
 assert.match(s,/persistArchive\(\{clearAll:true\}\)/);
 assert.doesNotMatch(s,/if\(titleChanges&&api\.remember\(\)\)\{try\{localStorage\.setItem/);
});
test("Unsaved memory note and toggle have navigation and reload guards",()=>{
 const s=fs.readFileSync("bilik-antara-suite.js","utf8");
 assert.match(s,/function memoryDirty\(\)/);
 assert.match(s,/function confirmMemoryDiscard\(\)/);
 assert.match(s,/window\.addEventListener\("beforeunload"/);
 assert.match(s,/memoryDraft=\{field,toggle,originalText:field\.value,originalEnabled:toggle\.checked,version:rawMemoryVersion\(\)\}/);
 assert.match(s,/memoryDraft=null;draftStatus\.textContent="Nota disimpan/);
});
test("Concurrent memory writes require a deliberate overwrite confirmation",()=>{
 const s=fs.readFileSync("bilik-antara-suite.js","utf8");
 assert.match(s,/rawMemoryVersion\(\)!==memoryDraft\?\.version/);
 assert.match(s,/Memori sudah berubah di tab lain/);
 assert.match(s,/window\.addEventListener\("storage"/);
 assert.match(s,/Memori berubah di tab lain/);
});
test("Disabling session saving is deliberate, keeps memory separate and respects other tab's opt-out",()=>{
 const h=fs.readFileSync("bilik-antara.html","utf8");
 const s=fs.readFileSync("bilik-antara-suite.js","utf8");
 assert.match(s,/Matikan Simpan sesi\? Semua arkib sesi tersimpan/);
 assert.match(h,/if\(localStorage\.getItem\(SESSION_PREF_STORAGE\)==="off"\)/);
 assert.match(s,/window\.addEventListener\("storage",event=>/);
 assert.match(s,/Opt-out is confirmed in the main privacy checkbox/);
 assert.match(s,/memoryForPrompt:question=>memory\.enabled/);
 assert.match(h,/id="contextFallback">/);
});
test("Both defaults remain ON, no server memory or hidden auto-save of note drafts",()=>{
 const h=fs.readFileSync("bilik-antara.html","utf8");
 const s=fs.readFileSync("bilik-antara-suite.js","utf8");
 assert.match(h,/id="rememberChat" checked>/);
 assert.match(s,/let memory=read\(KEYS\.memory,\{enabled:true,text:""\}\)/);
 assert.match(s,/const updated=\{enabled:toggle\.checked,text:field\.value\.trim\(\)\.slice\(0,8000\)\}/);
 assert.match(h,/bilik-antara-suite\.js\?v=19/);
 assert.match(h,/bilik-antara-session-utils\.js\?v=3/);
});

test("A new visit shows starter questions but reload does not erase chat or memory",()=>{
 const suite=fs.readFileSync("bilik-antara-suite.js","utf8");
 const html=fs.readFileSync("bilik-antara.html","utf8");
 assert.match(suite,/navigationType!=="reload"/);
 assert.match(suite,/if\(firstLoadIsNewVisit\)startFreshVisit\(\)/);
 assert.match(suite,/if\(!event\.persisted\)return/);
 assert.match(suite,/if\(!snapshotCurrent\(\)\)return false/);
 assert.match(suite,/activeId=freshId\(\)/);
 assert.match(suite,/if\(!api\.fresh\(\)\)/);
 assert.match(html,/function welcome\(/);
 assert.match(html,/id="starters"/);
 assert.match(html,/Siapa Aku/);
 assert.match(html,/The Coder Poet/);
 assert.match(html,/bilik-antara-suite\.js\?v=19/);
});

test("Suite drawer behaves as a keyboard modal without changing session data",()=>{
 const s=fs.readFileSync("bilik-antara-suite.js","utf8");
 assert.match(s,/drawer\.setAttribute\("role","dialog"\)/);
 assert.match(s,/drawer\.setAttribute\("aria-modal","true"\)/);
 assert.match(s,/closeButton\.focus\(\{preventScroll:true\}\)/);
 assert.match(s,/panelTrigger=document\.activeElement/);
 assert.match(s,/event\.key!=="Tab"/);
 assert.match(s,/trigger\.focus\(\{preventScroll:true\}\)/);
 assert.doesNotThrow(()=>new (require("node:vm").Script)(s));
});
