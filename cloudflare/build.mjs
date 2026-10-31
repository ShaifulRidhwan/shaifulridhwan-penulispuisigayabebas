// Copy only Bilik Antara, Studio Antara and Novel into a separate Workers
// Static Assets output. Never publish Netlify functions, source maps, private
// files, the original home page or a copy of the poetry archive.
import {readdir,readFile,writeFile,cp,mkdir,rm,stat} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,".."),out=path.join(here,"dist");
const home="https://shaifulridhwan-penulispuisigayabebas.netlify.app";
const prefix=/^(?:bilik-antara(?:[.-])|studio-antara(?:[.-])|antara-cahaya-dan-gelap(?:[.-])|perpustakaan-aksara(?:[.-])|favicon-aksara-ai(?:[.-])|favicon-antara-cahaya-dan-gelap(?:[.-])|aksara-header\.css$)/;
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
  html=html.replace(/(<a\\b[^>]*\\bhref=["'])https:\\/\\/shaifulridhwan-penulispuisigayabebas\\.netlify\\.app\\/(bilik-antara|studio-antara|perpustakaan-aksara|antara-cahaya-dan-gelap)\\.html/gi,(_,prefix,name)=>prefix+"/"+name+".html");
  html=html.replace('link(area,"Buka Studio Antara","'+home+'/studio-antara.html")','link(area,"Buka Studio Antara","/studio-antara.html")');
  // Before coordinated SEO cutover, all preview HTML must remain non-indexable
  // and preserve the existing canonical ownership on Netlify.
  html=html.replace(/<\/head>/i,'<meta name="robots" content="noindex,follow" data-cloudflare-preview="1">\n</head>');
  await writeFile(dest,html);
 }else await cp(source,dest);
}
await cp(path.join(root,"assets","novel"),path.join(out,"assets","novel"),{recursive:true});
const reader=path.join(out,"assets","novel","pembaca.html");
let readerHtml=await readFile(reader,"utf8");
readerHtml=readerHtml.replace(/href=(["'])\\/?index\\.html\\1/g,(_,q)=>"href="+q+home+"/"+q);
await writeFile(reader,readerHtml);

for(const target of ["bilik-antara.html","studio-antara.html","perpustakaan-aksara.html","antara-cahaya-dan-gelap.html","assets/novel/pembaca.html"]){
 const p=path.join(out,target);
 if(!(await stat(p)).isFile())throw Error("Missing "+target);
}
console.log("AKSARA Cloudflare assets built: "+listed.length+" root files, Novel assets intact, Netlify home excluded.");
