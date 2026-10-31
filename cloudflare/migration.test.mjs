import {test} from "node:test";
import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
import path from "node:path";
const root=process.cwd();
const cf=p=>path.join(root,"cloudflare",p);
const text=p=>readFileSync(cf(p),"utf8");
test("Cloudflare build includes all three apps and preserves Netlify home separately",()=>{
 for(const p of ["bilik-antara.html","studio-antara.html","perpustakaan-aksara.html","antara-cahaya-dan-gelap.html","assets/novel/pembaca.html","assets/novel/cover-01.jpg","bilik-antara.css","studio-antara.css","perpustakaan-aksara.css"]){
  assert.ok(existsSync(cf("dist/"+p)),p);
 }
 assert.ok(!existsSync(cf("dist/index.html")),"Netlify main home MUST NOT be migrated");
 assert.ok(!existsSync(cf("dist/netlify/functions/bilik-antara.js")),"Server code MUST NOT be exposed as static asset");
 assert.ok(!existsSync(cf("dist/package.json")));
 for(const p of ["bilik-antara.html","studio-antara.html","perpustakaan-aksara.html"]){
  assert.match(text("dist/"+p),/data-cloudflare-preview="1"/,"Noindex preview missing "+p);
 }
 assert.match(text("dist/studio-antara.html"),/https:\/\/shaifulridhwan-penulispuisigayabebas\.netlify\.app\//);
});
test("Browser API paths remain intact for non-invasive migration",()=>{
 const browser=text("dist/studio-antara-cloud.js");
 assert.match(browser,/\.netlify\/functions\/studio-image/);
 assert.match(browser,/\.netlify\/functions\/studio-enhance/);
 assert.match(text("dist/bilik-antara.html"),/\.netlify\/functions\/bilik-antara/);
});
test("Wrangler only routes API paths through Worker and keeps no deploy-on-merge",()=>{
 const c=JSON.parse(text("wrangler.jsonc"));
 assert.equal(c.name,"aksara-apps");
 assert.equal(c.assets.binding,"ASSETS");
 assert.deepEqual(c.assets.run_worker_first,["/","/.netlify/functions/*"]);
 assert.ok(c.migrations.some(x=>x.new_sqlite_classes.includes("AksaraControl")));
 assert.equal(c.vars.AKSARA_SHARED_CHAT_BUDGET,"false");
 assert.ok(!existsSync(path.join(root,".github","workflows","cloudflare-auto-deploy.yml")));
});
test("Migration Worker defends same-origin API and has no public passthrough proxy",async()=>{
 const mod=await import("./src/index.mjs");
 assert.equal(typeof mod.default.fetch,"function");
 const request=new Request("https://apps.example.com/.netlify/functions/bilik-antara",{method:"POST",headers:{origin:"https://evil.example.com","content-type":"application/json"},body:JSON.stringify({question:"Hai"})});
 const r=await mod.default.fetch(request,{ASSETS:{fetch:()=>Response.json({})}},{});
 assert.equal(r.status,403);
 const home=await mod.default.fetch(new Request("https://apps.example.com/"),{ASSETS:{fetch:()=>Response.json({})}},{});
 assert.equal(home.status,302);
 assert.equal(home.headers.get("location"),"https://shaifulridhwan-penulispuisigayabebas.netlify.app/");
});
test("Durable quota is isolated from public path and no prompt is stored",()=>{
 const s=text("src/control.mjs");
 assert.match(s,/transactionSync/);
 assert.match(s,/INSERT OR IGNORE INTO daily/);
 assert.doesNotMatch(s,/INSERT INTO (?:prompts|transcripts|history|raw_ip)/i);
});
