/* Local-only image history. Full images live as Blobs in IndexedDB, not localStorage. */
(function(root){
'use strict';
const LIMIT=24,MAX_BYTES=30*1024*1024;let dbPromise;
function db(){if(!root.indexedDB)return Promise.reject(Error('Pelayar tak menyokong sejarah setempat.'));if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
 const req=indexedDB.open('studio-antara-v2',1);
 req.onupgradeneeded=()=>{const db=req.result;db.createObjectStore('results',{keyPath:'id'});db.createObjectStore('images',{keyPath:'id'});db.createObjectStore('thumbs',{keyPath:'id'});};
 req.onsuccess=()=>{req.result.onversionchange=()=>{req.result.close();dbPromise=null;};resolve(req.result);};
 req.onerror=()=>{dbPromise=null;reject(req.error);};req.onblocked=()=>{dbPromise=null;reject(Error('Tutup tab Studio lama untuk buka sejarah.'));};
 });return dbPromise;}
function request(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function complete(tx){return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Storan dibatalkan.'));});}
async function list(){const d=await db();return (await request(d.transaction('results').objectStore('results').getAll())).sort((a,b)=>b.createdAt-a.createdAt);}
async function get(id){const d=await db();return request(d.transaction('images').objectStore('images').get(id));}
async function getThumb(id){const d=await db();return request(d.transaction('thumbs').objectStore('thumbs').get(id));}
async function put(meta,blob,thumb){
 if(blob.size>3500000||blob.size+thumb.size>MAX_BYTES)throw Error('Imej terlalu besar untuk sejarah.');
 const d=await db(),tx=d.transaction(['results','images','thumbs'],'readwrite'),done=complete(tx),rows=tx.objectStore('results'),images=tx.objectStore('images');
 const req=rows.getAll();req.onsuccess=()=>{
  const all=req.result.filter(x=>x.id!==meta.id).sort((a,b)=>a.createdAt-b.createdAt);let total=all.reduce((n,x)=>n+x.bytes,0)+blob.size+thumb.size;
  while(all.length>=LIMIT||total>MAX_BYTES){const old=all.shift();if(!old)break;total-=old.bytes;rows.delete(old.id);images.delete(old.id);tx.objectStore('thumbs').delete(old.id);}
  rows.put({...meta,bytes:blob.size+thumb.size});images.put({id:meta.id,blob});tx.objectStore('thumbs').put({id:meta.id,thumb});
 };
 await done;
}
async function remove(id){const d=await db(),tx=d.transaction(['results','images','thumbs'],'readwrite'),done=complete(tx);tx.objectStore('results').delete(id);tx.objectStore('images').delete(id);tx.objectStore('thumbs').delete(id);await done;}
async function clear(){const d=await db(),tx=d.transaction(['results','images','thumbs'],'readwrite'),done=complete(tx);tx.objectStore('results').clear();tx.objectStore('images').clear();tx.objectStore('thumbs').clear();await done;}
root.StudioHistory={list,get,getThumb,put,remove,clear,LIMIT,MAX_BYTES};
})(window);
