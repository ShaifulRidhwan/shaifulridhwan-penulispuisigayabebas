"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const file=p=>fs.readFileSync(p,"utf8");
const home=file("index.html"),chat=file("bilik-antara.html");
const css=file("gaya-bebas.css"),js=file("gaya-bebas.js"),data=file("karya-data.js");
const archive=JSON.parse(file("karya-index.json"));
const match=data.match(/window\.__POEMS__\s*=\s*(\[[\s\S]*\]);\s*$/);
assert.ok(match,"Standalone archive data missing");
const poems=JSON.parse(match[1]);
const scriptArray=(name)=>{
 const m=js.match(new RegExp("var "+name+" = (\\[[^;]+\\]);"));
 assert.ok(m,name+" configuration missing");
 return JSON.parse(m[1]);
};
test("33 authentic poems with no rewritten lines or duplicates",()=>{
 assert.equal(poems.length,33);
 assert.equal(archive.length,34);
 assert.deepEqual(poems.map(x=>x[0]),archive.slice(0,33).map(x=>x.title));
 for(let i=0;i<33;i++)assert.deepEqual(poems[i][1],archive[i].lines,"Poem text changed: "+archive[i].title);
 assert.equal(new Set(poems.map(x=>x[0])).size,33);
 assert.ok(!poems.some(x=>x[0]==="ANTARA CAHAYA DAN GELAP"));
});
test("Editorial shortlist is distinct and does not hide rest of the archive",()=>{
 const picks=scriptArray("PILIHAN"),cats=scriptArray("CATS");
 assert.equal(picks.length,6);
 assert.equal(new Set(picks).size,6);
 assert.ok(picks.every(title=>poems.some(x=>x[0]===title)));
 assert.deepEqual([24,2,3,4],["Media Sosial","Duologi","Trilogi","Tetralogi"].map(t=>cats.filter(x=>x===t).length));
 assert.match(js,/mode==='all'/);
 assert.match(js,/mode==='pilihan'/);
 assert.match(home,/data-cat="pilihan"/);
 assert.match(home,/data-cat="all"/);
 assert.doesNotMatch(home,/data-series="novel"/);
 assert.match(js,/activeCat='pilihan'/);
 assert.match(home,/id="searchInput"/);
});
test("Every poem has a server-visible catalogue title and interactive archive access",()=>{
 const toc=[...home.matchAll(/data-archive-title="([^"]+)"/g)].map(x=>x[1]);
 assert.equal(toc.length,33);
 assert.deepEqual(toc,poems.map(x=>x[0]));
 assert.match(js,/archiveDirectory\.addEventListener/);
 assert.match(home,/id="countTotal">33/);
 assert.match(home,/id="archiveDirectory"/);
});
test("Foreword removed while manifesto, work and author sections stay intact",()=>{
 assert.doesNotMatch(home,/id="kata-pengantar"|KATA PENGANTAR/);
 for(const id of ["manifesto","duologi","trilogi","tetralogi","karya","tentang"])assert.ok(home.includes('id="'+id+'"'),id);
 assert.match(home,/role="main"/);
 assert.match(home,/class="skip-link"/);
 assert.match(home,/<label class="sr-only" for="searchInput">/);
 assert.match(home,/role="status" aria-live="polite"/);
 assert.doesNotMatch(home,/wa\.me\/itsmesepulll/);
});
test("Asset extraction preserves CSS and JavaScript with correct ordering",()=>{
 assert.ok(css.length>35000&&js.length>10000);
 assert.equal((home.match(/<style\b/gi)||[]).length,0);
 assert.equal((home.match(/<script\b/gi)||[]).length,3);
 assert.match(home,/href="gaya-bebas\.css\?v=\d+"/);
 assert.match(home,/src="karya-data\.js\?v=1" defer/);
 assert.match(home,/src="gaya-bebas\.js\?v=\d+" defer/);
 assert.ok(home.indexOf('src="karya-data.js')<home.indexOf('src="gaya-bebas.js'));
});
test("Canonical, open graph and JSON-LD consistency across public pages",()=>{
 assert.match(home,/<link rel="canonical" href="https:\/\/shaifulridhwan-penulispuisigayabebas\.netlify\.app\/"/);
 assert.match(chat,/<link rel="canonical" href="https:\/\/shaifulridhwan-penulispuisigayabebas\.netlify\.app\/bilik-antara\.html"/);
 assert.match(home,/<meta property="og:title"/);
 assert.match(chat,/<meta property="og:title"/);
 assert.match(chat,/<meta property="og:image"/);
 assert.match(home,/<meta name="twitter:card" content="summary_large_image"/);
 const match=home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
 assert.ok(match,"JSON-LD missing");
 const graph=JSON.parse(match[1])["@graph"];
 assert.equal(graph.filter(x=>x["@type"]==="CreativeWork").length,33);
});
