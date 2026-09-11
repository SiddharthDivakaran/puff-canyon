const SEASON='100-levels-v1';
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
const random=()=>crypto.randomUUID().replaceAll('-','');
const cookieOwner=request=>request.headers.get('Cookie')?.match(/(?:^|;\s*)puff_player=([a-f0-9]{32})(?:;|$)/)?.[1];

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
    if(!['/api/leaderboard','/api/runs','/api/scores'].includes(url.pathname))return json({error:'Not found'},404);
    if(request.method!=='GET'&&request.method!=='POST')return json({error:'Method not allowed'},405);
    // The public deployment owns its API. Other websites cannot write via a browser.
    if(request.method==='POST'){
      if(request.headers.get('Origin')!==url.origin)return json({error:'Origin not allowed'},403);
      if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'JSON required'},415);
      if(Number(request.headers.get('Content-Length'))>2048)return json({error:'Request too large'},413);
    }
    if(!env.LEADERBOARD)return json({error:'Leaderboard is unavailable'},503);
    const owner=cookieOwner(request)??random();
    const headers=new Headers(request.headers);headers.set('X-Puff-Owner',owner);
    // Overwrite all client-supplied identity/rate-limit headers.
    headers.set('X-Puff-IP',request.headers.get('CF-Connecting-IP')??'unknown');
    try{
      const result=await env.LEADERBOARD.get(env.LEADERBOARD.idFromName(SEASON)).fetch(new Request(request,{headers}));
      const response=new Response(result.body,result);
      if(!cookieOwner(request))response.headers.append('Set-Cookie',`puff_player=${owner}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=31536000`);
      return response;
    }catch{return json({error:'Leaderboard is taking a breather. Try again shortly.'},503)}
  }
};

// SQLite-backed Durable Object: automatically provisioned by wrangler deploy.
// Casual competition: validates sessions, ranges, elapsed time and duplicates.
// Client input is not a server-authoritative physics replay; do not use for prizes.
export class PuffLeaderboard {
  constructor(state){
    this.sql=state.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS runs (token TEXT PRIMARY KEY,owner TEXT NOT NULL,started INTEGER NOT NULL,expires INTEGER NOT NULL,submitted INTEGER NOT NULL DEFAULT 0)`);
    this.sql.exec('CREATE INDEX IF NOT EXISTS idx_runs_expires ON runs(expires)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS idx_runs_owner_started ON runs(owner,started)');
    this.sql.exec(`CREATE TABLE IF NOT EXISTS scores (owner TEXT PRIMARY KEY,name TEXT NOT NULL,gates INTEGER NOT NULL,points INTEGER NOT NULL,achieved INTEGER NOT NULL)`);
    this.sql.exec('CREATE INDEX IF NOT EXISTS idx_scores_rank ON scores(gates DESC,points DESC,achieved ASC)');
    this.buckets=new Map();this.cleanupAt=0;
  }
  rows(query,...params){return this.sql.exec(query,...params).toArray()}
  allowed(key,limit,now){
    const minute=Math.floor(now/60000),old=this.buckets.get(key);
    if(this.buckets.size>5000){for(const [k,v] of this.buckets)if(v.minute!==minute)this.buckets.delete(k);if(this.buckets.size>5000)return false}
    const next=old?.minute===minute?{minute,count:old.count+1}:{minute,count:1};
    this.buckets.set(key,next);return next.count<=limit;
  }
  async fetch(request){
    const path=new URL(request.url).pathname,owner=request.headers.get('X-Puff-Owner'),now=Date.now();
    if(!owner)return json({error:'Missing player'},401);
    if(!this.allowed(request.headers.get('X-Puff-IP')??owner,120,now))return json({error:'Too many requests. Try again in a minute.'},429);
    if(path==='/api/leaderboard'&&request.method==='GET'){
      const rows=this.rows('SELECT name,gates,points FROM scores ORDER BY gates DESC,points DESC,achieved ASC LIMIT 50');
      const mine=this.rows('SELECT name,gates,points FROM scores WHERE owner=?',owner)[0]??null;
      return json({season:SEASON,rows,mine});
    }
    if(request.method!=='POST')return json({error:'Method not allowed'},405);
    let body;
    try{const text=await request.text();if(text.length>2048)return json({error:'Request too large'},413);body=JSON.parse(text);if(!body||typeof body!=='object'||Array.isArray(body))throw new Error()}catch{return json({error:'Invalid request'},400)}
    if(path==='/api/runs'){
      const recent=this.rows('SELECT COUNT(*) AS n FROM runs WHERE owner=? AND started>?',owner,now-60000)[0].n;
      if(recent>=15)return json({error:'Take a breath. Try ranked flight again in a minute.'},429);
      if(now>this.cleanupAt){this.sql.exec('DELETE FROM runs WHERE expires<?',now);this.cleanupAt=now+60000}
      const token=random();this.sql.exec('INSERT INTO runs(token,owner,started,expires) VALUES(?,?,?,?)',token,owner,now,now+86400000);
      return json({token,name:this.name(owner),season:SEASON});
    }
    if(path==='/api/scores'){
      const {token,gates,points,assisted}=body;
      if(typeof token!=='string'||!Number.isInteger(gates)||gates<1||gates>2000||!Number.isInteger(points)||points<gates||points>gates*3||assisted!==false)return json({error:'This flight is not eligible.'},400);
      const run=this.rows('SELECT * FROM runs WHERE token=? AND owner=?',token,owner)[0];
      if(!run||run.expires<now)return json({error:'Flight expired. Start a new ranked flight.'},410);
      if(run.submitted)return json({saved:true,duplicate:true});
      if(now-run.started<Math.max(0,gates-1)*2000)return json({error:'Flight time does not match the score.'},400);
      // Synchronous SQL statements do not yield: submissions are serialized by the object.
      this.sql.exec(`INSERT INTO scores(owner,name,gates,points,achieved) VALUES(?,?,?,?,?)
        ON CONFLICT(owner) DO UPDATE SET gates=excluded.gates,points=excluded.points,achieved=excluded.achieved
        WHERE excluded.gates>scores.gates OR (excluded.gates=scores.gates AND excluded.points>scores.points)`,owner,this.name(owner),gates,points,now);
      this.sql.exec('UPDATE runs SET submitted=1 WHERE token=?',token);
      return json({saved:true,name:this.name(owner)});
    }
    return json({error:'Not found'},404);
  }
  name(owner){
    const colors=['Sunny','Cosmic','Neon','Lucky','Mango','Ruby','Silver','Aqua'];
    const flyers=['Puff','Finch','Kite','Comet','Otter','Robin','Cloud','Fox'];
    return `${colors[parseInt(owner[0],16)%8]}${flyers[parseInt(owner[1],16)%8]}-${owner.slice(-4)}`;
  }
}
