"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const shell=fs.readFileSync("antara-cahaya-dan-gelap.html","utf8");
const reader=fs.readFileSync("assets/novel/pembaca.html","utf8");
const redirects=fs.readFileSync("_redirects","utf8");
const sitemap=fs.readFileSync("sitemap.xml","utf8");
const headers=fs.readFileSync("_headers","utf8");
test("One canonical novel URL and no duplicate manuscript in cover",()=>{
 assert.match(shell,/<h1>Antara<em>Cahaya/);
 assert.match(shell,/rel="canonical" href="https:\/\/shaifulridhwan-penulispuisigayabebas\.netlify\.app\/antara-cahaya-dan-gelap\.html"/);
 assert.match(shell,/id="cover"/);
 assert.match(shell,/id="startReading"/);
 assert.match(shell,/id="resumeReading"/);
 assert.match(shell,/id="readerHost" hidden/);
 assert.match(shell,/frame\.src="assets\/novel\/pembaca\.html"/);
 assert.doesNotMatch(shell,/<section\s+class="book-section"/);
 assert.doesNotMatch(shell,/SECTION_IMAGES\s*=/);
 assert.doesNotMatch(shell,/antara-cahaya-dan-gelap-baca\.html/);
 assert.ok(shell.length<80000);
});
test("Latest manuscript retained without modifying its engine",()=>{
 assert.equal((reader.match(/<section\s+class="book-section" data-section="\d+"/g)||[]).length,8);
 for(const id of ["DI ANTARA","AKAL","IMAN","CINTA","KEBEBASAN","MASA","YANG ADA DI ANTARA","DI SITULAH AKU HIDUP"])assert.ok(reader.includes(id),id);
 assert.match(reader,/function enterBook\(page\)/);
 assert.match(reader,/id="backToCover"/);
 assert.match(reader,/acg-page/);
 assert.ok(reader.length<250000);
});
test("Old URL redirects and the internal source is excluded from indexing",()=>{
 assert.match(redirects,/^\/antara-cahaya-dan-gelap-baca\.html \/antara-cahaya-dan-gelap\.html 301!/);
 assert.doesNotMatch(sitemap,/antara-cahaya-dan-gelap-baca\.html/);
 assert.match(headers,/\/assets\/novel\/pembaca\.html\s+X-Robots-Tag: noindex, follow/);
 assert.equal(fs.existsSync("antara-cahaya-dan-gelap-baca.html"),false);
});
test("Reader embedded lazily with navigation safeguards; script parses",()=>{
 assert.match(shell,/frame\.addEventListener\("load",wireFrame\)/);
 assert.match(shell,/stopImmediatePropagation/);
 assert.match(shell,/win\.enterBook\(savedPage\(\)\)/);
 const scripts=[...shell.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
 const executable=scripts.filter(m=>!m[0].includes("application/ld+json"));
 assert.equal(executable.length,1);
 assert.doesNotThrow(()=>new (require("node:vm").Script)(executable[0][1]));
});
