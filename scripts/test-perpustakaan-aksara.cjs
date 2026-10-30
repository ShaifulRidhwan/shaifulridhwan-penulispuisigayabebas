"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const page=fs.readFileSync(path.join(root,"perpustakaan-aksara.html"),"utf8");
const bilik=fs.readFileSync(path.join(root,"bilik-antara.html"),"utf8");
const novel=fs.readFileSync(path.join(root,"antara-cahaya-dan-gelap.html"),"utf8");
const index=fs.readFileSync(path.join(root,"index.html"),"utf8");
const css=fs.readFileSync(path.join(root,"perpustakaan-aksara.css"),"utf8");
const scripts=[...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
test("Katalog mempunyai metadata dan pautan karya utama",()=>{
 assert.match(page,/<html lang="ms">/);
 assert.match(page,/name="viewport"/);
 assert.match(page,/assets\/novel\/cover-01\.jpg/);
 assert.match(page,/<span class="aksara-name">AKSARA Novel<\/span>/);
 assert.match(page,/class="aksara-nav-link" href="bilik-antara\.html">Bilik Antara<\/a>/);
 assert.match(page,/aksara-header\.css\?v=1/);
 assert.match(page,/id="books"/);
 assert.match(page,/id="archiveBooks"/);
});
test("Kod JavaScript katalog boleh dihuraikan",()=>{
 assert.ok(scripts.length>0);
 scripts.forEach((script,i)=>assert.doesNotThrow(()=>new vm.Script(script,{filename:"catalog-inline-"+i+".js"})));
});
test("Koleksi pilihan mengandungi penulis dan bahasa sasaran",()=>{
 const source=scripts.join("\n");
 const m=source.match(/const DATA=(\[[\s\S]*?\]);\s*const COVER_MAP=/);
 assert.ok(m,"Data katalog tidak ditemui");
 const books=vm.runInNewContext(m[1]);
 assert.ok(books.length>=15);
 assert.ok(books.some(b=>b[2]==="Franz Kafka"));
 assert.ok(books.some(b=>b[2]==="Fyodor Dostoevsky"));
 assert.ok(books.some(b=>b[2]==="Albert Camus"));
 assert.ok(books.some(b=>b[3]==="ms"));
 assert.ok(books.some(b=>b[0]==="aksara-original"&&b[3]==="ms"));
 assert.ok(!books.some(b=>["mel-hangtuah","indo-sitti"].includes(b[0])));
 for(const book of books){
  assert.ok(book.length===10||book.length===11,"Rekod boleh mempunyai imej kulit buku");
  if(book[0]==="aksara-original"){assert.equal(book[6],"antara-cahaya-dan-gelap.html?baca=1");continue;}
  const url=new URL(book[6]);
  assert.equal(url.protocol,"https:");
  assert.ok(["www.gutenberg.org","standardebooks.org","www.penguinrandomhouse.com","ms.wikisource.org","id.wikisource.org"].includes(url.hostname),"Sumber luar tidak disahkan: "+url.hostname);
 }
});
test("Integrasi Bilik Antara adalah tambahan dan tidak mengubah studio",()=>{
 assert.match(bilik,/id="featureStudio" href="studio-antara\.html"/);
 assert.match(bilik,/id="featureLibrary" href="perpustakaan-aksara\.html"/);
 assert.match(bilik,/id="featureMetrics"/);
 assert.match(bilik,/id="featureSessions"/);
 assert.ok(bilik.indexOf('id="featureStudio"')<bilik.indexOf('id="featureLibrary"'));
 assert.ok(bilik.indexOf('id="featureLibrary"')<bilik.indexOf('id="featureMetrics"'));
});
test("Hak cipta dan kawalan pemuatan di luar pelayan dinyatakan",()=>{
 assert.match(page,/hak cipta terjemahan/i);
 assert.match(page,/copyright=false/);
 assert.match(page,/localStorage/);
 assert.match(page,/rel="noopener noreferrer"/);
});

test("Navigasi Novel masuk terus pembaca, Karya ke katalog",()=>{
 assert.match(bilik,/href="perpustakaan-aksara\.html">Novel<\/a>/);
 assert.match(bilik,/<strong>Novel · Perpustakaan AKSARA<\/strong>/);
 assert.match(index,/href="antara-cahaya-dan-gelap\.html\?baca=1">Baca Novel<\/a>/);
 assert.match(novel,/URLSearchParams\(window\.location\.search\)\.get\("baca"\)==="1"/);
 assert.match(novel,/openBook\(savedPage\(\)>0\)/);
 assert.match(novel,/frame\.src="assets\/novel\/pembaca\.html"/);
});
test("Katalog ringkas tanpa teks dan kawalan bertanda",()=>{
 assert.doesNotMatch(page,/<select\\b/i);
 assert.doesNotMatch(page,/id="search"/);
 assert.doesNotMatch(page,/class="toolbar"/);
 assert.doesNotMatch(page,/class="heading"/);
 assert.doesNotMatch(page,/class="pills"/);
 assert.doesNotMatch(page,/data-language=/);
 assert.doesNotMatch(page,/data-category=/);
 assert.doesNotMatch(page,/PILIHAN EDITOR/);
 assert.ok(page.includes("new URL(u,window.location.href)"));
 assert.ok(page.includes("new URL(images[i++],window.location.href).href"));
 assert.ok(css.includes(".book:first-child .art{aspect-ratio:9/16"));
});
test("Glass, mobile single-column dan imej kulit buku",()=>{
 assert.match(css,/backdrop-filter:blur\(23px\)/);
 assert.match(css,/@media\(max-width:690px\)/);
 assert.match(css,/\.books\{grid-template-columns:1fr/);
 assert.match(page,/const COVER_MAP=\{/);
 assert.match(page,/covers\.openlibrary\.org/);
 assert.match(page,/pg2554\.cover\.medium\.jpg/);
 assert.match(page,/img\.addEventListener\("error",next\)/);
 assert.match(page,/pg2554-images\.html/);
 assert.doesNotMatch(page,/PILIHAN EDITOR/);
 assert.doesNotMatch(page,/class="feature"/);
 assert.match(page,/assets\/novel\/cover-01\.jpg/);
 assert.ok(page.includes("perpustakaan-aksara.css?v=4"));
});


test("Novel catalog opens immediately beneath shared header without the old introduction",()=>{
 assert.match(page,/<main>\s*<h1 class="sr">Katalog novel AKSARA<\/h1>\s*<section class="collection" id="koleksi"/);
 for(const removed of ["AKSARA / PERPUSTAKAAN NOVEL","DUNIA DALAM","Novel dan sastera falsafah pilihan.","Sesebuah cerita mungkin tamat"]){
  assert.ok(!page.includes(removed),"Removed introductory prose must stay absent: "+removed);
 }
 assert.doesNotMatch(page,/class="intro"/);
 assert.match(page,/<header class="aksara-header">/);
 assert.match(page,/<span class="aksara-name">AKSARA Novel<\/span>/);
 assert.match(css,/\.collection\{padding:18px 0 18px\}/);
 assert.match(css,/@media\(max-width:690px\)[^\n]+\.collection\{padding-top:14px\}/);
 assert.doesNotMatch(css,/\.intro(?:\{|>)/);
 assert.match(page,/id="archiveBooks"/);
});
