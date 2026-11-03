"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs");
const Large=require("../bilik-antara-large-media.js");
const read=path=>fs.readFileSync(path,"utf8");
test("64 MB photo and 128 MB video raw limits are independent of Netlify request budget",()=>{
 assert.equal(Large.MAX_IMAGE_SOURCE_BYTES,64000000);
 assert.equal(Large.MAX_VIDEO_SOURCE_BYTES,128000000);
 for(const type of ["image/jpeg","image/png","image/webp","image/gif"]){
  assert.equal(Large.acceptedSource(type,64000000),true);
  assert.equal(Large.acceptedSource(type,64000001),false);
 }
 for(const type of ["video/mp4","video/webm"]){
  assert.equal(Large.acceptedSource(type,128000000),true);
  assert.equal(Large.acceptedSource(type,128000001),false);
 }
 assert.equal(Large.acceptedSource("application/x-msdownload",128),false);
 assert.equal(Large.acceptedSource("video/mp4",0),false);
 assert.equal(Large.acceptedSource("video/mp4",Infinity),false);
 assert.ok(Large.MAX_FRAME_BUDGET<3850000);
});
test("sampling positions are bounded and representative, with short video fallback",()=>{
 assert.deepEqual(Large.framePositions(8).length,4);
 assert.deepEqual(Large.framePositions(1.5).length,2);
 assert.deepEqual(Large.framePositions(0),[]);
 assert.deepEqual(Large.framePositions(Infinity),[]);
 assert.ok(Large.framePositions(30).every((x,i,a)=>x>=0&&x<30&&(i===0||x>a[i-1])));
});
test("128 MB source can become four small JPEG frames with truthful visual-only metadata",async()=>{
 const oldDoc=global.document,oldCreate=URL.createObjectURL,oldRevoke=URL.revokeObjectURL;
 let revoked=0,progress=[];
 class FakeVideo extends EventTarget{
  constructor(){super();this.type="video";this.readyState=0;this.videoWidth=1280;this.videoHeight=720;this.duration=10;this.time=0;}
  set currentTime(value){this.time=value;this.readyState=3;queueMicrotask(()=>this.dispatchEvent(new Event("seeked")));}
  get currentTime(){return this.time;}
  load(){this.readyState=3;queueMicrotask(()=>this.dispatchEvent(new Event("loadedmetadata")));}
  pause(){} removeAttribute(){}
 }
 const video=new FakeVideo();
 global.document={createElement:type=>type==="video"?video:{
  width:0,height:0,getContext:()=>({drawImage(){}}),
  toBlob:cb=>cb(new Blob([new Uint8Array(36000)],{type:"image/jpeg"}))
 }};
 URL.createObjectURL=()=>"blob:fake";URL.revokeObjectURL=()=>{revoked++;};
 try{
  const result=await Large.sampleVideo({type:"video/mp4",size:128000000},{budget:300000,onProgress:p=>progress.push(p)});
  assert.equal(result.frames.length,4);
  assert.equal(result.totalBytes,144000);
  assert.equal(result.visualOnly,true);
  assert.equal(result.rawUploaded,false);
  assert.equal(result.audioAnalyzed,false);
  assert.deepEqual(progress,[25,50,75,100]);
  assert.equal(revoked,1);
 }finally{
  if(oldDoc===undefined)delete global.document;else global.document=oldDoc;
  URL.createObjectURL=oldCreate;URL.revokeObjectURL=oldRevoke;
 }
});
test("attachment pipeline stages sampled JPEGs without uploading original video",()=>{
 const client=read("bilik-antara-attachments.js"),html=read("bilik-antara.html");
 assert.match(client,/Large\.sampleVideo\(file/);
 assert.match(client,/mediaList\.push\(/);
 assert.match(client,/flatMap\(f=>f\.mediaList\|\|\[f\.media\]\)/);
 assert.match(client,/fileMeta\.rawUploaded=false/);
 assert.match(client,/fileMeta\.audioAnalyzed=false/);
 assert.match(client,/Pemprosesan dibatalkan/);
 assert.match(client,/videoSampled:true/);
 assert.match(client,/mediaBytes\+result\.totalBytes>MAX_MEDIA_BYTES/);
 assert.match(client,/MAX_MEDIA_BYTES=3850000/);
 assert.match(html,/bilik-antara-large-media\.js\?v=1/);
 assert.ok(html.indexOf("bilik-antara-large-media.js")<html.indexOf("bilik-antara-attachments.js"));
 assert.match(html,/attachmentRecordStatus[^>]*hidden><\/p>/);
 assert.doesNotMatch(html,/Teks sehingga 1 juta aksara · gambar besar dimampatkan/);
 assert.match(html,/JPG, PNG, WebP, GIF · 64 MB/);
 assert.match(html,/MP4, WebM · 128 MB/);
 assert.ok(html.length<80000);
});
test("code dialog remains consent-based and removes only explanatory footnote",()=>{
 const html=read("bilik-antara.html"),code=read("bilik-antara-code-agent.js"),menu=read("bilik-antara-code-status.js");
 assert.doesNotMatch(code,/Tab ini sahaja\. A\.I\. boleh menjalankan satu blok kod/);
 assert.match(code,/id="codeAiExecutionAllowed"/);
 assert.match(code,/id="codeAiExecutionState"/);
 assert.match(menu,/#codeRuntimeList\{flex:1 1 auto/);
 assert.match(html,/code-agent\.js\?v=4/);
});
