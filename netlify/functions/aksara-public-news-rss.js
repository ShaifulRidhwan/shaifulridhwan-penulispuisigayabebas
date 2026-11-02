"use strict";
/* No-key public news fallback. Publisher RSS metadata is evidence of an item
 * being published, NOT a verified fact-check or a full-page read.
 * Only fixed publisher-owned HTTPS feeds; never fetch user-supplied URLs. */
const FEEDS=Object.freeze([
 {publisher:"TechCrunch",url:"https://techcrunch.com/category/artificial-intelligence/feed/",hosts:["techcrunch.com","www.techcrunch.com"]},
 {publisher:"Ars Technica",url:"https://arstechnica.com/ai/feed/",hosts:["arstechnica.com","www.arstechnica.com"]},
 {publisher:"MIT News",url:"https://news.mit.edu/rss/topic/artificial-intelligence2",hosts:["news.mit.edu"]},
 {publisher:"BBC Technology",url:"https://feeds.bbci.co.uk/news/technology/rss.xml",hosts:["bbc.com","www.bbc.com","bbc.co.uk","www.bbc.co.uk"]}
]);
const MONTHS=Object.freeze({januari:1,january:1,februari:2,february:2,mac:3,march:3,april:4,mei:5,may:5,jun:6,june:6,julai:7,july:7,ogos:8,august:8,september:9,oktober:10,october:10,november:11,disember:12,december:12});
function requestedDate(question){
 const q=String(question||"");
 const m=q.match(/\b([0-3]?\d)\s+(januari|january|februari|february|mac|march|april|mei|may|jun|june|julai|july|ogos|august|september|oktober|october|november|disember|december)\s+(20\d{2})\b/i);
 if(!m)return null;
 const day=Number(m[1]),month=MONTHS[m[2].toLowerCase()],year=Number(m[3]);
 const date=new Date(Date.UTC(year,month-1,day));
 return date.getUTCFullYear()===year&&date.getUTCMonth()+1===month&&date.getUTCDate()===day
  ?date.toISOString().slice(0,10):null;
}
function eligible(intent={},env=process.env){
 const q=String(intent.question||"");
 return env.AKSARA_PUBLIC_RSS_ENABLED!=="false"&&env.AKSARA_DISABLE_TOOLS!=="true"&&
  intent.search===true&&!intent.hasLink&&!intent.sensitive&&!intent.privateContext&&
  !intent.attachment&&!intent.account&&q.length>=4&&q.length<=800&&
  /\b(?:berita|news|headlines|perkembangan terkini)\b/i.test(q)&&
  /\b(?:ai|artificial intelligence|kecerdasan buatan|openai|gemini|chatgpt|deepseek|anthropic|llm)\b/i.test(q);
}
function unescapeXml(raw){
 return String(raw||"").replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{
  const num=n[0].toLowerCase()==="x"?parseInt(n.slice(1),16):parseInt(n,10);
  return num>0&&num<=0x10ffff&&!(num>=0xd800&&num<=0xdfff)?String.fromCodePoint(num):"";
 }).replace(/&(?:amp|lt|gt|quot|apos|nbsp);/gi,m=>({
  "&amp;":"&","&lt;":"<","&gt;":">","&quot;":'"',"&apos;":"'","&nbsp;":" "
 })[m.toLowerCase()]||" ");
}
function cleanText(raw,max=220){
 return unescapeXml(String(raw||"").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1")
  .replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim()).replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);
}
function field(xml,name){
 const match=xml.match(new RegExp("<"+name+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/"+name+"\\s*>","i"));
 return match?match[1]:"";
}
// Publisher category feeds sometimes include unrelated startup/business news.
 // Relevance must be evidenced by the HEADLINE itself; summaries and feed
 // categories alone are too weak and caused Founder Summit to appear as AI news.
const AI_HEADLINE=/(?:\b(?:ai|a\.i\.|artificial intelligence|kecerdasan buatan|openai|chatgpt|gpt-\d|gemini|deepseek|anthropic|claude|llm|llms|generative ai|machine learning|deep learning|neural network(?:s)?|language model(?:s)?|ai agent(?:s)?|copilot|chatbot(?:s)?|large language model(?:s)?)\b)/i;
function relevantHeadline(title){
 if(typeof title!=="string")return false;
 // A literal "non-AI" news headline is not positive evidence of AI coverage.
 if(/\bnon[- ]AI\b/i.test(title))return false;
 return AI_HEADLINE.test(title);
}
function parse(xml,feed,now=Date.now(),targetDate=null){
 if(typeof xml!=="string"||xml.length>400000)return [];
 const items=[...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].slice(0,80);
 return items.flatMap(([,item])=>{
  const title=cleanText(field(item,"title"));
  const rawLink=cleanText(field(item,"link"),1000);
  let url;try{url=new URL(rawLink);}catch(_){return [];}
  if(url.protocol!=="https:"||url.username||url.password||!feed.hosts.includes(url.hostname.toLowerCase()))return [];
  const timestamp=Date.parse(cleanText(field(item,"pubDate"),120));
  if(!Number.isFinite(timestamp)||timestamp>now+600000||timestamp<now-8*86400000)return [];
  const date=new Date(timestamp).toISOString().slice(0,10);
  if(targetDate?date!==targetDate:timestamp<now-7*86400000)return [];
  if(!title)return [];
  const summary=cleanText(field(item,"description"),280);
  if(!relevantHeadline(title))return [];
  return [{title,url:url.href,date,publishedAt:timestamp,publisher:feed.publisher,summary}];
 });
}
async function search({question,signal,deadline=Date.now()+3800,fetchImpl=fetch,now=Date.now()}={}){
 const time=Math.min(3500,Math.max(0,deadline-Date.now()));
 if(time<800)return {status:"insufficient_time",sources:[]};
 const targetDate=requestedDate(question);
 const controller=new AbortController();
 const onAbort=()=>controller.abort();
 if(signal?.aborted)controller.abort();else signal?.addEventListener?.("abort",onAbort,{once:true});
 const timer=setTimeout(()=>controller.abort(),time);
 try{
  const results=await Promise.all(FEEDS.map(async feed=>{
   try{
    const response=await fetchImpl(feed.url,{method:"GET",redirect:"error",signal:controller.signal,
     headers:{"Accept":"application/rss+xml, application/xml, text/xml;q=0.9"}});
    if(!response.ok)return [];
    const header=String(response.headers?.get?.("content-type")||"");
    if(header&&!/(?:xml|rss|text\/plain)/i.test(header))return [];
    const xml=await response.text();
    return parse(xml,feed,now,targetDate);
   }catch(_){return [];}
  }));
  const combined=results.flat().sort((a,b)=>b.publishedAt-a.publishedAt);
  const seen=new Set(),sources=[];
  for(const item of combined){
   if(seen.has(item.url))continue;
   seen.add(item.url);sources.push(item);if(sources.length===3)break;
  }
  return {status:sources.length?"success":"no_matching_items",sources,targetDate};
 }catch(_){return {status:"feeds_unavailable",sources:[],targetDate};}
 finally{clearTimeout(timer);signal?.removeEventListener?.("abort",onAbort);}
}
function render(data){
 const articles=Array.isArray(data?.sources)?data.sources:[];
 if(!articles.length)return "";
 const header=data.targetDate
  ?"Tajuk berita AI yang tersenarai dalam RSS penerbit untuk "+data.targetDate+" (tarikh UTC):"
  :"Tajuk berita AI terkini yang tersenarai dalam RSS penerbit:";
 return header+"\n\n"+articles.map((x,i)=>(i+1)+". **"+x.title.replace(/[\[\]*]/g,"")+"** ("+x.publisher+", "+x.date+")").join("\n\n")+
  "\n\nPautan artikel ada pada bahagian **Sumber Semakan** di bawah. Tajuk dan tarikh diperoleh daripada RSS penerbit; isi penuh artikel dan ketepatan dakwaan belum diperiksa.";
}
module.exports={FEEDS,eligible,requestedDate,relevantHeadline,parse,search,render};
