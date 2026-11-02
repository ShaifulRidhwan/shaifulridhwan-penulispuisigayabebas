"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const html=fs.readFileSync("bilik-antara.html","utf8");
const css=fs.readFileSync("bilik-antara.css","utf8");
test("Bilik uses static WebP with no video/loop downloaded or autoplay controller",()=>{
 assert.match(html,/aksara-celestial-static\.webp\?v=1/);
 assert.doesNotMatch(html,/<video\b|id="aksaraAmbientVideo"|aksara-bilik-antara-ambient\.mp4/);
 assert.doesNotMatch(html,/bilik-antara-video\.(?:css|js)/);
 assert.match(css,/\.world-scene \.world-art\{/);
 assert.match(css,/animation:none!important/);
 assert.match(css,/\.world-scene \.world-haze,\.world-scene \.world-embers,\.world-scene \.world-video\{display:none!important\}/);
});
test("Same artwork serves Studio and Novel without running an ambient MP4",()=>{
 const studio=fs.readFileSync("studio-antara.css","utf8");
 const library=fs.readFileSync("perpustakaan-aksara.css","utf8");
 const reader=fs.readFileSync("antara-cahaya-dan-gelap.html","utf8");
 for(const item of [studio,library,reader])assert.match(item,/aksara-celestial-static\.webp\?v=1/);
 for(const page of ["studio-antara.html","perpustakaan-aksara.html","antara-cahaya-dan-gelap.html"])
  assert.doesNotMatch(fs.readFileSync(page,"utf8"),/id="aksaraAmbientVideo"/);
 const bytes=fs.statSync("aksara-celestial-static.webp");
 assert.ok(bytes.size>1000&&bytes.size<100000);
});
