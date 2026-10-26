"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const html=fs.readFileSync("studio-antara.html","utf8");
const css=fs.readFileSync("studio-antara.css","utf8");
const js=fs.readFileSync("studio-antara.js","utf8");
const image=fs.readFileSync("studio-imej-beta.js","utf8");
const chat=fs.readFileSync("bilik-antara.html","utf8");
const suite=fs.readFileSync("bilik-antara-suite.js","utf8");

test("Studio is linked from Bilik Antara and transferred drafts remain on same device",()=>{
 assert.match(chat,/href="studio-antara\.html"/);
 assert.match(suite,/bilik-antara-studio-transfer-v1/);
 assert.match(js,/sessionStorage\.getItem\("bilik-antara-studio-transfer-v1"\)/);
 assert.match(js,/sessionStorage\.removeItem\("bilik-antara-studio-transfer-v1"\)/);
});
test("all first-group tools and exports exist as editable UI, no payment",()=>{
 for(const id of ["emailBody","emailSubject","emailTo","emailAI","emailEml","emailOpen",
  "docTitle","docBody","docPdf","docWord","docHtml",
  "tableData","tableCsv","tableJson","chartData","chartSvg","chartPng",
  "posterTitle","posterBody","posterPng","posterSize"]){
  assert.match(html,new RegExp('id="'+id+'"'),id);
 }
 assert.match(js,/window\.print\(\)/);
 assert.match(js,/docx@9\.11\.0\/\+esm/);
 assert.match(js,/message\/rfc822/);
 assert.match(js,/text\/csv/);
 assert.match(js,/image\/svg\+xml/);
 assert.match(js,/toBlob/);
 assert.match(css,/@media print/);
 assert.doesNotMatch(js,/apiKey\s*=|STRIPE|paymentIntent|paypal/i);
});
test("image generation BETA TEST is conspicuous and consent gated",()=>{
 assert.match(html,/Imej AI <span class="beta">BETA TEST<\/span>/);
 assert.match(html,/BETA TEST/g);
 assert.match(html,/id="imageConsent"/);
 assert.match(html,/id="loadImageModel"/);
 assert.match(html,/id="generateImage"/);
 assert.match(image,/if\(!consent\(\)\)/);
 assert.match(image,/navigator\.gpu\.requestAdapter/);
 assert.match(image,/window\.isSecureContext/);
 assert.match(image,/web-txt2img@0\.3\.1/);
 assert.match(image,/client\.load\("sd-turbo"/);
 assert.match(image,/client\.generate\(/);
 assert.match(image,/result\.blob instanceof Blob/);
 assert.match(image,/download\.disabled=true/);
 assert.doesNotMatch(image,/placehold|Math\.random\(\).*canvas|generativelanguage\.googleapis\.com/i);
});
test("tools operate in browser and never silently send email or image prompts to backend",()=>{
 assert.match(js,/window\.location\.href=href/);
 assert.doesNotMatch(js,/gmail\.send|smtp|sendEmail\(/i);
 assert.match(js,/fetch\("\/\.netlify\/functions\/bilik-antara"/);
 assert.doesNotMatch(image,/fetch\("\/\.netlify|GEMINI_API_KEY/);
 assert.match(html,/Tiada e-mel dihantar secara automatik/);
 assert.match(html,/Model hanya dimuat selepas klik dan persetujuan/);
});
test("CSV parser handles escaped comma, quotes and newlines",()=>{
 const ids=["sectionTitle","previewKind","studioPreview","studioStatus","studioImageOutput",
 "emailName","emailTo","emailSubject","emailBody","docTemplate","docTitle","docBody","tableTitle",
 "tableData","chartTitle","chartType","chartData","posterTitle","posterBody","posterSize","posterStyle"];
 const handlers={},nodes=new Map();
 function element(tag="div"){
  return {tagName:tag,children:[],dataset:{},hidden:false,style:{},value:"",textContent:"",
   appendChild(ch){this.children.push(ch);return ch;},append(...args){this.children.push(...args);},
   replaceChildren(...args){this.children=[...args];},setAttribute(){},addEventListener(name,fn){handlers[this.tagName+":"+name]=fn;},
   classList:{toggle(){}},getContext(){return {createLinearGradient(){return {addColorStop(){}};},
     createRadialGradient(){return {addColorStop(){}};},
     fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(){},
     measureText(t){return {width:String(t).length*10}}};}};
 }
 for(const id of ids)nodes.set(id,element(id));
 nodes.get("tableData").value='Name,Quote\n"Ali, Ahmad","Dia kata ""hai"""\nBaru,5';
 nodes.get("chartData").value="Bulan,Nilai\nJan,10\nFeb,12";
 nodes.get("chartType").value="bar";
 const tabs=["email","document","table","chart","poster","image"].map(name=>{
  const n=element("tab");n.dataset.tab=name;return n;
 });
 const panels=tabs.map(t=>{const n=element("panel");n.id="editor-"+t.dataset.tab;return n});
 const doc={getElementById(id){return nodes.get(id)||element(id)},
 createElement:element,createElementNS(_ns,tag){return element(tag);},
 querySelectorAll(s){return s===".tab"?tabs:s===".panel"?panels:[]}};
 const fakeWindow={},fakeLocation={hash:""},fakeHistory={replaceState(){}};
 new Function("document","window","history","location","sessionStorage","navigator","URL","Blob","Image","XMLSerializer",js)(
  doc,fakeWindow,fakeHistory,fakeLocation,{getItem(){return null}},
  {},{createObjectURL(){return "blob:test"},revokeObjectURL(){}},
  Blob,class{},{});
 const rows=fakeWindow.StudioAntara.parseCSV(nodes.get("tableData").value);
 assert.equal(rows[1][0],"Ali, Ahmad");
 assert.equal(rows[1][1],'Dia kata "hai"');
 assert.equal(rows[2][0],"Baru");
 assert.equal(fakeWindow.StudioAntara.drawChart().tagName,"svg");
});
