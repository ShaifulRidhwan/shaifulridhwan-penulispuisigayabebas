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
// Metadata JSON-LD is data, not executable JavaScript.
const scripts=[...page.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
 .filter(m=>!/type\s*=\s*["']application\/ld\+json["']/i.test(m[1]))
 .map(m=>m[2]);
test("Katalog mempunyai metadata dan pautan karya utama",()=>{
 assert.match(page,/<html lang="ms">/);
 assert.match(page,/name="viewport"/);
 assert.match(page,/assets\/novel\/cover-01\.jpg/);
 assert.match(page,/<span class="aksara-name">AKSARA Novel<\/span>/);
 assert.match(page,/class="aksara-nav-link" href="https:\/\/shaifulridhwan-penulispuisigayabebas\.netlify\.app\/bilik-antara\.html">Bilik Antara<\/a>/);
 assert.match(page,/aksara-header\.css\?v=2/);
 assert.match(page,/id="books"/);
 assert.doesNotMatch(page,/id="archiveBooks"/);
});
test("Studio curved glass is shared by header only, without the gold rule",()=>{
 const shared=fs.readFileSync(path.join(root,"aksara-header.css"),"utf8");
 const studio=fs.readFileSync(path.join(root,"studio-antara.html"),"utf8");
 for(const [name,html] of [["Studio",studio],["Bilik",bilik],["Novel",page]]){
  assert.match(html,/aksara-header\.css\?v=\d+/,name+" must load versioned shared header CSS");
  assert.ok(html.includes('<header class="aksara-header">')||
    html.includes('<header class="topbar aksara-header">'),name+" must retain existing header");
 }
 const commonHeader=shared.slice(shared.indexOf(".aksara-header{"),shared.indexOf("/* The Studio"));
 assert.ok(commonHeader.includes("border-radius:19px;"),"All topbars use Studio's curved glass edge");
 assert.ok(shared.includes("border-radius:17px;"),"Mobile topbars match Studio's curved corners");
 assert.ok(shared.includes(".aksara-header::after{content:none;display:none}"),"Gold underline is gone");
 assert.ok(shared.includes(".shell > .aksara-header{margin-block-start:10px}"),
  "Chat and Novel float with the same top spacing as Studio");
 assert.ok(!shared.includes("border-bottom:1px solid rgba(237,196,131"),
  "The old golden bottom border must not return");
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
test("Katalog curated masih guna pautan buku selamat dan simpanan setempat",()=>{
 assert.match(page,/const allowed=u=>/);
 assert.match(page,/p\.protocol==="https:"/);
 assert.match(page,/localStorage/);
 assert.match(page,/noopener noreferrer/);
 assert.doesNotMatch(page,/fetchArchive|gutendex\.com|copyright=false|archiveBooks/);
});

test("Navigasi Novel melalui Portal masuk ke katalog, Karya ke pembaca",()=>{
 assert.match(bilik,/<a class="feature-hub-item" id="featureLibrary" href="perpustakaan-aksara\.html">/);
 assert.match(bilik,/<span>PORTAL<\/span><svg/);
 assert.doesNotMatch(bilik,/class="nav-link aksara-nav-link" href="perpustakaan-aksara\.html"/);
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
 assert.ok( /perpustakaan-aksara\.css\?v=\d+/.test(page));
});


test("Novel catalog opens immediately beneath shared header without the old introduction",()=>{
 assert.match(page,/<main>\s*<h1 class="sr">Katalog novel AKSARA<\/h1>\s*<section class="collection" id="koleksi"/);
 for(const removed of ["AKSARA / PERPUSTAKAAN NOVEL","DUNIA DALAM","Novel dan sastera falsafah pilihan.","Sesebuah cerita mungkin tamat"]){
  assert.ok(!page.includes(removed),"Removed introductory prose must stay absent: "+removed);
 }
 assert.doesNotMatch(page,/class="intro"/);
 assert.match(page,/<header class="aksara-header">/);
 assert.match(page,/<span class="aksara-name">AKSARA Novel<\/span>/);
 assert.match(css,/\.collection\{padding:18px 0 40px\}/);
 assert.match(css,/@media\(max-width:690px\)[^\n]+\.collection\{padding:14px 0 32px\}/);
 assert.doesNotMatch(css,/\.intro(?:\{|>)/);
 assert.doesNotMatch(page,/id="archiveBooks"/);
});


test("Archive and footer removal leaves only curated books and no dead hooks",()=>{
 assert.doesNotMatch(page,/<section class="archive"|<footer\b|ARKIB TERBUKA|Teroka katalog dunia|Ribuan karya untuk diteroka/);
 assert.doesNotMatch(page,/id="explore"|id="more"|id="archiveStatus"|archiveNext|archiveLoaded|archiveEntries|renderArchiveBookmarks|fetchArchive|gutendex\.com/);
 assert.doesNotMatch(css,/\.archive(?:\{|[- >.])|\.more\{|footer\{/);
 assert.match(page,/<main>\s*<h1 class="sr">Katalog novel AKSARA<\/h1>\s*<section class="collection"/);
 assert.match(page,/DATA\.map\(b=>bookCard\(b\)\)/);
 assert.match(page,/persist\(\);render\(\)/);
 assert.match(css,/\.collection\{padding:18px 0 40px\}/);
});
