'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {IDBFactory}=require('fake-indexeddb');
function history(){const indexedDB=new IDBFactory(),window={indexedDB};vm.runInNewContext(fs.readFileSync('studio-antara-history.js','utf8'),{window,indexedDB,Promise,Error});return window.StudioHistory;}
const meta=i=>({id:String(i),createdAt:i,settings:{prompt:'Imej '+i},promptUsed:'Imej '+i});
test('History stores actual blobs and thumbnails separately, and supports read/delete/clear',async()=>{
 const h=history(),blob=new Blob(['real binary image'],{type:'image/png'}),thumb=new Blob(['thumbnail']);await h.put(meta(1),blob,thumb);
 const rows=await h.list();assert.equal(rows.length,1);assert.equal(rows[0].id,'1');assert.equal(rows[0].blob,undefined);
 assert.equal(await (await h.get('1')).blob.text(),'real binary image');assert.equal((await h.get('1')).thumb,undefined);assert.equal(await (await h.getThumb('1')).thumb.text(),'thumbnail');
 await h.remove('1');assert.equal((await h.list()).length,0);assert.equal(await h.get('1'),undefined);
 await h.put(meta(2),blob,thumb);await h.clear();assert.equal((await h.list()).length,0);assert.equal(await h.getThumb('2'),undefined);
});
test('Only the newest 24 results survive; all associated full images are removed',async()=>{
 const h=history(),blob=new Blob(['tiny']);for(let i=0;i<30;i++)await h.put(meta(i),blob,blob);
 const rows=await h.list();assert.equal(rows.length,24);assert.equal(rows[0].id,'29');assert.equal(rows.at(-1).id,'6');assert.equal(await h.get('0'),undefined);
});
test('Byte budget evicts old full images before accepting new history entries',async()=>{
 const h=history(),blob=new Blob([new Uint8Array(3000000)]),thumb=new Blob(['small']);for(let i=0;i<12;i++)await h.put(meta(i),blob,thumb);
 const rows=await h.list();assert.equal(rows.length,10);assert.ok(rows.reduce((n,r)=>n+r.bytes,0)<=h.MAX_BYTES);assert.equal(await h.get('0'),undefined);
});
test('Oversized history rejects without altering previously saved output',async()=>{
 const h=history();await h.put(meta(1),new Blob(['saved']),new Blob(['thumb']));await assert.rejects(h.put(meta(2),new Blob([new Uint8Array(3500001)]),new Blob(['thumb'])));assert.equal((await h.list()).length,1);
});
