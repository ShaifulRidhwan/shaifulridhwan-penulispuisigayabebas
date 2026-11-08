/* AKSARA Security Lab: own-origin read-only dashboard. */
(function(){
"use strict";
const select=document.getElementById("page"),button=document.getElementById("runAudit");
const summary=document.getElementById("summary"),results=document.getElementById("results");
if(!select||!button||!summary||!results)return;
const labels={https:"HTTPS",hsts:"HTTP Strict Transport Security",csp:"Content Security Policy",nosniff:"X-Content-Type-Options",referrer:"Referrer-Policy",framing:"Anti-framing",permissions:"Permissions-Policy"};
function clear(){while(results.firstChild)results.firstChild.remove();}
function render(checks){
  clear();
  checks.forEach(function(check){
    if(!Object.hasOwn(labels,check.id)||typeof check.passed!=="boolean")return;
    const item=document.createElement("div");item.className="check";
    const mark=document.createElement("span");mark.className="mark "+(check.passed?"pass":"warn");
    mark.textContent=check.passed?"✓":"!";
    const wrapper=document.createElement("div");
    const name=document.createElement("strong");name.textContent=labels[check.id];
    const advice=document.createElement("small");advice.textContent=String(check.advice||"");
    wrapper.append(name,advice);item.append(mark,wrapper);results.append(item);
  });
}
button.addEventListener("click",async function(){
  if(button.disabled)return;
  button.disabled=true;summary.textContent="Menyemak header halaman projek...";clear();
  const abort=new AbortController(),timer=setTimeout(function(){abort.abort();},9000);
  try{
    const resp=await fetch("/.netlify/functions/aksara-security-audit?path="+encodeURIComponent(select.value),{method:"GET",credentials:"same-origin",signal:abort.signal,cache:"no-store"});
    const data=await resp.json();
    if(!resp.ok||!data.ok||!Array.isArray(data.checks))throw Error(data.error||"Respons audit tidak sah.");
    summary.textContent="HTTP "+data.status+" · "+data.passed+"/"+data.total+" pemeriksaan lulus · "+new Date(data.checkedAt).toLocaleString("ms-MY");
    render(data.checks);
  }catch(err){summary.textContent="Audit gagal: "+(err.name==="AbortError"?"permintaan tamat masa.":String(err.message||"Ralat tidak diketahui."));}
  finally{clearTimeout(timer);button.disabled=false;}
});
})();