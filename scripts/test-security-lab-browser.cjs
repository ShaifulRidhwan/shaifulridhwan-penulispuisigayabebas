"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {chromium}=require("playwright");
const BASE=process.env.AUDIT_BASE||"http://127.0.0.1:4177";
const OUT=path.join(process.cwd(),"browser-audit-artifacts");
fs.mkdirSync(OUT,{recursive:true});
const fakeCI={schemaVersion:1,source:"github-actions",generatedAt:"2026-11-08T12:00:00Z",
  commit:"0123456789abcdef",runId:"123456789",
  aggregate:{critical:0,high:2,medium:1,low:0,total:3},
  scanners:{trivy:{state:"complete",counts:{critical:0,high:1,medium:0,low:0,total:1}},
    semgrep:{state:"complete",counts:{critical:0,high:1,medium:1,low:0,total:2}}},
  status:"findings_detected"};
const fakeWeb={ok:true,schemaVersion:3,scope:"owned-origin-only",mode:"passive-single-request",
  scoreModel:"weighted-http-configuration-indicators-not-penetration-test",path:"/bilik-antara.html",
  status:200,checkedAt:"2026-11-08T12:00:00Z",passed:1,total:2,score:62,warnings:1,
  checks:[{id:"https",group:"Rangkaian",risk:"asas",weight:1,passed:true,advice:"HTTPS"},
    {id:"csp",group:"Polisi",risk:"tinggi",weight:5,passed:false,advice:"Perlu CSP"}],
  observations:[{title:"Cookie",value:"Tiada Set-Cookie"}],cspSummary:"Belum dikonfigurasi"};
async function visit(browser,label,viewport){
  const context=await browser.newContext({viewport,deviceScaleFactor:1});
  const page=await context.newPage(),errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/raw.githubusercontent.com/**/security-reports/latest.json",r=>r.fulfill({
    status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},
    body:JSON.stringify(fakeCI)}));
  await page.route("**/.netlify/functions/aksara-security-audit?*",r=>r.fulfill({
    status:200,contentType:"application/json",body:JSON.stringify(fakeWeb)}));
  try{
    await page.goto(BASE+"/security-lab.html",{waitUntil:"domcontentloaded",timeout:30000});
    await page.locator("#tab-overview").waitFor();
    const state=await page.evaluate(()=>{
      const glass=getComputedStyle(document.querySelector(".ak-glass"));
      return {width:window.innerWidth,documentWidth:document.documentElement.scrollWidth,
        blur:glass.backdropFilter||glass.webkitBackdropFilter,
        bg:getComputedStyle(document.querySelector(".ak-world-image")).backgroundImage,
        tabs:document.querySelectorAll('[role="tab"]').length};
    });
    assert.ok(state.documentWidth<=state.width+5,label+" overflow "+JSON.stringify(state));
    assert.match(state.blur,/blur\(24px\)/);
    assert.match(state.bg,/aksara-cinematic-(desktop|mobile)\.webp/);
    assert.equal(state.tabs,4);
    await page.locator("#tab-overview").focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.locator("#panel-web").isVisible(),true,label+" keyboard tab");
    await page.locator("#runAudit").click();
    await page.locator("#scoreText").getByText("62").waitFor();
    assert.match(await page.locator("#auditMeta").innerText(),/perlu perhatian/);
    await page.locator("#tab-code").click();
    await page.locator("#codeInput").fill("eval(userInput)");
    await page.locator("#scanCode").click();
    assert.match(await page.locator("#codeSummary").innerText(),/1 penemuan/);
    await page.locator("#tab-reports").click();
    await page.locator("#ciStatus").getByText(/Penemuan keselamatan dikesan/).waitFor({timeout:6000});
    assert.equal(await page.locator(".ak-ci-stat").count(),4);
    assert.equal(await page.locator("#saveAuditHistory").isChecked(),false);
    await page.locator("#analyzeSecurity").click();
    assert.ok(await page.locator(".ak-analyst-item").count()>=1);
    assert.deepEqual(errors,[],label+" browser console");
    await page.screenshot({path:path.join(OUT,"security-lab-"+label+".png"),fullPage:true});
    console.log(label+" security-lab UI audit passed");
  }finally{await context.close();}
}
(async()=>{
  const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  try{
    await visit(browser,"desktop",{width:1440,height:900});
    await visit(browser,"mobile",{width:390,height:844});
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
