"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const page=fs.readFileSync(path.join(root,"perpustakaan-aksara.html"),"utf8");
const bilik=fs.readFileSync(path.join(root,"bilik-antara.html"),"utf8");
const scripts=[...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
test("Katalog mempunyai metadata dan pautan karya utama",()=>{
 assert.match(page,/<html lang="ms">/);
 assert.match(page,/name="viewport"/);
 assert.match(page,/assets\/novel\/cover-01\.jpg/);
 assert.match(page,/href="antara-cahaya-dan-gelap\.html"/);
 assert.match(page,/id="books"/);
 assert.match(page,/id="archiveBooks"/);
});
test("Kod JavaScript katalog boleh dihuraikan",()=>{
 assert.ok(scripts.length>0);
 scripts.forEach((script,i)=>assert.doesNotThrow(()=>new vm.Script(script,{filename:"catalog-inline-"+i+".js"})));
});
test("Koleksi pilihan mengandungi penulis dan bahasa sasaran",()=>{
 const source=scripts.join("\n");
 const m=source.match(/const DATA=(\[[\s\S]*?\]);\s*const key=/);
 assert.ok(m,"Data katalog tidak ditemui");
 const books=vm.runInNewContext(m[1]);
 assert.ok(books.length>=15);
 assert.ok(books.some(b=>b[2]==="Franz Kafka"));
 assert.ok(books.some(b=>b[2]==="Fyodor Dostoevsky"));
 assert.ok(books.some(b=>b[2]==="Albert Camus"));
 assert.ok(books.some(b=>b[3]==="ms"));
 assert.ok(books.some(b=>b[3]==="id"));
 for(const book of books){
  assert.equal(book.length,10,"Setiap rekod mempunyai sepuluh medan");
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
