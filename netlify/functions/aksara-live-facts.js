"use strict";
/* Deterministic, consented public live facts. No LLM guesses or broad URL fetch. */
const TZ="Asia/Kuala_Lumpur";
const cache=new Map();
const WEATHER_URL="https://api.open-meteo.com/v1/forecast";
const GEOCODE_URL="https://geocoding-api.open-meteo.com/v1/search";
const DETECT_URL="https://solat.my/api/detect";
const JAKIM_URL="https://www.e-solat.gov.my/index.php";
const TEMPORAL=/\b(?:esok|besok|hari\s+(?:ini|ni)|malam\s+(?:ini|ni)|sekarang|today|tomorrow|tonight|pagi\s+(?:ini|ni))\b/i;
const WEATHER=/\b(?:cuaca|ramalan\s+cuaca|weather|forecast|suhu|hujan)\b/i;
const PRAYER=/\b(?:waktu\s+solat|solat|sembahyang|isyak|isya|maghrib|subuh|asar|zohor|dzuhur|dhuhr)\b/i;
function classify(question){
 const q=String(question||"").trim().toLowerCase();
 if(!q||q.length>450||/\b(?:apa\s+maksud|erti|definisi|sejarah|kenapa|mengapa|cara\s+kira|formula|hukum|teori)\b/i.test(q))return null;
 if(WEATHER.test(q)&&(TEMPORAL.test(q)||/ramalan|forecast|weather\s+(?:in|at)/i.test(q)))
   return {kind:"weather",when:/\b(?:esok|besok|tomorrow)\b/i.test(q)?"tomorrow":"today"};
 if(PRAYER.test(q)&&(/\b(?:jam|pukul|berapa|waktu|bila|time)\b/i.test(q)||TEMPORAL.test(q)))
   return {kind:"prayer",when:/\b(?:esok|besok|tomorrow)\b/i.test(q)?"tomorrow":"today",
     prayer:/\b(?:isyak|isya)\b/i.test(q)?"isyak":/\bmaghrib\b/i.test(q)?"maghrib":
       /\bsubuh\b/i.test(q)?"subuh":/\b(?:zohor|dzuhur|dhuhr)\b/i.test(q)?"zohor":
       /\basar\b/i.test(q)?"asar":null};
 return null;
}
function malaysiaDate(when="today",now=new Date()){
 // ISO date in MY timezone without depending on Netlify worker's UTC timezone.
 const parts=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
 const yyyyMmDd=p.year+"-"+p.month+"-"+p.day;
 if(when!=="tomorrow")return yyyyMmDd;
 return new Date(Date.parse(yyyyMmDd+"T00:00:00Z")+86400000).toISOString().slice(0,10);
}
function cityFromText(question){
 const q=String(question||"").trim();
 const found=q.match(/\b(?:di|kat|dekat|sekitar|area|untuk|in|at)\s+([a-zA-Z][a-zA-Z\s.'-]{2,55})/i);
 if(!found)return "";
 return found[1].replace(/\b(?:esok|besok|tomorrow|hari ini|hari ni|today|malam ini|malam ni|jam berapa|pukul berapa)\b.*$/i,"").replace(/[?.!,]+$/,"").trim().slice(0,55);
}
function resumeLocation(question,history){
 const city=String(question||"").trim();
 if(classify(city)||!/^[a-zA-ZÀ-ÿ\s.'-]{3,60}$/.test(city)||!Array.isArray(history))return city;
 const priorAssistant=[...history].reverse().find(x=>x?.role==="assistant"&&typeof x.content==="string");
 if(!priorAssistant||!/perlukan kawasan|nyatakan bandar/i.test(priorAssistant.content))return city;
 const priorUser=[...history].reverse().find(x=>x?.role==="user"&&typeof x.content==="string");
 if(!priorUser||!classify(priorUser.content))return city;
 return priorUser.content+" di "+city;
}
function safeCoords(coarse){
 const a=Number(coarse?.latitude),b=Number(coarse?.longitude);
 if(!Number.isFinite(a)||!Number.isFinite(b)||a<0.5||a>7.8||b<99||b>120)return null;
 return {lat:Math.round(a*100)/100,lon:Math.round(b*100)/100,name:"lokasi anggaran kau"};
}
function decodeZone(data){
 const z=[data?.zone,data?.code,data?.data?.zone,data?.data?.code,data?.location?.zone,data?.location?.code]
   .find(x=>typeof x==="string"&&/^[A-Z]{3}0[1-9]$/.test(x));
 return z||null;
}
async function getJson(url,{fetchImpl=fetch,signal,timeoutMs=4600}={}){
 const controller=new AbortController();
 const stop=()=>controller.abort();
 if(signal?.aborted)stop();
 signal?.addEventListener?.("abort",stop,{once:true});
 const timer=setTimeout(stop,timeoutMs);
 try{
   const response=await fetchImpl(url,{headers:{Accept:"application/json"},redirect:"error",signal:controller.signal});
   if(!response.ok)throw new Error("source_http_"+response.status);
   return await response.json();
 }finally{clearTimeout(timer);signal?.removeEventListener?.("abort",stop);}
}
async function memo(key,ttl,fn,now=Date.now()){
 const hit=cache.get(key);
 if(hit&&now-hit.at<ttl)return hit.value;
 const value=await fn();
 if(cache.size>=100)cache.delete(cache.keys().next().value);
 cache.set(key,{at:now,value});
 return value;
}
async function locate(question,coarseLocation,options){
 const supplied=safeCoords(coarseLocation);
 if(supplied)return supplied;
 const city=cityFromText(question);
 if(!city)return null;
 const url=GEOCODE_URL+"?name="+encodeURIComponent(city)+"&count=5&countryCode=MY&language=en";
 const data=await getJson(url,options);
 const rows=Array.isArray(data?.results)?data.results:[];
 const match=rows.find(x=>x.country_code==="MY"&&Number.isFinite(x.latitude)&&Number.isFinite(x.longitude));
 return match?{lat:Math.round(match.latitude*100)/100,lon:Math.round(match.longitude*100)/100,
   name:String(match.name||city).slice(0,70)}:null;
}
function answerMissing(){
 return {status:"location_required",reply:"Untuk beri jawapan tepat, aku perlukan kawasan kau dahulu. Nyatakan bandar, contohnya ‘Subang Jaya’, atau benarkan lokasi dalam Aksara Today. Aku tak nak teka cuaca atau zon solat kau.",
   sources:[],toolsUsed:[]};
}
function formatTime(value){
 const match=String(value||"").match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
 if(!match)return null;
 const hour=Number(match[1]),minute=Number(match[2]);
 if(hour>23||minute>59)return null;
 return ((hour+11)%12+1)+":"+match[2]+" "+(hour<12?"pagi":hour<19?"petang":"malam");
}
async function answer(question,{coarseLocation,signal,fetchImpl=fetch,now=new Date()}={}){
 const intent=classify(question);
 if(!intent)return null;
 const options={fetchImpl,signal};
 let place;
 try{place=await locate(question,coarseLocation,options);}
 catch(e){if(signal?.aborted)throw e;return {status:"location_unavailable",reply:"Aku belum dapat sahkan lokasi daripada sumber geografi. Cuba nyatakan bandar Malaysia yang lebih khusus.",sources:[],toolsUsed:[]};}
 if(!place)return answerMissing();
 const day=malaysiaDate(intent.when,now);
 try{
   if(intent.kind==="weather"){
     const key="weather:"+place.lat+":"+place.lon+":"+day;
     const data=await memo(key,15*60*1000,()=>getJson(WEATHER_URL+
       "?latitude="+place.lat+"&longitude="+place.lon+
       "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max"+
       "&timezone=Asia%2FKuala_Lumpur&forecast_days=3",options));
     const times=data?.daily?.time||[];
     const i=times.indexOf(day);
     const low=data?.daily?.temperature_2m_min?.[i],high=data?.daily?.temperature_2m_max?.[i];
     const rain=data?.daily?.precipitation_probability_max?.[i];
     if(i<0||!Number.isFinite(low)||!Number.isFinite(high))throw new Error("invalid_forecast");
     return {status:"verified",reply:"Ramalan cuaca "+place.name+" untuk "+day+" (waktu Malaysia): suhu sekitar "+
       Math.round(low)+"–"+Math.round(high)+"°C"+
       (Number.isFinite(rain)?", kebarangkalian hujan maksimum "+Math.round(rain)+"%":"")+
       ". Sumber: Open-Meteo. Ini ramalan, bukan jaminan keadaan sebenar.",
       sources:[{title:"Open-Meteo Forecast API",url:"https://open-meteo.com/en/docs"}],toolsUsed:["open_meteo"]};
   }
   const zone=await memo("zone:"+place.lat+":"+place.lon,6*3600000,async()=>{
     const data=await getJson(DETECT_URL+"?latitude="+place.lat+"&longitude="+place.lon,options);
     const detected=decodeZone(data);
     if(!detected)throw new Error("invalid_zone");
     return detected;
   });
   const period=intent.when==="tomorrow"?"week":"today";
   const url=JAKIM_URL+"?r=esolatApi/takwimsolat&period="+period+"&zone="+zone;
   const data=await memo("prayer:"+zone+":"+day,60*60*1000,()=>getJson(url,options));
   const list=Array.isArray(data?.prayerTime)?data.prayerTime:[];
   const matches=(value)=>{
     const raw=String(value||"").trim();
     if(raw===day)return true;
     const m=raw.match(/^(\d{1,2})[-/ ]([A-Za-z]{3}|\d{1,2})[-/ ](\d{4})$/);
     if(!m)return false;
     const month=Number(m[2])||(["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(m[2].toLowerCase())+1);
     return m[3]+"-"+String(month).padStart(2,"0")+"-"+m[1].padStart(2,"0")===day;
   };
   const entry=list.find(x=>matches(x?.date))||(intent.when==="today"&&list.length===1?list[0]:null);
   if(!entry)throw new Error("missing_or_mismatched_timetable_date");
   const names={subuh:"Subuh",zohor:"Zohor",asar:"Asar",maghrib:"Maghrib",isyak:"Isyak"};
   const fields={subuh:"fajr",zohor:"dhuhr",asar:"asr",maghrib:"maghrib",isyak:"isha"};
   const keys=intent.prayer?[intent.prayer]:Object.keys(names);
   const times=keys.map(k=>({name:names[k],time:formatTime(entry[fields[k]])}));
   if(times.some(x=>!x.time))throw new Error("invalid_prayer_time");
   return {status:"verified",reply:"Waktu solat "+(intent.prayer?names[intent.prayer]:"")+" untuk "+place.name+
     " (zon "+zone+") pada "+day+": "+times.map(x=>x.name+" "+x.time).join(", ")+
     ". Sumber: e-Solat JAKIM. Zon disahkan daripada lokasi anggaran.",
     sources:[{title:"Jadual waktu solat JAKIM ("+zone+")",url}],toolsUsed:["jakim_esolat","zone_detection"]};
 }catch(e){
   if(signal?.aborted)throw e;
   return {status:"source_unavailable",reply:"Aku dah cuba dapatkan "+
     (intent.kind==="weather"?"ramalan cuaca":"jadual waktu solat JAKIM")+
     " untuk "+place.name+", tetapi sumber data langsung tak dapat disahkan sekarang. Aku tak akan reka waktu atau ramalan. Cuba semula sebentar lagi.",
     sources:[],toolsUsed:[]};
 }
}
module.exports={classify,resumeLocation,malaysiaDate,cityFromText,safeCoords,decodeZone,formatTime,answer};
