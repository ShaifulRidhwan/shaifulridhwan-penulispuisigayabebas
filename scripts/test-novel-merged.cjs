"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const html=fs.readFileSync("antara-cahaya-dan-gelap.html","utf8");
const redirects=fs.readFileSync("_redirects","utf8");
const sitemap=fs.readFileSync("sitemap.xml","utf8");
test("Single canonical page, eight manuscript sections, one book engine",()=>{
 assert.equal((html.match(/<h1\\b/g)||[]).length,1);
 assert.equal((html.match(/<h2 class="book-section-title">/g)||[]).length,8);
 assert.equal((html.match(/function paginate\\(/g)||[]).length,1);
 assert.match(html,/rel="canonical"\\/>/);
 assert.match(html,/rel="canonical"\\/>|rel="canonical"/);
 assert.match(html,/antara-cahaya-dan-gelap\\.html/);
 assert.doesNotMatch(html,/rel="canonical"[^>]*antara-cahaya-dan-gelap-baca\\.html/);
});
test("Cover buttons open the same reader and resuming preserves progress",()=>{
 assert.match(html,/id="cover"/);
 assert.match(html,/id="startReading"[^>]+href="#baca"/);
 assert.match(html,/id="resumeBtn"[^>]+href="#baca"/);
 assert.match(html,/if\\(cover\\)cover\\.hidden=true/);
 assert.match(html,/get\\('acg-page'\\)|getItem\\('acg-page'\\)/);
 assert.match(html,/enterBook\\(savedPage\\)/);
 assert.match(html,/if\\(backToCover\\)/);
});
test("Illustrations are external and existing creative text stays intact",()=>{
 assert.doesNotMatch(html,/data:image\\/(jpeg|webp|png);base64,/);
 assert.equal((html.match(/assets\\/novel\\/ilustrasi-\\d+\\.jpg/g)||[]).length,24);
 for(let i=1;i<=24;i++)assert.ok(fs.existsSync("assets/novel/ilustrasi-"+String(i).padStart(2,"0")+".jpg"));
 assert.ok(fs.existsSync("assets/novel/kulit-novel.jpg"));
 assert.match(html,/Aku masih ingat bau kapur di dinding kelas itu/);
});
test("No competing SEO routes",()=>{
 assert.match(redirects,/\\/antara-cahaya-dan-gelap-baca\\.html\\s+\\/antara-cahaya-dan-gelap\\.html\\s+301!/);
 assert.doesNotMatch(sitemap,/antara-cahaya-dan-gelap-baca\\.html/);
 assert.match(sitemap,/antara-cahaya-dan-gelap\\.html/);
});
