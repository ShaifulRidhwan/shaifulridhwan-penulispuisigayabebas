"use strict";
/* Static contract: page identity, JSON-LD, manifests, icon assets and sitemap.
 * Run: node --test scripts/test-site-metadata.cjs
 * Read-only; does not require network, Playwright or a deploy. */
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const zlib=require("node:zlib");
const root=path.resolve(__dirname,"..");
const base="https://shaifulridhwan-penulispuisigayabebas.netlify.app";
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const exists=file=>fs.existsSync(path.join(root,file));
const tags=head=>[...head.matchAll(/<(meta|link)\s+([^>]*?)\/?>/gi)].map(m=>{
  const attrs={};
  for(const a of m[2].matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))attrs[a[1].toLowerCase()]=a[2]??a[3];
  return {tag:m[1].toLowerCase(),...attrs};
});
const headOf=file=>{
 const html=read(file);
 const match=html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
 assert.ok(match,file+" must have a <head>");
 return {html,head:match[1],tags:tags(match[1])};
};
const find=(items,key,value)=>items.filter(x=>x[key]===value);
const single=(items,key,value,file)=>{
 const matches=find(items,key,value);
 assert.equal(matches.length,1,file+" must have exactly one "+key+"="+value);
 return matches[0];
};
const isRootFile=href=>href.startsWith("/")&&!href.startsWith("//")&&exists(href.split("?")[0].slice(1));
const schemaOf=head=>[...head.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
 .map(m=>JSON.parse(m[1]));
const configs=[
 {file:"index.html",url:"/",favicon:"gaya-bebas",manifest:"gaya-bebas.webmanifest",schema:"WebSite"},
 {file:"antara-cahaya-dan-gelap.html",url:"/antara-cahaya-dan-gelap.html",favicon:"antara-cahaya-dan-gelap",manifest:"antara-cahaya-dan-gelap.webmanifest",schema:"Book"},
 {file:"bilik-antara.html",url:"/bilik-antara.html",favicon:"aksara-ai",manifest:"bilik-antara.webmanifest",schema:"WebApplication"},
 {file:"studio-antara.html",url:"/studio-antara.html",favicon:"aksara-ai",manifest:"studio-antara.webmanifest",schema:"WebApplication"}
];
for(const config of configs){
 test(config.file+" has consistent public metadata",()=>{
  const {head,tags:items}=headOf(config.file);
  assert.ok(head.match(/<title>[^<]+<\/title>/i),"document title");
  const canonical=single(items,"rel","canonical",config.file);
  assert.equal(canonical.href,base+config.url);
  assert.equal(single(items,"name","description",config.file).content.length>60,true);
  assert.equal(single(items,"name","robots",config.file).content.includes("noindex"),false);
  assert.equal(single(items,"property","og:url",config.file).content,canonical.href);
  assert.ok(single(items,"property","og:title",config.file).content);
  assert.ok(single(items,"property","og:description",config.file).content);
  assert.ok(single(items,"name","twitter:title",config.file).content);
  const image=single(items,"property","og:image",config.file).content;
  const asset=new URL(image);
  assert.equal(asset.origin,new URL(base).origin);
  assert.ok(exists(asset.pathname.slice(1)),"OG image must exist locally");
  const favicon=single(items,"type","image/svg+xml",config.file);
  assert.ok(favicon.href.startsWith("/favicon-"+config.favicon+".svg"),"correct favicon family");
  assert.ok(isRootFile(favicon.href),"SVG favicon exists");
  const png=items.find(x=>x.tag==="link"&&x.rel==="icon"&&x.type==="image/png");
  assert.ok(png&&isRootFile(png.href),"PNG favicon exists");
  const touch=single(items,"rel","apple-touch-icon",config.file);
  assert.ok(isRootFile(touch.href),"apple-touch icon exists");
  const manifest=single(items,"rel","manifest",config.file);
  assert.equal(manifest.href,"/"+config.manifest);
  assert.ok(isRootFile(manifest.href),"manifest exists");
  const schemas=schemaOf(head);
  assert.ok(schemas.some(s=>s["@type"]===config.schema||s["@graph"]?.some(n=>n["@type"]===config.schema)),"required schema type");
  for(const schema of schemas)assert.equal(schema["@context"],"https://schema.org");
 });
 test(config.manifest+" has valid linked icons",()=>{
  const manifest=JSON.parse(read(config.manifest));
  assert.equal(manifest.start_url,config.url);
  assert.equal(manifest.lang,"ms");
  assert.equal(manifest.id,config.url);
  assert.ok(manifest.icons?.length>=2);
  for(const icon of manifest.icons){
   assert.ok(isRootFile(icon.src),"manifest icon exists: "+icon.src);
   if(icon.type==="image/png"){
    const png=fs.readFileSync(path.join(root,icon.src.slice(1)));
    assert.equal(png.subarray(0,8).toString("hex"),"89504e470d0a1a0a","valid PNG signature");
    assert.equal(png.readUInt32BE(16),Number(icon.sizes.split("x")[0]));
    assert.equal(png.readUInt32BE(20),Number(icon.sizes.split("x")[1]));
    // Make sure the generated icon really decompresses, not just has a PNG header.
    let offset=8,packed=[];
    while(offset+12<=png.length){
     const len=png.readUInt32BE(offset),type=png.toString("ascii",offset+4,offset+8);
     if(type==="IDAT")packed.push(png.subarray(offset+8,offset+8+len));
     offset+=len+12;
     if(type==="IEND")break;
    }
    const decoded=zlib.inflateSync(Buffer.concat(packed));
    assert.equal(decoded.length,(png.readUInt32BE(16)+1)*png.readUInt32BE(20),"indexed PNG decompressed scanlines");
   }
  }
 });
}
test("public novel catalog has canonical and social identity",()=>{
 const {head,tags:items}=headOf("perpustakaan-aksara.html");
 const url=base+"/perpustakaan-aksara.html";
 assert.equal(single(items,"rel","canonical","perpustakaan-aksara.html").href,url);
 assert.equal(single(items,"property","og:url","perpustakaan-aksara.html").content,url);
 assert.ok(single(items,"property","og:title","perpustakaan-aksara.html").content);
 assert.ok(single(items,"name","twitter:card","perpustakaan-aksara.html").content);
 assert.doesNotMatch(single(items,"name","robots","perpustakaan-aksara.html").content,/noindex/);
 const image=new URL(single(items,"property","og:image","perpustakaan-aksara.html").content);
 assert.equal(image.origin,new URL(base).origin);
 assert.ok(exists(image.pathname.slice(1)),"catalog social image exists");
 assert.ok(schemaOf(head).some(schema=>schema["@type"]==="CollectionPage"));
});
test("novel internal reader remains noindex and uses novel identity",()=>{
 const {tags:items}=headOf("assets/novel/pembaca.html");
 assert.match(single(items,"name","robots","assets/novel/pembaca.html").content,/noindex/);
 assert.equal(single(items,"rel","canonical","assets/novel/pembaca.html").href,base+"/antara-cahaya-dan-gelap.html");
 assert.ok(single(items,"type","image/svg+xml","assets/novel/pembaca.html").href.includes("favicon-antara-cahaya-dan-gelap"));
});
test("sitemap includes canonical public pages only",()=>{
 const xml=read("sitemap.xml");
 const locs=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
 assert.equal(locs.length,configs.length+1);
 assert.deepEqual(new Set(locs),new Set([...configs.map(p=>base+p.url),base+"/perpustakaan-aksara.html"]));
 assert.ok(!xml.includes("studio-imej-beta.html"));
 assert.ok(!xml.includes("assets/novel/pembaca.html"));
});
test("poetry JSON is valid and stated poem count is accurate",()=>{
 const works=JSON.parse(read("karya-index.json"));
 assert.ok(Array.isArray(works));
 assert.equal(new Set(works.map(w=>w.id)).size,works.length,"unique poetry ids");
 assert.ok(works.every(w=>typeof w.title==="string"&&Array.isArray(w.lines)),"valid poetry records");
 const poems=works.filter(w=>w.lines.length>2);
 assert.ok(read("index.html").includes("Baca "+poems.length+" puisi"),"homepage poem count");
});
