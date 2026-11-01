import test from "node:test";
import assert from "node:assert/strict";
import {ownedPageEvidence} from "./src/owned-page-evidence.mjs";

const host="https://aksara-apps.mshaifulridhwan.workers.dev";
const request=new Request(host+"/.netlify/functions/bilik-antara",{method:"POST"});
function assets(){
 const calls=[];
 const env={ASSETS:{fetch:async req=>{
   calls.push(new URL(req.url).pathname);
   return new Response('<!doctype html><html><head><title>AKSARA A.I.</title><meta name="description" content="Bilik Antara"></head><body><script>ignore this private fake token</script><h1>Bilik Antara</h1><p>Chat teks dan Voice Chat.</p></body></html>',{headers:{"content-type":"text/html"}});
 }}};
 return {env,calls};
}
test("reads only public bundled page HTML for owned Worker URL",async()=>{
 const {env,calls}=assets();
 const page=await ownedPageEvidence(request,env,"review web ni "+host+"/bilik-antara.html");
 assert.deepEqual(calls,["/bilik-antara.html"]);
 assert.equal(page.url,host+"/bilik-antara.html");
 assert.match(page.text,/Bilik Antara/);
 assert.match(page.text,/HTML statik/);
 assert.doesNotMatch(page.text,/private fake token/);
});
test("legacy Netlify homepage uses allowlisted origin and not bundled Worker asset",async()=>{
 const {env,calls}=assets();
 const original=globalThis.fetch;
 let remote=[];
 globalThis.fetch=async url=>{remote.push(String(url));return new Response("<html><title>AKSARA</title><body>Laman puisi</body></html>",{headers:{"content-type":"text/html"}});};
 try{
  const page=await ownedPageEvidence(request,env,"https://shaifulridhwan-penulispuisigayabebas.netlify.app/");
  assert.ok(page);
  assert.deepEqual(calls,[]);
  assert.deepEqual(remote,["https://shaifulridhwan-penulispuisigayabebas.netlify.app/index.html"]);
 }finally{globalThis.fetch=original;}
});
test("external URLs, private hosts, query credentials and other paths never trigger fetch",async()=>{
 const {env,calls}=assets();
 for(const url of ["https://example.com/","https://localhost/bilik-antara.html","https://127.0.0.1/bilik-antara.html",
   "https://evil.example/","https://aksara-apps.mshaifulridhwan.workers.dev/api/aksara-health",
   "https://aksara-apps.mshaifulridhwan.workers.dev/bilik-antara.html?token=abc",
   "https://test@aksara-apps.mshaifulridhwan.workers.dev/bilik-antara.html"]){
   assert.equal(await ownedPageEvidence(request,env,"review "+url),null,url);
 }
 assert.deepEqual(calls,[]);
});
test("unavailable or over-limit pages fail without claiming that site was checked",async()=>{
 const env={ASSETS:{fetch:async()=>new Response("missing",{status:404,headers:{"content-type":"text/html"}})}};
 assert.equal(await ownedPageEvidence(request,env,host+"/bilik-antara.html"),null);
 const large={ASSETS:{fetch:async()=>new Response("a".repeat(500001),{headers:{"content-type":"text/html"}})}};
 assert.equal(await ownedPageEvidence(request,large,host+"/bilik-antara.html"),null);
});
