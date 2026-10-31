// SQLite Durable Object. Only the Worker can call this class through its
// private binding. No messages, IPs, photos or prompts are stored here.
const json=(status,body,wait=0)=>new Response(JSON.stringify(body),{
 status,headers:{"content-type":"application/json","cache-control":"no-store",
 ...(wait?{"retry-after":String(wait)}:{})}});
const integer=(n,def,max)=>{const v=Number(n);return Number.isFinite(v)?Math.min(max,Math.max(0,Math.floor(v))):def;};
const resetTime=(now)=>Math.max(1,Math.ceil((Math.floor(now/86400000)*86400000+86400000-now)/1000));
function blocked(message,seconds=60){throw Object.assign(Error(message),{code:429,retryAfterSeconds:seconds});}
export class AksaraControl{
 constructor(ctx,env){
  this.ctx=ctx;this.env=env;
  const sql=ctx.storage.sql;
  sql.exec("CREATE TABLE IF NOT EXISTS daily (day TEXT PRIMARY KEY, chat INTEGER NOT NULL DEFAULT 0, studio INTEGER NOT NULL DEFAULT 0, enhancements INTEGER NOT NULL DEFAULT 0)");
  sql.exec("CREATE TABLE IF NOT EXISTS users (scope TEXT PRIMARY KEY, started INTEGER NOT NULL, count INTEGER NOT NULL DEFAULT 0, enhance_at INTEGER NOT NULL DEFAULT 0)");
  sql.exec("CREATE TABLE IF NOT EXISTS leases (id TEXT PRIMARY KEY, expires INTEGER NOT NULL)");
 }
 async fetch(request){
  if(request.method!=="POST")return json(405,{error:"Method not allowed"});
  let data;try{data=await request.json();}catch(_){return json(400,{error:"Invalid request"});}
  if(!data||!["chat","health","voice","studio","release"].includes(data.kind)||typeof data!=="object")
   return json(400,{error:"Invalid scope"});
  const now=Date.now(),day=new Date(now).toISOString().slice(0,10);
  const hash=String(data.hash||"");
  if(data.kind!=="release"&&!/^[a-f0-9]{32}$/.test(hash))return json(400,{error:"Invalid client digest"});
  try{
   const answer=this.ctx.storage.transactionSync(()=>{
    const db=this.ctx.storage.sql;
    db.exec("INSERT OR IGNORE INTO daily(day) VALUES(?)",day);
    // Remove only recent expired entries, never retain IP-window history forever.
    db.exec("DELETE FROM users WHERE started<?",now-86400000);
    db.exec("DELETE FROM leases WHERE expires<?",now);
    if(data.kind==="release"){
     const id=String(data.id||"");
     if(!/^[a-f0-9-]{36}$/.test(id))return {invalid:true};
     db.exec("DELETE FROM leases WHERE id=?",id);
     return {released:true};
    }
    const key=data.kind+":"+day+":"+hash;
    const limits=data.kind==="voice"?{count:5,window:600000}:
     data.kind==="chat"?{count:12,window:60000}:
     data.kind==="health"?{count:30,window:60000}:
     {count:8,window:600000};
    const entry=db.exec("SELECT started,count,enhance_at FROM users WHERE scope=?",key).toArray()[0];
    const fresh=!entry||now-entry.started>=limits.window;
    const started=fresh?now:entry.started;
    const count=fresh?0:entry.count;
    const enhanceAt=entry?.enhance_at||0;
    if(data.kind==="studio"){
     const budget=integer(this.env.STUDIO_DAILY_NEURONS,6000,8000),cost=integer(data.cost,0,8000);
     const row=db.exec("SELECT studio,enhancements FROM daily WHERE day=?",day).toArray()[0];
     const busy=db.exec("SELECT COUNT(*) as n FROM leases WHERE expires>?",now).toArray()[0]?.n||0;
     if(busy>=2)blocked("Studio sedang penuh. Cuba lagi dalam seminit.",60);
     if(data.action==="enhance"){
      if(row.enhancements>=50)blocked("Kuota perkemas AI hari ini dah habis.",resetTime(now));
      if(now-enhanceAt<60000)blocked("Tunggu seminit sebelum perkemas dengan AI lagi.",60);
     }else{
      if(row.studio+cost>budget)blocked("Bajet Studio hari ini habis. Cuba selepas 8 pagi Malaysia.",resetTime(now));
      if(count>=8)blocked("Had 8 imej dalam 10 minit dicapai.",Math.ceil((started+600000-now)/1000));
     }
     if(data.action==="enhance"){
      db.exec("UPDATE daily SET enhancements=enhancements+1 WHERE day=?",day);
      db.exec("INSERT INTO users(scope,started,count,enhance_at) VALUES(?,?,?,?) ON CONFLICT(scope) DO UPDATE SET enhance_at=excluded.enhance_at",key,started,count,now);
     }else{
      db.exec("UPDATE daily SET studio=studio+? WHERE day=?",cost,day);
      db.exec("INSERT INTO users(scope,started,count,enhance_at) VALUES(?,?,?,?) ON CONFLICT(scope) DO UPDATE SET started=excluded.started,count=excluded.count",key,started,count+1,enhanceAt);
     }
     const id=crypto.randomUUID();
     db.exec("INSERT INTO leases(id,expires) VALUES(?,?)",id,now+70000);
     return {ok:true,id};
    }
    if(count>=limits.count)blocked("Terlalu banyak permintaan. Cuba sebentar lagi.",Math.ceil((started+limits.window-now)/1000));
    if(data.kind==="chat"){
     const cap=integer(this.env.AKSARA_CHAT_DAILY_REQUESTS,800,100000);
     const row=db.exec("SELECT chat FROM daily WHERE day=?",day).toArray()[0];
     if(row.chat>=cap)blocked("Bajet harian Chat tercapai.",resetTime(now));
     db.exec("UPDATE daily SET chat=chat+1 WHERE day=?",day);
    }
    db.exec("INSERT INTO users(scope,started,count,enhance_at) VALUES(?,?,?,0) ON CONFLICT(scope) DO UPDATE SET started=excluded.started,count=excluded.count",key,started,count+1);
    return {ok:true};
   });
   return answer.invalid?json(400,{error:"Invalid release token"}):json(200,answer);
  }catch(e){return e.code===429?json(429,{error:e.message,retryAfterSeconds:e.retryAfterSeconds},e.retryAfterSeconds):
   json(503,{error:"Shared AKSARA quota unavailable"});}
 }
}
