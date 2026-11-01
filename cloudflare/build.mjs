// Copy only Bilik Antara, Studio Antara and Novel into a separate Workers
// Static Assets output. Never publish Netlify functions, source maps, private
// files, the original home page or a copy of the poetry archive.
import {readdir,readFile,writeFile,cp,mkdir,rm,stat} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,".."),out=path.join(here,"dist");
const home="https://shaifulridhwan-penulispuisigayabebas.netlify.app";
const prefix=/^(?:bilik-antara(?:[.-])|studio-antara(?:[.-])|antara-cahaya-dan-gelap(?:[.-])|perpustakaan-aksara(?:[.-])|favicon-aksara-ai(?:[.-])|favicon-antara-cahaya-dan-gelap(?:[.-])|aksara-header\.css$|aksara-background-cahaya-gelap\.webp$)/;
function safe(pathname){return pathname&&!pathname.includes("..")&&!pathname.startsWith(".")&&!pathname.includes("\\");}
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
const listed=(await readdir(root,{withFileTypes:true})).filter(x=>x.isFile()&&prefix.test(x.name)).map(x=>x.name);
if(!listed.includes("bilik-antara.html")||!listed.includes("studio-antara.html")||!listed.includes("perpustakaan-aksara.html")||!listed.includes("antara-cahaya-dan-gelap.html"))
 throw Error("Required application HTML missing");
for(const file of listed){
 if(!safe(file))throw Error("Unsafe asset path");
 const source=path.join(root,file),dest=path.join(out,file);
 if(/\.html$/.test(file)){
  let html=await readFile(source,"utf8");
  // Frontend must open the real Netlify home page, not a Cloudflare copy.
  html=html.replace(/href=(["'])\/?index\.html\1/g,(_,q)=>"href="+q+home+"/"+q);
  // Keep app-to-app navigation on Cloudflare, but canonical/OG URLs remain
  // on Netlify until the controlled SEO cutover.
  html=html.replace(/(<a\b[^>]*\bhref=["'])https:\/\/shaifulridhwan-penulispuisigayabebas\.netlify\.app\/(bilik-antara|studio-antara|perpustakaan-aksara|antara-cahaya-dan-gelap)\.html/gi,(_,prefix,name)=>prefix+"/"+name+".html");
  html=html.replace('link(area,"Buka Studio Antara","'+home+'/studio-antara.html")','link(area,"Buka Studio Antara","/studio-antara.html")');
  // Cloudflare-only: inline exact tiny styles at the original cascade positions.
  // Original Netlify page, Studio and Novel remain unchanged.
  if(file==="bilik-antara.html"){
   for(const sheet of ["aksara-header.css","bilik-antara-video.css"]){
    const marker=sheet==="aksara-header.css"
     ? '<link rel="stylesheet" href="aksara-header.css?v=3">'
     : '<link rel="stylesheet" href="bilik-antara-video.css?v=1">';
    if(html.split(marker).length!==2)throw Error("Bilik stylesheet marker changed: "+sheet);
    const css=await readFile(path.join(root,sheet),"utf8");
    if(css.toLowerCase().includes("</style"))throw Error("Unexpected style closure in "+sheet);
    html=html.replace(marker,'<style data-aksara-inline="'+sheet+'">'+String.fromCharCode(10)+css+String.fromCharCode(10)+'</style>');
   }
   const deferred='<link rel="stylesheet" href="bilik-antara-code-execution.css?v=1">';
   if(html.split(deferred).length!==2)throw Error("Runtime CSS link changed");
   html=html.replace(deferred,
    `<link rel="stylesheet" href="bilik-antara-code-execution.css?v=1" media="print" onload="this.media='all'">`+String.fromCharCode(10)+
    `<noscript><link rel="stylesheet" href="bilik-antara-code-execution.css?v=1"></noscript>`);
  }
  // Private bot verification is loaded only on the separate Cloudflare apps.
  // No extra UI, network requests or third-party script when not enabled.
  if(file==="bilik-antara.html"||file==="studio-antara.html")
   html=html.replace(/<\/head>/i,'<script defer src="/aksara-turnstile-client.js"></script>\n</head>');
  // Before coordinated SEO cutover, all preview HTML must remain non-indexable
  // and preserve the existing canonical ownership on Netlify.
  html=html.replace(/<\/head>/i,'<meta name="robots" content="noindex,follow" data-cloudflare-preview="1">\n</head>');
  await writeFile(dest,html);
 }else await cp(source,dest);
}
await cp(path.join(root,"assets","novel"),path.join(out,"assets","novel"),{recursive:true});
await cp(path.join(here,"turnstile-client.js"),path.join(out,"aksara-turnstile-client.js"));
const reader=path.join(out,"assets","novel","pembaca.html");
let readerHtml=await readFile(reader,"utf8");
readerHtml=readerHtml.replace(/href=(["'])\/?index\.html\1/g,(_,q)=>"href="+q+home+"/"+q);
await writeFile(reader,readerHtml);

// Workers Static Assets _headers rules apply to responses from asset binding.
// Restrict caching to Bilik video; version the media URL when content changes.
await writeFile(path.join(out,"_headers"),[
 "# Bilik Antara 30 FPS video; replace media with a bumped ?v= value.",
 "/bilik-antara-background.mp4",
 "  Cache-Control: public, max-age=2592000",
 "  X-Content-Type-Options: nosniff",
].join(String.fromCharCode(10))+String.fromCharCode(10));

for(const target of ["bilik-antara.html","studio-antara.html","perpustakaan-aksara.html","antara-cahaya-dan-gelap.html","assets/novel/pembaca.html"]){
 const p=path.join(out,target);
 if(!(await stat(p)).isFile())throw Error("Missing "+target);
}
console.log("AKSARA Cloudflare assets built: "+listed.length+" root files, Novel assets intact, Netlify home excluded.");
