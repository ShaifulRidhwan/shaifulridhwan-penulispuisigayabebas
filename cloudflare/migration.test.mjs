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

test("Worker separates health from inference budget and reuses existing Chat handler",async()=>{
 const mod=await import("./src/index.mjs"),calls=[];
 const stub={fetch:async(_u,opts)=>{
  const payload=JSON.parse(opts.body);calls.push(payload);
  return Response.json({ok:true});
 }};
 const env={AKSARA_RATE_SALT:"this-is-a-private-placeholder-long-enough-for-tests",
  AKSARA_CONTROL:{idFromName:()=>({}),get:()=>stub},
  ASSETS:{fetch:()=>Response.json({})}};
 const addr="https://apps.example.com/.netlify/functions/bilik-antara";
 const make=payload=>new Request(addr,{method:"POST",
  headers:{origin:"https://apps.example.com","content-type":"application/json",
   "cf-connecting-ip":"192.0.2.8"},
  body:JSON.stringify(payload)});
 const health=await mod.default.fetch(make({probe:true}),env,{});
 assert.equal(health.status,503,"Without model API keys, backend should report unavailable");
 assert.equal(calls.at(-1).kind,"health","Health must not spend AI budget");
 const actual=await mod.default.fetch(make({question:"Apakah graviti?"}),env,{});
 assert.equal(calls.at(-1).kind,"chat","A real request must pass through daily budget");
 assert.ok([200,502,503].includes(actual.status));
 assert.ok(!JSON.stringify(calls).includes("graviti"),"DO must never receive the prompt");
});
test("Cloudflare previews have working relative Studio hints without taking readers to Netlify Studio",()=>{
 assert.match(text("dist/bilik-antara.html"),/link\(area,"Buka Studio Antara","\/studio-antara.html"\)/);
 assert.match(text("dist/assets/novel/pembaca.html"),/shaifulridhwan-penulispuisigayabebas\.netlify\.app\/"/);
});

test("Studio and Perkemas A.I validate the actual Cloudflare origin",async()=>{
 const worker=(await import("./src/index.mjs")).default;
 const base="https://apps.example.com";
 const env={ASSETS:{fetch:()=>Response.json({})}};
 for(const endpoint of ["studio-image","studio-enhance"]){
  const request=new Request(base+"/.netlify/functions/"+endpoint,{
   method:"POST",headers:{"origin":base,"content-type":"application/json"},
   body:JSON.stringify({prompt:"a"})
  });
  const response=await worker.fetch(request,env,{});
  assert.equal(response.status,400,"Valid origin must pass handler input check: "+endpoint);
  const invalid=new Request(base+"/.netlify/functions/"+endpoint,{
   method:"POST",headers:{"origin":"https://wrong.example","content-type":"application/json"},
   body:JSON.stringify({prompt:"a"})
  });
  assert.equal((await worker.fetch(invalid,env,{})).status,403);
 }
});
